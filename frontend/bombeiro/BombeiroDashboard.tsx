import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Linking,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  BackHandler,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../backend/connectors/postgre';
import { getCurrentUser } from '../shared/authSession';
import TopHeader from '../shared/TopHeader';
import { colors } from '../shared/theme';
import LoadingState from '../shared/LoadingState';

import { MaterialCommunityIcons } from '@expo/vector-icons';

type OcorrenciaRow = {
  id: string;
  protocolo: string;
  criada_em: string;
  status: string | null;
  tipo_ocorrencia: { nome: string | null } | null;
  tipo_vitima: { nome: string | null } | null;
  latitude: number | null;
  longitude: number | null;
  endereco_texto?: string | null;
};

type StatusFilter = 'ativas' | 'todas' | 'fechadas';

// Função para mapear o status para um estilo visual (cor de fundo, cor de texto e ícone)
function getStatusStyle(statusRaw: string | null | undefined) {
  const s = (statusRaw || '').toLowerCase();
  switch (s) {
    case 'guarnicao_empenhada':
      return { bg: '#fee2e2', text: '#991b1b', label: 'Empenhada (Responda)', icon: 'alert-circle-outline' };
    case 'em_deslocamento':
      return { bg: '#fef3c7', text: '#92400e', label: 'Em deslocamento', icon: 'ambulance' };
    case 'em_atendimento':
      return { bg: '#dcfce7', text: '#166534', label: 'Em atendimento', icon: 'medical-bag' };
    case 'finalizada':
      return { bg: '#e2e8f0', text: '#475569', label: 'Finalizada', icon: 'check-circle-outline' };
    case 'cancelada':
      return { bg: '#ede9fe', text: '#5b21b6', label: 'Cancelada', icon: 'cancel' };
    default:
      return { bg: '#e0f2fe', text: '#075985', label: statusRaw || 'Desconhecido', icon: 'information-outline' };
  }
}

function formatElapsed(iso: string | null | undefined): string {
  if (!iso) return 'tempo nao informado';
  const start = new Date(iso).getTime();
  if (Number.isNaN(start)) return 'tempo nao informado';
  const diffMinutes = Math.max(0, Math.floor((Date.now() - start) / 60000));
  if (diffMinutes < 1) return 'agora';
  if (diffMinutes < 60) return `${diffMinutes} min`;
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return minutes ? `${hours}h ${minutes}min` : `${hours}h`;
}

async function openRoute(item: OcorrenciaRow) {
  if (item.latitude == null || item.longitude == null) return;
  const url = `https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`;
  await Linking.openURL(url);
}

