import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { FontAwesome6 } from '@expo/vector-icons';
import { supabase } from '../../backend/connectors/postgre';

const colors = {
  background: '#0F172A',
  text: '#F9FAFB',
  secondary: '#9CA3AF',
  card: '#020617',
  primary: '#2563EB',
  border: '#1F2937',
  warning: '#F59E0B',
  success: '#22C55E',
};

function formatarData(dataISO?: string | null) {
  if (!dataISO) return 'Nao disponivel';
  const d = new Date(dataISO);
  if (Number.isNaN(d.getTime())) return 'Nao disponivel';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function statusToLabel(status?: string | null) {
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

function statusColor(status?: string | null) {
  const s = (status || '').toLowerCase();
  if (s === 'finalizada') return colors.success;
  if (s === 'registrada' || s === 'recebida_ciodes') return colors.warning;
  return colors.primary;
}

export default function DetalheRegistro({ route }: any) {
  const registroParam = route?.params?.registro ?? {};
  const ocorrenciaId = registroParam.id;

  const [registro, setRegistro] = useState<any>(registroParam);
  const [historico, setHistorico] = useState<any[]>([]);
  const [loading, setLoading] = useState(!!ocorrenciaId);

  const carregarDetalhes = useCallback(async () => {
    if (!ocorrenciaId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('ocorrencias')
      .select(`
        id,
        protocolo,
        status,
        descricao,
        latitude,
        longitude,
        endereco_texto,
        criada_em,
        atualizada_em,
        finalizada_em,
        tipo_ocorrencia:tipo_ocorrencia_id (nome),
        tipo_vitima:tipo_vitima_id (nome)
      `)
      .eq('id', ocorrenciaId)
      .maybeSingle();

    if (!error && data) {
      const row = data as any;
      setRegistro({
        id: row.id,
        protocolo: row.protocolo,
        title: row.tipo_ocorrencia?.nome || `Ocorrencia ${row.protocolo}`,
        description: row.tipo_vitima?.nome ? `Vitima: ${row.tipo_vitima.nome}` : row.descricao || 'Sem descricao adicional.',
        status: row.status,
        latitude: row.latitude,
        longitude: row.longitude,
        endereco_texto: row.endereco_texto,
        created_at: row.criada_em,
        atualizada_em: row.atualizada_em,
        finalizada_em: row.finalizada_em,
      });
    }

    const { data: timeline, error: timelineError } = await supabase
      .from('ocorrencia_status_historico')
      .select('id, status, observacao, criado_em')
      .eq('ocorrencia_id', ocorrenciaId)
      .order('criado_em', { ascending: true });

    setHistorico(timelineError ? [] : timeline || []);
    setLoading(false);
  }, [ocorrenciaId]);

  useEffect(() => {
    void carregarDetalhes();
  }, [carregarDetalhes]);

  const titulo = registro.title || `Ocorrencia ${registro.protocolo || ''}`;
  const descricao = registro.description || 'Sem descricao adicional.';
  const status = statusToLabel(registro.status);
  const data = formatarData(registro.created_at || registro.criada_em);

  const lat = registro.latitude == null ? null : Number(registro.latitude);
  const lng = registro.longitude == null ? null : Number(registro.longitude);
  const temCoordenadas = lat !== null && lng !== null && !Number.isNaN(lat) && !Number.isNaN(lng);

  const region = temCoordenadas
    ? { latitude: lat as number, longitude: lng as number, latitudeDelta: 0.005, longitudeDelta: 0.005 }
    : { latitude: -14.235, longitude: -51.9253, latitudeDelta: 30, longitudeDelta: 30 };

  const abrirRota = () => {
    if (!temCoordenadas) return;
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={{ color: colors.secondary, marginTop: 12 }}>Atualizando ocorrencia...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 30 }}>
      <View style={styles.card}>
        <View style={styles.statusHeader}>
          <View style={[styles.statusPill, { borderColor: statusColor(registro.status) }]}>
            <Text style={[styles.statusText, { color: statusColor(registro.status) }]}>{status}</Text>
          </View>
          <TouchableOpacity onPress={() => void carregarDetalhes()}>
            <Text style={styles.refreshText}>Atualizar</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>{titulo}</Text>
        <Text style={styles.subtitle}>Protocolo: {registro.protocolo || '-'}</Text>
        <Text style={styles.subtitle}>Aberta em: {data}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Localizacao</Text>
        {registro.endereco_texto ? <Text style={styles.value}>{registro.endereco_texto}</Text> : null}
        <View style={styles.mapWrapper}>
          {temCoordenadas ? (
            <MapView style={styles.map} initialRegion={region}>
              <Marker coordinate={{ latitude: lat as number, longitude: lng as number }} title={titulo} />
            </MapView>
          ) : (
            <View style={styles.mapFallback}>
              <Text style={styles.mapFallbackText}>Nao ha coordenadas registradas para essa ocorrencia.</Text>
            </View>
          )}
        </View>
        {temCoordenadas ? (
          <TouchableOpacity style={styles.routeButton} onPress={abrirRota}>
            <FontAwesome6 name="map-location-dot" size={16} color="#FFFFFF" />
            <Text style={styles.routeButtonText}>Abrir mapa</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Resumo</Text>
        <Text style={styles.value}>{descricao}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Linha do tempo</Text>
        {historico.length === 0 ? (
          <Text style={styles.value}>Nenhuma atualizacao registrada ainda.</Text>
        ) : (
          historico.map((item) => (
            <View key={item.id || `${item.status}-${item.criado_em}`} style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: statusColor(item.status) }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.timelineStatus}>{statusToLabel(item.status)}</Text>
                <Text style={styles.timelineDate}>{formatarData(item.criado_em)}</Text>
                {item.observacao ? <Text style={styles.timelineObs}>{item.observacao}</Text> : null}
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16, paddingTop: 12 },
  center: { justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: colors.card, borderRadius: 10, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  statusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 12, fontWeight: '800' },
  refreshText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 4 },
  subtitle: { color: colors.secondary, fontSize: 13, marginTop: 3 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 10 },
  value: { color: colors.text, fontSize: 14, lineHeight: 20 },
  mapWrapper: { marginTop: 12, height: 220, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: '#020617' },
  map: { flex: 1 },
  mapFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  mapFallbackText: { color: colors.secondary, fontSize: 12, textAlign: 'center' },
  routeButton: { marginTop: 12, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 11 },
  routeButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  timelineItem: { flexDirection: 'row', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  timelineStatus: { color: colors.text, fontSize: 14, fontWeight: '800' },
  timelineDate: { color: colors.secondary, fontSize: 12, marginTop: 2 },
  timelineObs: { color: colors.secondary, fontSize: 13, marginTop: 4 },
});



