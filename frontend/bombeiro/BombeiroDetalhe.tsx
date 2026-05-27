import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import TopHeader from '../shared/TopHeader';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../../backend/connectors/postgre';
import { getCurrentUser } from '../shared/authSession';
import RelatorioPDF from './RelatorioPDF';
import { colors } from '../shared/theme';
import LoadingState from '../shared/LoadingState';

const STATUS_FLOW = ['guarnicao_empenhada', 'em_deslocamento', 'em_atendimento', 'finalizada'];

const COLETOR_OTG_URL = 'http://127.0.0.1:8080/leitura';
const INTERVALO_LEITURA_OTG = 3000;

function getStatusStyle(statusRaw: string | null | undefined) {
  const s = (statusRaw || '').toLowerCase();
  switch (s) {
    case 'guarnicao_empenhada': return { bg: '#fee2e2', text: '#991b1b', icon: 'alert-circle-outline' };
    case 'em_deslocamento': return { bg: '#fef3c7', text: '#92400e', icon: 'ambulance' };
    case 'em_atendimento': return { bg: '#dcfce7', text: '#166534', icon: 'medical-bag' };
    case 'finalizada': return { bg: '#e2e8f0', text: '#475569', icon: 'check-circle-outline' };
    case 'cancelada': return { bg: '#ede9fe', text: '#5b21b6', icon: 'cancel' };
    default: return { bg: '#e0f2fe', text: '#075985', icon: 'information-outline' };
  }
}