export default function BombeiroDashboard({ navigation }: any) {
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erroGuarnicao, setErroGuarnicao] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ativas');
  const channelsRef = useRef<any[]>([]);

  async function carregarOcorrencias() {
    try {
      setErroGuarnicao(null);

      const user = getCurrentUser();
      if (!user) {
        setErroGuarnicao('Nenhum usuario logado. Faca login novamente.');
        setOcorrencias([]);
        return;
      }

      const { data: membros, error: membrosError } = await supabase
        .from('guarnicao_membros')
        .select('guarnicao_id')
        .eq('usuario_id', user.id)
        .eq('ativo', true);

      if (membrosError) {
        console.error('[SocorristaDashboard] Erro ao buscar guarnicoes:', membrosError);
        setErroGuarnicao('Erro ao carregar suas guarnicoes.');
        setOcorrencias([]);
        return;
      }

      const guarnicaoIds = Array.from(new Set(((membros || []) as any[]).map((m) => m.guarnicao_id).filter(Boolean)));

      if (!guarnicaoIds.length) {
        setErroGuarnicao('Voce nao esta vinculado a nenhuma guarnicao ativa. Fale com o CIODES.');
        setOcorrencias([]);
        return;
      }

      const { data, error } = await supabase
        .from('ocorrencia_empenhos')
        .select(
          `
          status,
          ocorrencia:ocorrencia_id (
            id,
            protocolo,
            criada_em,
            status,
            latitude,
            longitude,
            endereco_texto,
            tipo_ocorrencia:tipo_ocorrencia_id (nome),
            tipo_vitima:tipo_vitima_id (nome)
          )
        `
        )
        .in('guarnicao_id', guarnicaoIds)
        .order('criado_em', { ascending: false });

      if (error) {
        console.error('[SocorristaDashboard] Erro ao buscar ocorrencias:', error);
        setErroGuarnicao('Erro ao carregar ocorrencias empenhadas.');
        setOcorrencias([]);
        return;
      }

      const rows = ((data as any[]) || [])
        .map((row) => row.ocorrencia)
        .filter(Boolean) as OcorrenciaRow[];

      setOcorrencias(rows);

      // configurar assinatura Realtime (uma por guarnição) para atualizações
      try {
        // limpa assinaturas anteriores caso existam
        if (channelsRef.current && channelsRef.current.length) {
          channelsRef.current.forEach((ch: any) => {
            try {
              ch.unsubscribe();
            } catch (e) {
              // ignore
            }
          });
        }

        const newChannels: any[] = [];
        for (const gid of guarnicaoIds) {
          const ch = supabase
            .channel(`ocorrencia_empenhos_guarnicao_${gid}`)
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'ocorrencia_empenhos', filter: `guarnicao_id=eq.${gid}` },
              (payload) => {
                console.log('[Realtime] ocorrencia_empenhos', gid, payload.eventType || payload.event, payload.new || payload.old);
                // atualiza somente os dados sem recriar canais
                void refreshOcorrencias(guarnicaoIds);
              }
            )
            .subscribe();

          newChannels.push(ch);
        }
        channelsRef.current = newChannels;
      } catch (e) {
        console.warn('[Realtime] nao foi possivel criar assinaturas realtime', e);
      }
    } catch (e) {
      console.error('[SocorristaDashboard] Erro inesperado:', e);
      setErroGuarnicao('Erro inesperado ao carregar ocorrencias.');
      setOcorrencias([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // busca leve para atualizar a lista sem tocar nas assinaturas
  async function refreshOcorrencias(guarnicaoIdsParam?: Array<number | string>) {
    try {
      const user = getCurrentUser();
      if (!user) return;

      const { data: membros } = await supabase
        .from('guarnicao_membros')
        .select('guarnicao_id')
        .eq('usuario_id', user.id)
        .eq('ativo', true);

      const guarnicaoIds = (guarnicaoIdsParam && guarnicaoIdsParam.length) ? guarnicaoIdsParam : Array.from(new Set(((membros || []) as any[]).map((m) => m.guarnicao_id).filter(Boolean)));
      if (!guarnicaoIds.length) return;

      const { data } = await supabase
        .from('ocorrencia_empenhos')
        .select(
          `
          ocorrencia:ocorrencia_id (
            id,
            protocolo,
            criada_em,
            status,
            latitude,
            longitude,
            endereco_texto,
            tipo_ocorrencia:tipo_ocorrencia_id (nome),
            tipo_vitima:tipo_vitima_id (nome)
          )
        `
        )
        .in('guarnicao_id', guarnicaoIds)
        .order('criado_em', { ascending: false });

      const rows = ((data as any[]) || []).map((row) => row.ocorrencia).filter(Boolean) as OcorrenciaRow[];
      setOcorrencias(rows);
    } catch (err) {
      console.warn('[refreshOcorrencias] erro', err);
    }
  }

  useEffect(() => {
    void carregarOcorrencias();

    const backAction = () => {
      Alert.alert('Sair', 'Deseja voltar para a tela de login?', [
        { text: 'Não', style: 'cancel' },
        { text: 'Sim', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] }) },
      ]);
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => {
      backHandler.remove();
      // cleanup channels
      if (channelsRef.current && channelsRef.current.length) {
        channelsRef.current.forEach((ch: any) => {
          try {
            ch.unsubscribe();
          } catch (e) {
            // ignore
          }
        });
      }
    };
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      void carregarOcorrencias();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    void carregarOcorrencias();
  };

  const ocorrenciasFiltradas = useMemo(() => {
    if (statusFilter === 'ativas') {
      return ocorrencias.filter((o) => {
        const s = (o.status || '').toLowerCase();
        return s !== 'finalizada' && s !== 'cancelada';
      });
    }
    if (statusFilter === 'fechadas') {
      return ocorrencias.filter((o) => {
        const s = (o.status || '').toLowerCase();
        return s === 'finalizada' || s === 'cancelada';
      });
    }
    return ocorrencias;
  }, [ocorrencias, statusFilter]);

  const renderItem = ({ item }: { item: OcorrenciaRow }) => {
    const tipo = item.tipo_ocorrencia?.nome || 'Ocorrencia sem tipo';
    const vitima = item.tipo_vitima?.nome || 'Vitima nao informada';
    const hasCoords = item.latitude != null && item.longitude != null;
    const styleInfo = getStatusStyle(item.status);

    return (
      <TouchableOpacity
        style={[styles.card, (item.status === 'guarnicao_empenhada') && styles.cardUrgent]}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('BombeiroDetalhe', { ocorrenciaId: item.id })}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.statusPill, { backgroundColor: styleInfo.bg }]}>
            <MaterialCommunityIcons name={styleInfo.icon as any} size={14} color={styleInfo.text} style={{ marginRight: 4 }} />
            <Text style={[styles.statusPillText, { color: styleInfo.text }]}>{styleInfo.label}</Text>
          </View>
          <View style={styles.timeContainer}>
            <MaterialCommunityIcons name="clock-outline" size={14} color={colors.warning} style={{ marginRight: 4 }} />
            <Text style={styles.elapsed}>{formatElapsed(item.criada_em)}</Text>
          </View>
        </View>

        <Text style={styles.cardTitle}>{tipo}</Text>
        
        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="account-alert" size={16} color={colors.placeholder} />
          <Text style={styles.cardSubtitle}>Vítima: {vitima}</Text>
        </View>

        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="map-marker-outline" size={16} color={colors.placeholder} />
          <Text style={styles.locationText} numberOfLines={2}>
            {item.endereco_texto || (hasCoords ? `${item.latitude}, ${item.longitude}` : 'Localizacao nao informada')}
          </Text>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionButton, !hasCoords && styles.actionButtonDisabled]}
            disabled={!hasCoords}
            onPress={() => void openRoute(item)}
          >
            <MaterialCommunityIcons name="navigation-variant" size={16} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.actionButtonText}>Abrir Rota GPS</Text>
          </TouchableOpacity>
          <Text style={styles.protocolText}>#{item.protocolo}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <LoadingState
        title="Sincronizando com o CIODES"
        subtitle="Carregando viatura, equipe e chamados atribuídos."
        icon="tower-broadcast"
      />
    );
  }

  return (
    <View style={styles.container}>
      <TopHeader title="Dashboard CIODES" />
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { marginTop: 16 }]}>Minhas Ocorrências</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={() => onRefresh()}>
            <MaterialCommunityIcons name="refresh" size={18} color={colors.primary} />
            <Text style={styles.refreshText}>Atualizar</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>Acompanhe os chamados atribuídos à sua viatura.</Text>

      {erroGuarnicao && (
        <View style={styles.alertBox}>
          <MaterialCommunityIcons name="alert" size={20} color={colors.danger} style={{ marginRight: 8 }} />
          <Text style={styles.alertText}>{erroGuarnicao}</Text>
        </View>
      )}

      {!erroGuarnicao && (
        <View style={styles.filterRow}>
          <FilterChip label="Ativas" active={statusFilter === 'ativas'} onPress={() => setStatusFilter('ativas')} />
          <FilterChip label="Todas" active={statusFilter === 'todas'} onPress={() => setStatusFilter('todas')} />
          <FilterChip label="Histórico" active={statusFilter === 'fechadas'} onPress={() => setStatusFilter('fechadas')} />
        </View>
      )}

      {erroGuarnicao ? null : ocorrenciasFiltradas.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="check-decagram" size={64} color="#dbe7ef" />
          <Text style={styles.emptyText}>Nenhuma ocorrência ativa.</Text>
          <Text style={styles.emptySubtext}>Aguardando chamados do CIODES.</Text>
        </View>
      ) : (
        <FlatList
          data={ocorrenciasFiltradas}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        />
      )}
      </View>
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  refreshText: {
    color: colors.primary,
    fontWeight: '700',
    marginLeft: 6,
  },
  subtitle: {
    fontSize: 15,
    color: colors.placeholder,
    marginTop: 4,
    marginBottom: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: colors.radiusLg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  cardUrgent: {
    borderColor: '#fecaca',
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  elapsed: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  cardSubtitle: {
    fontSize: 15,
    color: colors.text,
    marginLeft: 6,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: colors.placeholder,
    marginLeft: 6,
  },
  cardActions: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actionButtonDisabled: {
    opacity: 0.4,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  protocolText: {
    color: colors.placeholder,
    fontSize: 13,
    fontWeight: '600',
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: 12,
    marginBottom: 16,
  },
  alertText: {
    color: '#fca5a5',
    fontSize: 14,
    flex: 1,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.placeholder,
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  emptyText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  emptySubtext: {
    color: colors.placeholder,
    fontSize: 14,
    marginTop: 8,
  },
});


