import React, { useCallback, useState } from 'react';
import {
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
import { colors } from '../shared/theme';
import { useResponsiveLayout } from '../shared/responsive';
import LoadingState from '../shared/LoadingState';

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
  const layout = useResponsiveLayout();
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
      <LoadingState
        title="Carregando ocorrências"
        subtitle="Atualizando o histórico do solicitante."
        icon="clipboard-list"
      />
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
      <View
        style={[
          styles.content,
          {
            paddingHorizontal: layout.horizontalPadding,
            maxWidth: layout.maxContentWidth,
            alignSelf: 'center',
            width: '100%',
          },
        ]}
      >
        <View style={styles.headerPanel}>
        <Text style={styles.eyebrow}>Acompanhamento</Text>
        <Text style={styles.title}>Minhas ocorrencias</Text>
        <Text style={styles.subtitle}>Acompanhe o andamento dos chamados abertos por voce.</Text>
        </View>

      {casos.length === 0 ? (
        <View style={styles.emptyPanel}>
          <FontAwesome6 name="clipboard-list" size={18} color={colors.placeholder} />
          <Text style={styles.emptyText}>Nenhuma ocorrência registrada ainda.</Text>
        </View>
      ) : (
        <FlatList
          data={casos}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, layout.isSmall && styles.cardSmall]}
              onPress={() => navigation.navigate('DetalheRegistro', { registro: item })}
            >
              <View style={styles.cardIcon}>
                <FontAwesome6 name="truck-medical" size={17} color={statusColor(item.status)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDescription}>{item.description}</Text>
                <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
              </View>
              <View style={[styles.statusBox, layout.isSmall && styles.statusBoxSmall, { borderColor: statusColor(item.status) }]}>
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
  container: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, paddingHorizontal: 18 },
  headerPanel: { borderWidth: 1, borderColor: colors.border, borderRadius: colors.radiusLg, backgroundColor: colors.card, padding: 16, marginTop: 16, marginBottom: 14 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginBottom: 6 },
  title: { fontSize: 25, fontWeight: '800', color: colors.text, marginBottom: 6 },
  subtitle: { fontSize: 14, color: colors.placeholder },
  emptyPanel: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radiusMd, backgroundColor: colors.card, padding: 14 },
  emptyText: { color: colors.placeholder, fontSize: 14 },
  card: { flexDirection: 'row', gap: 12, backgroundColor: colors.card, padding: 14, borderRadius: colors.radiusLg, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  cardSmall: { alignItems: 'flex-start' },
  cardIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardDescription: { fontSize: 13, color: colors.placeholder, marginTop: 2 },
  cardDate: { fontSize: 12, color: colors.placeholder, marginTop: 4 },
  statusBox: { maxWidth: 112, alignItems: 'flex-end', borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusBoxSmall: { maxWidth: 96 },
  statusText: { fontSize: 12, fontWeight: '800', textAlign: 'right' },
});

