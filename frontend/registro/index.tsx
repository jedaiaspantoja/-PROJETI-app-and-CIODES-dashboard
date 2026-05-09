import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { FontAwesome6 } from '@expo/vector-icons';
import { supabase } from '../../backend/connectors/postgre';
import { getCurrentUser } from '../shared/authSession';
import TopHeader from '../shared/TopHeader';

const colors = {
  background: '#0F172A',
  text: '#F9FAFB',
  card: '#111827',
  border: '#1F2937',
  placeholder: '#9CA3AF',
  primary: '#2563EB',
  warning: '#F59E0B',
  success: '#22C55E',
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
    case 'registrada': return 'Registrada';
    case 'recebida_ciodes': return 'Recebida pelo CIODES';
    case 'guarnicao_empenhada': return 'Equipe empenhada';
    case 'em_deslocamento': return 'Equipe em deslocamento';
    case 'em_atendimento': return 'Em atendimento';
    case 'finalizada': return 'Finalizada';
    case 'cancelada': return 'Cancelada';
    default: return status || 'Sem status';
  }
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function statusColor(status: string | null | undefined) {
  const s = (status || '').toLowerCase();
  if (s === 'finalizada') return colors.success;
  if (s === 'registrada' || s === 'recebida_ciodes') return colors.warning;
  return colors.primary;
}

export default function RegistroCasos({ navigation }: any) {
  const [casos, setCasos] = useState<Caso[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUserState] = useState<any | null>(null);

  const carregarOcorrencias = useCallback(async () => {
    try {
      const user = getCurrentUser();
      if (!user) {
        setCurrentUserState(null);
        setCasos([]);
        Alert.alert('Login necessario', 'Voce precisa fazer login para acessar seus registros.', [
          { text: 'Ir para Login', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Login' }] }) },
          { text: 'Fechar', style: 'cancel' },
        ]);
        return;
      }

      setCurrentUserState(user);
      const { data, error } = await supabase
        .from('ocorrencias')
        .select(`
          id,
          protocolo,
          status,
          descricao,
          latitude,
          longitude,
          criada_em,
          tipo_ocorrencia:tipo_ocorrencia_id (nome),
          tipo_vitima:tipo_vitima_id (nome)
        `)
        .eq('solicitante_id', user.id)
        .order('criada_em', { ascending: false });

      if (error) {
        console.error('[RegistroCasos] Erro Supabase:', error);
        Alert.alert('Erro', 'Nao foi possivel carregar suas ocorrencias.');
        return;
      }

      const mapped: Caso[] = ((data as any[]) || []).map((row) => ({
        id: row.id,
        protocolo: row.protocolo,
        title: row.tipo_ocorrencia?.nome || `Ocorrencia ${row.protocolo}`,
        description: row.tipo_vitima?.nome ? `Vitima: ${row.tipo_vitima.nome}` : 'Vitima nao informada',
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
      setRefreshing(false);
    }
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void carregarOcorrencias();
    }, [carregarOcorrencias])
  );

  const onRefresh = () => {
    setRefreshing(true);
    void carregarOcorrencias();
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 12, color: colors.placeholder }}>Carregando ocorrencias...</Text>
      </View>
    );
  }

  if (!currentUser) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Minhas ocorrencias</Text>
        <Text style={styles.emptyText}>Nenhum usuario logado.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopHeader title="Meus Registros" />
      <View style={{ flex: 1, paddingHorizontal: 20 }}>
        <Text style={[styles.title, { marginTop: 20 }]}>Minhas ocorrencias</Text>
        <Text style={styles.subtitle}>Acompanhe o andamento dos chamados abertos por voce.</Text>

      {casos.length === 0 ? (
        <Text style={styles.emptyText}>Nenhuma ocorrencia registrada.</Text>
      ) : (
        <FlatList
          data={casos}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('DetalheRegistro', { registro: item })}>
              <View style={styles.cardIcon}>
                <FontAwesome6 name="truck-medical" size={17} color={statusColor(item.status)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDescription}>{item.description}</Text>
                <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
              </View>
              <View style={styles.statusBox}>
                <Text style={[styles.statusText, { color: statusColor(item.status) }]}>{statusToLabel(item.status)}</Text>
              </View>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          contentContainerStyle={{ paddingBottom: 28 }}
        />
      )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 40 },
  center: { justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 6 },
  subtitle: { fontSize: 14, color: colors.placeholder, marginBottom: 16 },
  emptyText: { color: colors.placeholder, fontSize: 14 },
  card: { flexDirection: 'row', gap: 12, backgroundColor: colors.card, padding: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  cardIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#020617' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardDescription: { fontSize: 13, color: colors.placeholder, marginTop: 2 },
  cardDate: { fontSize: 12, color: colors.placeholder, marginTop: 4 },
  statusBox: { maxWidth: 112, alignItems: 'flex-end' },
  statusText: { fontSize: 12, fontWeight: '800', textAlign: 'right' },
});
