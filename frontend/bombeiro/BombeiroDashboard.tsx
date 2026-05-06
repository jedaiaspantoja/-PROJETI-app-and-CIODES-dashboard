import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../backend/connectors/postgre';
import { getCurrentUser } from '../shared/authSession';

const colors = {
  background: '#0F172A',
  text: '#F9FAFB',
  card: '#111827',
  border: '#1F2937',
  placeholder: '#9CA3AF',
  primary: '#2563EB',
  danger: '#EF4444',
  warning: '#F59E0B',
};

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

function statusToLabel(statusRaw: string | null | undefined): string {
  const s = (statusRaw || '').toLowerCase();
  switch (s) {
    case 'registrada':
      return 'Registrada';
    case 'recebida_ciodes':
      return 'Recebida pelo CIODES';
    case 'guarnicao_empenhada':
      return 'Guarnicao empenhada';
    case 'em_deslocamento':
      return 'Em deslocamento';
    case 'em_atendimento':
      return 'Em atendimento';
    case 'finalizada':
      return 'Finalizada';
    case 'cancelada':
      return 'Cancelada';
    default:
      return statusRaw || 'Desconhecido';
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
        setErroGuarnicao('Voce nao esta vinculado a nenhuma guarnicao ativa.');
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
    } catch (e) {
      console.error('[SocorristaDashboard] Erro inesperado:', e);
      setErroGuarnicao('Erro inesperado ao carregar ocorrencias.');
      setOcorrencias([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void carregarOcorrencias();
  }, []);

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
      return ocorrencias.filter((o) => (o.status || '').toLowerCase() !== 'finalizada');
    }
    if (statusFilter === 'fechadas') {
      return ocorrencias.filter((o) => (o.status || '').toLowerCase() === 'finalizada');
    }
    return ocorrencias;
  }, [ocorrencias, statusFilter]);

  const renderItem = ({ item }: { item: OcorrenciaRow }) => {
    const tipo = item.tipo_ocorrencia?.nome || 'Ocorrencia sem tipo';
    const vitima = item.tipo_vitima?.nome || 'Vitima nao informada';
    const hasCoords = item.latitude != null && item.longitude != null;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('BombeiroDetalhe', { ocorrenciaId: item.id })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>{statusToLabel(item.status)}</Text>
          </View>
          <Text style={styles.elapsed}>{formatElapsed(item.criada_em)}</Text>
        </View>

        <Text style={styles.cardTitle}>{tipo}</Text>
        <Text style={styles.cardSubtitle}>Vitima: {vitima}</Text>
        <Text style={styles.locationText} numberOfLines={2}>
          {item.endereco_texto || (hasCoords ? `${item.latitude}, ${item.longitude}` : 'Localizacao nao informada')}
        </Text>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionButton, !hasCoords && styles.actionButtonDisabled]}
            disabled={!hasCoords}
            onPress={() => void openRoute(item)}
          >
            <Text style={styles.actionButtonText}>Abrir rota</Text>
          </TouchableOpacity>
          <Text style={styles.protocolText}>{item.protocolo}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 12, color: colors.placeholder }}>Carregando ocorrencias empenhadas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ocorrencias empenhadas</Text>
      <Text style={styles.subtitle}>Local, tipo, vitima e andamento do atendimento.</Text>

      {erroGuarnicao && (
        <View style={styles.alertBox}>
          <Text style={styles.alertText}>{erroGuarnicao}</Text>
        </View>
      )}

      {!erroGuarnicao && (
        <View style={styles.filterRow}>
          <FilterChip label="Ativas" active={statusFilter === 'ativas'} onPress={() => setStatusFilter('ativas')} />
          <FilterChip label="Todas" active={statusFilter === 'todas'} onPress={() => setStatusFilter('todas')} />
          <FilterChip label="Finalizadas" active={statusFilter === 'fechadas'} onPress={() => setStatusFilter('fechadas')} />
        </View>
      )}

      {erroGuarnicao ? null : ocorrenciasFiltradas.length === 0 ? (
        <Text style={{ color: colors.placeholder }}>Nenhuma ocorrencia empenhada encontrada.</Text>
      ) : (
        <FlatList
          data={ocorrenciasFiltradas}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        />
      )}
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
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.placeholder,
    marginTop: 4,
    marginBottom: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  statusPill: {
    backgroundColor: '#172554',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillText: {
    color: '#BFDBFE',
    fontSize: 12,
    fontWeight: '700',
  },
  elapsed: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  cardSubtitle: {
    fontSize: 15,
    color: colors.text,
    marginTop: 4,
  },
  locationText: {
    fontSize: 13,
    color: colors.placeholder,
    marginTop: 8,
  },
  cardActions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  actionButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  actionButtonDisabled: {
    opacity: 0.45,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  protocolText: {
    flex: 1,
    textAlign: 'right',
    color: colors.placeholder,
    fontSize: 12,
  },
  alertBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: 10,
    marginBottom: 12,
  },
  alertText: {
    color: colors.danger,
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.placeholder,
    fontSize: 13,
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