function statusToLabel(statusRaw: string | null | undefined): string {
  const s = (statusRaw || '').toLowerCase();
  switch (s) {
    case 'registrada': return 'Registrada';
    case 'recebida_ciodes': return 'Recebida pelo CIODES';
    case 'guarnicao_empenhada': return 'Empenhada';
    case 'em_deslocamento': return 'Em deslocamento';
    case 'em_atendimento': return 'Em atendimento';
    case 'finalizada': return 'Finalizada';
    case 'cancelada': return 'Cancelada';
    default: return 'Status nao definido';
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
  const [showRelatorioPDF, setShowRelatorioPDF] = useState(false);
  const [coletorAtivo, setColetorAtivo] = useState(false);
  const [statusColetor, setStatusColetor] = useState('Aguardando Coletor OTG Backend');

  const ultimaLeituraOtgRef = useRef('');
  const user = getCurrentUser();

  const buscarLeituraOtg = useCallback(async () => {
    try {
      const resposta = await fetch(COLETOR_OTG_URL);

      if (!resposta.ok) {
        setColetorAtivo(false);
        setStatusColetor('Coletor OTG não respondeu corretamente.');
        return;
      }

      const dados = await resposta.json();

      const leituraAtualJson = JSON.stringify({
        frequencia_cardiaca_bpm: dados.frequencia_cardiaca_bpm,
        saturacao_spo2: dados.saturacao_spo2,
        temperatura_c: dados.temperatura_c,
        coletado_em: dados.coletado_em,
        status: dados.status,
      });

      if (leituraAtualJson === ultimaLeituraOtgRef.current) {
        setColetorAtivo(true);
        setStatusColetor('Coletor OTG conectado. Aguardando nova leitura.');
        return;
      }

      ultimaLeituraOtgRef.current = leituraAtualJson;
      setColetorAtivo(true);
      setStatusColetor(dados.status ? `Coletor OTG: ${dados.status}` : 'Leitura recebida do Coletor OTG.');

      setUltimaLeitura({
        id: 'otg-local',
        frequencia_cardiaca_bpm: dados.frequencia_cardiaca_bpm,
        saturacao_spo2: dados.saturacao_spo2,
        temperatura_c: dados.temperatura_c,
        coletado_em: dados.coletado_em ?? new Date().toISOString(),
        origem: 'coletor_otg',
        status: dados.status,
      });
    } catch (error) {
      setColetorAtivo(false);
      setStatusColetor('Abra o Coletor OTG Backend e inicie o backend local.');
    }
  }, []);

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
    } else if (leitura) {
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
          vitima_nome,
          vitima_data_nascimento,
          vitima_idade_anos,
          latitude,
          longitude,
          solicitante:solicitante_id (nome, telefone),
          tipo_ocorrencia:tipo_ocorrencia_id (nome),
          tipo_vitima:tipo_vitima_id (nome),
          empenhos:ocorrencia_empenhos (
            guarnicao:guarnicao_id (nome, tipo_viatura, prefixo)
          )
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

  useEffect(() => {
    void buscarLeituraOtg();

    const intervalo = setInterval(() => {
      void buscarLeituraOtg();
    }, INTERVALO_LEITURA_OTG);

    return () => clearInterval(intervalo);
  }, [buscarLeituraOtg]);

  useFocusEffect(
    useCallback(() => {
      void loadSinaisVitais();
      void loadRelatos();
      void buscarLeituraOtg();
    }, [loadRelatos, loadSinaisVitais, buscarLeituraOtg])
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

  function handleDownloadPDF() {
    setShowRelatorioPDF(true);
  }

  if (loading) {
    return (
      <LoadingState
        title="Carregando atendimento"
        subtitle="Buscando ocorrência, sinais vitais e relatos da equipe."
        icon="truck-medical"
      />
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

  const styleInfo = getStatusStyle(detalhe.status);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopHeader title="Detalhes da Ocorrência" />
      <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 50 }}
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        extraScrollHeight={Platform.OS === 'ios' ? 50 : 100}
      >
        <View style={styles.headerBlock}>
          <View style={[styles.statusPill, { backgroundColor: styleInfo.bg }]}>
            <MaterialCommunityIcons name={styleInfo.icon as any} size={14} color={styleInfo.text} style={{ marginRight: 6 }} />
            <Text style={[styles.statusPillText, { color: styleInfo.text }]}>{currentStatusLabel}</Text>
          </View>
          <Text style={styles.protocol}>#{detalhe.protocolo}</Text>
        </View>

        <Text style={styles.title}>{tipo}</Text>

        <View style={styles.subtitleRow}>
          <MaterialCommunityIcons name="account-alert" size={18} color={colors.placeholder} />
          <Text style={styles.subtitle}>Vítima: {vitima}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="map-marker-radius" size={22} color={colors.primary} />
            <Text style={styles.cardTitle}>Localização</Text>
          </View>
          <Text style={styles.cardText}>{detalhe.endereco_texto || 'Endereço textual não informado.'}</Text>
          {hasCoords ? (
            <>
              <Text style={styles.cardLabel}>GPS: {detalhe.latitude}, {detalhe.longitude}</Text>
              <TouchableOpacity style={styles.buttonSecondary} onPress={handleOpenMaps}>
                <MaterialCommunityIcons name="navigation" size={18} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.buttonSecondaryText}>Abrir no GPS</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.warningBox}>
              <MaterialCommunityIcons name="alert" size={16} color={colors.warning} style={{ marginRight: 6 }} />
              <Text style={[styles.cardLabel, { color: colors.warning, marginTop: 0 }]}>Sem coordenadas registradas.</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={22} color={colors.primary} />
            <Text style={styles.cardTitle}>Dados da Ocorrência</Text>
          </View>
          <InfoLine label="Aberta em" value={formatDateTime(detalhe.criada_em)} />
          <InfoLine label="Solicitante" value={solicitante} />
          {telefone ? (
            <TouchableOpacity style={styles.callButton} onPress={handleCallSolicitante}>
              <MaterialCommunityIcons name="phone" size={16} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.callButtonText}>Ligar para o Solicitante</Text>
            </TouchableOpacity>
          ) : null}
          {detalhe.descricao ? (
            <View style={styles.descriptionBox}>
              <Text style={styles.cardLabel}>Descrição original:</Text>
              <Text style={[styles.cardText, { marginTop: 4, fontStyle: 'italic' }]}>"{detalhe.descricao}"</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={[styles.sectionHeader, { justifyContent: 'space-between', width: '100%' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialCommunityIcons name="heart-pulse" size={22} color={colors.danger} />
              <Text style={styles.cardTitle}>Sensores Vitais</Text>
            </View>
            <TouchableOpacity onPress={() => void buscarLeituraOtg()} style={{ padding: 4 }}>
              <MaterialCommunityIcons name="refresh" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {ultimaLeitura ? (
            <>
              <View style={styles.vitalsGrid}>
                <VitalBox label="FC" value={formatNumber(ultimaLeitura.frequencia_cardiaca_bpm, ' bpm')} icon="heart-pulse" color={colors.danger} />
                <VitalBox label="SpO2" value={formatNumber(ultimaLeitura.saturacao_spo2, '%')} icon="water-percent" color="#0284c7" />
                <VitalBox label="Temp." value={formatNumber(ultimaLeitura.temperatura_c, ' °C')} icon="thermometer" color={colors.warning} />
              </View>
              <Text style={styles.cardLabel}>Última leitura: {formatDateTime(ultimaLeitura.coletado_em)}</Text>
              {ultimaLeitura.origem === 'coletor_otg' ? (
                <Text style={styles.cardLabel}>Origem: Coletor OTG Backend</Text>
              ) : null}
            </>
          ) : (
            <View style={styles.emptySensorsBox}>
              <MaterialCommunityIcons name="usb-port" size={24} color={colors.placeholder} style={{ marginBottom: 8 }} />
              <Text style={[styles.cardText, { textAlign: 'center' }]}>Nenhum dado recebido. Abra o Coletor OTG Backend.</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.simulateButton}
            onPress={() => void buscarLeituraOtg()}
          >
            <MaterialCommunityIcons name="usb-port" size={16} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.buttonSecondaryText}>
              {coletorAtivo ? 'Atualizar Sensores OTG' : 'Conectar Coletor OTG'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.cardLabel}>
            {statusColetor}
          </Text>

          {alertas.length > 0 && (
            <View style={{ marginTop: 16 }}>
              {alertas.map((alerta) => (
                <View key={alerta.id} style={styles.alertCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <MaterialCommunityIcons name="alert" size={16} color="#991b1b" style={{ marginRight: 6 }} />
                    <Text style={styles.alertTitle}>{String(alerta.nivel || '').toUpperCase()} - {alerta.tipo}</Text>
                  </View>
                  <Text style={styles.alertMessage}>{alerta.mensagem}</Text>
                  {alerta.instrucao ? <Text style={styles.alertInstruction}>Ação: {alerta.instrucao}</Text> : null}
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="progress-clock" size={22} color={colors.primary} />
            <Text style={styles.cardTitle}>Controle da Ocorrência</Text>
          </View>
          {!isFinalizada ? (
            <TouchableOpacity style={[styles.statusButton, updatingStatus && { opacity: 0.7 }]} disabled={updatingStatus} onPress={handleNextStatus}>
              <Text style={styles.statusButtonText}>Avançar para: {nextStatusLabel}</Text>
              <MaterialCommunityIcons name="chevron-double-right" size={20} color="#FFF" />
            </TouchableOpacity>
          ) : (
            <>
              <View style={styles.successBox}>
                <MaterialCommunityIcons name="check-circle" size={20} color={colors.success} style={{ marginRight: 8 }} />
                <Text style={[styles.cardText, { color: colors.success, fontWeight: '700' }]}>Ocorrência Finalizada</Text>
              </View>
              <TouchableOpacity style={styles.buttonSecondary} onPress={handleDownloadPDF}>
                <MaterialCommunityIcons name="file-pdf-box" size={20} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.buttonSecondaryText}>Relatório</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {!isFinalizada && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="pencil-box-outline" size={22} color={colors.primary} />
              <Text style={styles.cardTitle}>Registrar Relato</Text>
            </View>
            <TextInput
              style={styles.textArea}
              multiline
              placeholder="Descreva avaliação primária, condutas, e evolução da vítima..."
              placeholderTextColor={colors.placeholder}
              value={novoRelato}
              onChangeText={setNovoRelato}
            />
            <TouchableOpacity
              style={[styles.button, (!novoRelato.trim() || savingRelato) && { opacity: 0.6 }]}
              disabled={!novoRelato.trim() || savingRelato}
              onPress={handleSalvarRelato}
            >
              <Text style={styles.buttonText}>{savingRelato ? 'Salvando...' : 'Salvar Relato'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="history" size={22} color={colors.primary} />
            <Text style={styles.cardTitle}>Histórico de Relatos</Text>
          </View>
          {relatos.length === 0 ? (
            <Text style={styles.cardLabel}>Nenhum relato registrado.</Text>
          ) : (
            relatos.map((relato) => (
              <View key={relato.id} style={styles.reportItem}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <MaterialCommunityIcons name="account-clock-outline" size={14} color={colors.placeholder} style={{ marginRight: 4 }} />
                  <Text style={styles.cardLabel}>{formatDateTime(relato.criado_em)} • {relato.socorrista?.nome || 'Socorrista'}</Text>
                </View>
                <Text style={styles.cardText}>{relato.texto}</Text>
              </View>
            ))
          )}
        </View>
      </KeyboardAwareScrollView>

      <RelatorioPDF
        visible={showRelatorioPDF}
        onClose={() => setShowRelatorioPDF(false)}
        ocorrencia={detalhe}
        socorrista={user}
        ultimaLeitura={ultimaLeitura}
        alertas={alertas}
      />
    </View>
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

function VitalBox({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <View style={styles.vitalBox}>
      <MaterialCommunityIcons name={icon as any} size={24} color={color} style={{ marginBottom: 4 }} />
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerBlock: {
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
    paddingVertical: 6,
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  protocol: {
    color: colors.placeholder,
    fontSize: 14,
    fontWeight: '700',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 16,
    color: colors.placeholder,
    marginLeft: 6,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: colors.radiusLg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  cardText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  cardLabel: {
    fontSize: 13,
    color: colors.placeholder,
    marginTop: 4,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  descriptionBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  infoLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: {
    color: colors.placeholder,
    fontSize: 14,
  },
  infoValue: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  vitalsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  vitalBox: {
    flex: 1,
    alignItems: 'center',
    borderRadius: colors.radiusMd,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#ffffff',
    paddingVertical: 12,
  },
  vitalLabel: {
    color: colors.placeholder,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  vitalValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  emptySensorsBox: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#ffffff',
    borderRadius: colors.radiusMd,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  simulateButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.secondaryAccent,
    borderRadius: colors.radiusSm,
    paddingVertical: 12,
    marginTop: 8,
  },
  alertCard: {
    borderRadius: colors.radiusSm,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    backgroundColor: '#fee2e2',
    padding: 12,
    marginTop: 8,
  },
  alertTitle: {
    color: '#991b1b',
    fontSize: 13,
    fontWeight: '800',
  },
  alertMessage: {
    color: '#991b1b',
    fontSize: 14,
    marginTop: 4,
  },
  alertInstruction: {
    color: '#991b1b',
    fontSize: 13,
    marginTop: 8,
    fontStyle: 'italic',
  },
  statusButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: colors.radiusSm,
  },
  statusButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    padding: 12,
    borderRadius: colors.radiusSm,
    borderWidth: 1,
    borderColor: colors.success,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: colors.radiusSm,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  buttonSecondary: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: colors.radiusSm,
    paddingVertical: 12,
  },
  buttonSecondaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  callButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    borderRadius: colors.radiusSm,
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingVertical: 12,
  },
  callButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  textArea: {
    minHeight: 120,
    borderRadius: colors.radiusMd,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    backgroundColor: '#ffffff',
    textAlignVertical: 'top',
    fontSize: 15,
  },
  reportItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
    marginTop: 12,
  },
});
