import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
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
  success: '#22C55E',
  warning: '#F59E0B',
};

const STATUS_FLOW = ['guarnicao_empenhada', 'em_deslocamento', 'em_atendimento', 'finalizada'];

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
      return 'Status nao definido';
  }
}

function getNextStatus(currentRaw: string | null | undefined): string {
  const s = (currentRaw || '').toLowerCase();
  const idx = STATUS_FLOW.indexOf(s);
  if (idx === -1) return 'em_deslocamento';
  if (idx >= STATUS_FLOW.length - 1) return 'finalizada';
  return STATUS_FLOW[idx + 1];
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatNumber(value: unknown, suffix: string) {
  if (value === null || value === undefined || value === '') return '-';
  return `${value}${suffix}`;
}

export default function BombeiroDetalhe() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const ocorrenciaId = route.params?.ocorrenciaId || route.params?.id_oco;

  const [detalhe, setDetalhe] = useState<any | null>(null);
  const [ultimaLeitura, setUltimaLeitura] = useState<any | null>(null);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [relatos, setRelatos] = useState<any[]>([]);
  const [novoRelato, setNovoRelato] = useState('');
  const [savingRelato, setSavingRelato] = useState(false);

  const loadRelatos = useCallback(async () => {
    if (!ocorrenciaId) return;

    const { data, error } = await supabase
      .from('relatos_socorrista')
      .select('id, texto, criado_em, socorrista:socorrista_id (nome)')
      .eq('ocorrencia_id', ocorrenciaId)
      .order('criado_em', { ascending: false });

    if (error) {
      console.error('[SocorristaDetalhe] Erro ao carregar relatos:', error);
      setRelatos([]);
      return;
    }

    setRelatos(data || []);
  }, [ocorrenciaId]);

  const loadSinaisVitais = useCallback(async () => {
    if (!ocorrenciaId) return;

    const { data: leitura, error: leituraError } = await supabase
      .from('leituras_sinais_vitais')
      .select('id, frequencia_cardiaca_bpm, saturacao_spo2, temperatura_c, coletado_em')
      .eq('ocorrencia_id', ocorrenciaId)
      .order('coletado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (leituraError) {
      console.error('[SocorristaDetalhe] Erro ao carregar sinais vitais:', leituraError);
      setUltimaLeitura(null);
    } else {
      setUltimaLeitura(leitura);
    }

    const { data: alertasData, error: alertasError } = await supabase
      .from('alertas_sinais_vitais')
      .select('id, nivel, tipo, mensagem, instrucao, criado_em')
      .eq('ocorrencia_id', ocorrenciaId)
      .eq('resolvido', false)
      .order('criado_em', { ascending: false })
      .limit(5);

    if (alertasError) {
      console.error('[SocorristaDetalhe] Erro ao carregar alertas:', alertasError);
      setAlertas([]);
    } else {
      setAlertas(alertasData || []);
    }
  }, [ocorrenciaId]);

  const loadDetalhe = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ocorrencias')
        .select(
          `
          id,
          protocolo,
          criada_em,
          status,
          descricao,
          endereco_texto,
          latitude,
          longitude,
          solicitante:solicitante_id (nome, telefone),
          tipo_ocorrencia:tipo_ocorrencia_id (nome),
          tipo_vitima:tipo_vitima_id (nome)
        `
        )
        .eq('id', ocorrenciaId)
        .maybeSingle();

      if (error) {
        console.error('[SocorristaDetalhe] Erro ao carregar ocorrencia:', error);
        Alert.alert('Erro', 'Nao foi possivel carregar os dados da ocorrencia.');
        setDetalhe(null);
        return;
      }

      setDetalhe(data);
      await Promise.all([loadRelatos(), loadSinaisVitais()]);
    } catch (e) {
      console.error('[SocorristaDetalhe] Erro inesperado:', e);
      Alert.alert('Erro', 'Erro inesperado ao carregar a ocorrencia.');
      setDetalhe(null);
    } finally {
      setLoading(false);
    }
  }, [ocorrenciaId, loadRelatos, loadSinaisVitais]);

  useEffect(() => {
    void loadDetalhe();
  }, [loadDetalhe]);

  useFocusEffect(
    useCallback(() => {
      void loadSinaisVitais();
      void loadRelatos();
    }, [loadRelatos, loadSinaisVitais])
  );

  async function handleOpenMaps() {
    if (!detalhe?.latitude || !detalhe?.longitude) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${detalhe.latitude},${detalhe.longitude}`;
    await Linking.openURL(url);
  }

  async function handleCallSolicitante() {
    const phone = detalhe?.solicitante?.telefone;
    if (!phone) return;
    await Linking.openURL(`tel:${phone}`);
  }

  async function persistStatus(next: string) {
    const user = getCurrentUser();
    setUpdatingStatus(true);
    try {
      const { error: errUpdate } = await supabase
        .from('ocorrencias')
        .update({
          status: next,
          atualizada_em: new Date().toISOString(),
          finalizada_em: next === 'finalizada' ? new Date().toISOString() : null,
        })
        .eq('id', ocorrenciaId);

      if (errUpdate) {
        console.error('[SocorristaDetalhe] Erro ao atualizar status:', errUpdate);
        Alert.alert('Erro', 'Nao foi possivel atualizar o status.');
        return;
      }

      await supabase.from('ocorrencia_status_historico').insert({
        ocorrencia_id: ocorrenciaId,
        status: next,
        alterado_por: user?.id || null,
      });

      await supabase
        .from('ocorrencia_empenhos')
        .update({ status: next === 'finalizada' ? 'finalizada' : next, atualizado_em: new Date().toISOString() })
        .eq('ocorrencia_id', ocorrenciaId);

      setDetalhe((old: any) => (old ? { ...old, status: next } : old));
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleNextStatus() {
    if (!detalhe) return;
    if ((detalhe.status || '').toLowerCase() === 'finalizada') {
      Alert.alert('Aviso', 'A ocorrencia ja esta finalizada.');
      return;
    }

    const next = getNextStatus(detalhe.status);
    Alert.alert('Atualizar status', `Deseja avancar para:\n\n${statusToLabel(next)}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', onPress: () => void persistStatus(next) },
    ]);
  }

  async function handleSalvarRelato() {
    const user = getCurrentUser();
    const texto = novoRelato.trim();
    if (!user || !texto) return;

    setSavingRelato(true);
    try {
      const { error } = await supabase.from('relatos_socorrista').insert({
        ocorrencia_id: ocorrenciaId,
        socorrista_id: user.id,
        texto,
      });

      if (error) {
        console.error('[SocorristaDetalhe] Erro ao salvar relato:', error);
        Alert.alert('Erro', 'Nao foi possivel salvar o relato.');
        return;
      }

      setNovoRelato('');
      await loadRelatos();
    } finally {
      setSavingRelato(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 12, color: colors.placeholder }}>Carregando detalhes da ocorrencia...</Text>
      </View>
    );
  }

  if (!detalhe) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.placeholder }}>Ocorrencia nao encontrada.</Text>
        <TouchableOpacity style={[styles.button, { marginTop: 16 }]} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const tipo = detalhe.tipo_ocorrencia?.nome || 'Ocorrencia sem tipo';
  const vitima = detalhe.tipo_vitima?.nome || 'Vitima nao informada';
  const solicitante = detalhe.solicitante?.nome || 'Nao informado';
  const telefone = detalhe.solicitante?.telefone || null;
  const currentStatusLabel = statusToLabel(detalhe.status);
  const nextStatus = getNextStatus(detalhe.status);
  const nextStatusLabel = statusToLabel(nextStatus);
  const isFinalizada = (detalhe.status || '').toLowerCase() === 'finalizada';
  const hasCoords = detalhe.latitude != null && detalhe.longitude != null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={{ color: colors.placeholder }}>Voltar</Text>
      </TouchableOpacity>

      <View style={styles.headerBlock}>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>{currentStatusLabel}</Text>
        </View>
        <Text style={styles.protocol}>{detalhe.protocolo}</Text>
      </View>

      <Text style={styles.title}>{tipo}</Text>
      <Text style={styles.subtitle}>Vitima: {vitima}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Localizacao</Text>
        <Text style={styles.cardText}>{detalhe.endereco_texto || 'Endereco textual nao informado.'}</Text>
        {hasCoords ? (
          <>
            <Text style={styles.cardLabel}>Coordenadas: {detalhe.latitude}, {detalhe.longitude}</Text>
            <TouchableOpacity style={styles.buttonSecondary} onPress={handleOpenMaps}>
              <Text style={styles.buttonSecondaryText}>Abrir rota</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.cardLabel}>Sem coordenadas registradas.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Dados da ocorrencia</Text>
        <InfoLine label="Tipo" value={tipo} />
        <InfoLine label="Vitima" value={vitima} />
        <InfoLine label="Aberta em" value={formatDateTime(detalhe.criada_em)} />
        <InfoLine label="Solicitante" value={solicitante} />
        {telefone ? (
          <TouchableOpacity style={styles.callButton} onPress={handleCallSolicitante}>
            <Text style={styles.callButtonText}>Ligar para solicitante</Text>
          </TouchableOpacity>
        ) : null}
        {detalhe.descricao ? <Text style={[styles.cardText, { marginTop: 8 }]}>{detalhe.descricao}</Text> : null}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.cardTitle}>Sinais vitais</Text>
          <TouchableOpacity onPress={() => void loadSinaisVitais()}>
            <Text style={styles.refreshText}>Atualizar</Text>
          </TouchableOpacity>
        </View>

        {ultimaLeitura ? (
          <>
            <View style={styles.vitalsGrid}>
              <VitalBox label="FC" value={formatNumber(ultimaLeitura.frequencia_cardiaca_bpm, ' bpm')} />
              <VitalBox label="SpO2" value={formatNumber(ultimaLeitura.saturacao_spo2, '%')} />
              <VitalBox label="Temp." value={formatNumber(ultimaLeitura.temperatura_c, ' C')} />
            </View>
            <Text style={styles.cardLabel}>Ultima leitura: {formatDateTime(ultimaLeitura.coletado_em)}</Text>
          </>
        ) : (
          <Text style={styles.cardText}>Nenhuma leitura recebida do dispositivo ainda.</Text>
        )}

        {alertas.length > 0 ? (
          <View style={{ marginTop: 12 }}>
            {alertas.map((alerta) => (
              <View key={alerta.id} style={styles.alertCard}>
                <Text style={styles.alertTitle}>{String(alerta.nivel || '').toUpperCase()} - {alerta.tipo}</Text>
                <Text style={styles.alertMessage}>{alerta.mensagem}</Text>
                {alerta.instrucao ? <Text style={styles.alertInstruction}>{alerta.instrucao}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Status do atendimento</Text>
        {!isFinalizada ? (
          <TouchableOpacity style={[styles.button, updatingStatus && { opacity: 0.7 }]} disabled={updatingStatus} onPress={handleNextStatus}>
            <Text style={styles.buttonText}>Avancar para: {nextStatusLabel}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={[styles.cardText, { color: colors.success, fontWeight: '700' }]}>Ocorrencia finalizada</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Relato do atendimento</Text>
        <TextInput
          style={styles.textArea}
          multiline
          placeholder="Registre avaliacao, condutas, evolucao e observacoes do atendimento..."
          placeholderTextColor={colors.placeholder}
          value={novoRelato}
          onChangeText={setNovoRelato}
        />
        <TouchableOpacity
          style={[styles.button, (!novoRelato.trim() || savingRelato) && { opacity: 0.6 }]}
          disabled={!novoRelato.trim() || savingRelato}
          onPress={handleSalvarRelato}
        >
          <Text style={styles.buttonText}>{savingRelato ? 'Salvando...' : 'Salvar relato'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Historico de relatos</Text>
        {relatos.length === 0 ? (
          <Text style={styles.cardText}>Nenhum relato registrado.</Text>
        ) : (
          relatos.map((relato) => (
            <View key={relato.id} style={styles.reportItem}>
              <Text style={styles.cardLabel}>{formatDateTime(relato.criado_em)} - {relato.socorrista?.nome || 'Socorrista'}</Text>
              <Text style={styles.cardText}>{relato.texto}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function VitalBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.vitalBox}>
      <Text style={styles.vitalLabel}>{label}</Text>
      <Text style={styles.vitalValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    marginBottom: 10,
  },
  headerBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  statusPill: {
    backgroundColor: '#172554',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillText: {
    color: '#BFDBFE',
    fontSize: 12,
    fontWeight: '700',
  },
  protocol: {
    flex: 1,
    color: colors.placeholder,
    fontSize: 12,
    textAlign: 'right',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text,
    marginTop: 4,
    marginBottom: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: colors.text,
  },
  cardLabel: {
    fontSize: 12,
    color: colors.placeholder,
    marginTop: 6,
  },
  infoLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 5,
  },
  infoLabel: {
    color: colors.placeholder,
    fontSize: 13,
  },
  infoValue: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  vitalsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  vitalBox: {
    flex: 1,
    minHeight: 70,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#020617',
    padding: 10,
    justifyContent: 'center',
  },
  vitalLabel: {
    color: colors.placeholder,
    fontSize: 12,
    marginBottom: 4,
  },
  vitalValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  alertCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: '#450A0A',
    padding: 10,
    marginTop: 8,
  },
  alertTitle: {
    color: '#FECACA',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  alertMessage: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  alertInstruction: {
    color: '#FECACA',
    fontSize: 13,
    marginTop: 6,
  },
  refreshText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  button: {
    marginTop: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  buttonSecondary: {
    marginTop: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  buttonSecondaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  callButton: {
    marginTop: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 10,
    alignItems: 'center',
  },
  callButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  textArea: {
    minHeight: 110,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.text,
    backgroundColor: '#020617',
    textAlignVertical: 'top',
  },
  reportItem: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    marginTop: 10,
  },
});
