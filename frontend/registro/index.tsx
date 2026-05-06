import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { supabase } from '../../backend/connectors/postgre';
import { getCurrentUser } from '../shared/authSession';

const colors = {
  background: '#0F172A',
  text: '#F9FAFB',
  card: '#1E293B',
  placeholder: '#9CA3AF',
  primary: '#2563EB',
};

type Caso = {
  id: string;
  protocolo: string;
  title: string;
  description: string;
  status: string;
  created_at: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

function statusToLabel(status: string | null | undefined) {
  switch ((status || '').toLowerCase()) {
    case 'registrada':
      return 'Registrada';
    case 'recebida_ciodes':
      return 'Recebida pelo CIODES';
    case 'guarnicao_empenhada':
      return 'Guarnição empenhada';
    case 'em_deslocamento':
      return 'Em deslocamento';
    case 'em_atendimento':
      return 'Em atendimento';
    case 'finalizada':
      return 'Finalizada';
    case 'cancelada':
      return 'Cancelada';
    default:
      return status || 'Sem status';
  }
}

export default function RegistroCasos({ navigation }: any) {
  const [casos, setCasos] = useState<Caso[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUserState] = useState<any | null>(null);

  useEffect(() => {
    const unsubscribe = navigation.addListener?.('focus', carregarOcorrencias);
    void carregarOcorrencias();
    return unsubscribe;
  }, [navigation]);

  const carregarOcorrencias = async () => {
    try {
      setLoading(true);
      const user = getCurrentUser();

      if (!user) {
        setCurrentUserState(null);
        setCasos([]);
        Alert.alert('Login necessário', 'Você precisa fazer login para acessar seus registros.', [
          { text: 'Ir para Login', onPress: irParaLogin },
          { text: 'Fechar', style: 'cancel' },
        ]);
        return;
      }

      setCurrentUserState(user);

      const { data, error } = await supabase
        .from('ocorrencias')
        .select(
          `
          id,
          protocolo,
          status,
          descricao,
          latitude,
          longitude,
          criada_em,
          tipo_ocorrencia:tipo_ocorrencia_id (
            nome
          ),
          tipo_vitima:tipo_vitima_id (
            nome
          )
        `
        )
        .eq('solicitante_id', user.id)
        .order('criada_em', { ascending: false });

      if (error) {
        console.error('[RegistroCasos] Erro Supabase:', error);
        Alert.alert('Erro', 'Não foi possível carregar suas ocorrências.');
        return;
      }

      const mapped: Caso[] = ((data as any[]) || []).map((row) => ({
        id: row.id,
        protocolo: row.protocolo,
        title: row.tipo_ocorrencia?.nome || `Ocorrência ${row.protocolo}`,
        description: row.tipo_vitima?.nome ? `Vítima: ${row.tipo_vitima.nome}` : 'Vítima não informada',
        status: row.status,
        latitude: row.latitude,
        longitude: row.longitude,
        created_at: row.criada_em,
      }));

      setCasos(mapped);
    } catch (e) {
      console.error('[RegistroCasos] Erro geral:', e);
    } finally {
      setLoading(false);
    }
  };

  const irParaLogin = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 12, color: colors.placeholder }}>Carregando ocorrências...</Text>
      </View>
    );
  }

  if (!currentUser) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Ocorrências Registradas</Text>
        <Text style={{ color: colors.placeholder, marginBottom: 16 }}>Nenhum usuário logado.</Text>

        <TouchableOpacity style={styles.backButton} onPress={irParaLogin}>
          <FontAwesome6 name="arrow-left" size={16} color={colors.placeholder} />
          <Text style={styles.backButtonText}>Ir para Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ocorrências Registradas</Text>

      {casos.length === 0 ? (
        <Text style={{ color: colors.placeholder }}>Nenhuma ocorrência registrada.</Text>
      ) : (
        <FlatList
          data={casos}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                navigation.navigate('DetalheRegistro', {
                  registro: item,
                })
              }
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDescription}>{item.description}</Text>
                <Text style={styles.cardDescription}>Status: {statusToLabel(item.status)}</Text>
              </View>

              <FontAwesome6 name="chevron-right" size={18} color={colors.placeholder} />
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}

      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <FontAwesome6 name="arrow-left" size={16} color={colors.placeholder} />
        <Text style={styles.backButtonText}>Voltar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 5,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  cardDescription: {
    fontSize: 14,
    color: colors.placeholder,
    marginTop: 2,
  },
  backButton: {
    marginTop: 'auto',
    marginBottom: 40,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: colors.placeholder,
    fontSize: 16,
  },
});
