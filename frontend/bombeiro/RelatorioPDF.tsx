import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from '../../backend/connectors/postgre';
import { colors } from '../shared/theme';

function calculateAgeFromBirthDate(value?: string | null) {
  if (!value) return '';
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 ? String(age) : '';
}

function resolveVictimAge(ocorrencia: any) {
  return calculateAgeFromBirthDate(ocorrencia?.vitima_data_nascimento)
    || (ocorrencia?.vitima_idade_anos != null ? String(ocorrencia.vitima_idade_anos) : '');
}

function formatDateTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatVitalValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '';
  return String(value);
}

function fieldValue(value: unknown, suffix = '') {
  if (value === null || value === undefined || value === '') return '';
  const text = String(value);
  return text ? `${text}${suffix}` : '';
}

function getGuarnicaoLabel(ocorrencia: any) {
  const guarnicao = ocorrencia?.empenhos?.[0]?.guarnicao;
  if (!guarnicao) return 'Nao informada';
  return `${guarnicao.tipo_viatura || ''} ${guarnicao.prefixo || guarnicao.nome || ''}`.trim() || guarnicao.nome || 'Nao informada';
}

function buildInitialFormData(ocorrencia: any, ultimaLeitura?: any | null, alertas?: any[], draft?: Partial<RelatorioData>): RelatorioData {
  const alertaMaisRecente = alertas?.[0];
  return {
    triagem: '',
    nomeVitima: ocorrencia?.vitima_nome || '',
    tipoVitima: ocorrencia?.tipo_vitima?.nome || '',
    idadeVitima: resolveVictimAge(ocorrencia),
    contatoEmergencia: ocorrencia?.solicitante?.telefone || '',
    pa: '',
    fc: formatVitalValue(ultimaLeitura?.frequencia_cardiaca_bpm),
    spo2: formatVitalValue(ultimaLeitura?.saturacao_spo2),
    temperatura: formatVitalValue(ultimaLeitura?.temperatura_c),
    horarioLeitura: formatDateTime(ultimaLeitura?.coletado_em),
    alertaClinico: alertaMaisRecente
      ? `${String(alertaMaisRecente.nivel || '').toUpperCase()} - ${alertaMaisRecente.mensagem || alertaMaisRecente.tipo || 'Alerta clinico'}`
      : '',
    sintomas: [],
    observacoesCena: '',
    conduta: '',
    unidadeDestino: '',
    recebedorHospital: '',
    horarioEntrega: '',
    ...draft,
  };
}

// Sistema de Cores Manchester
const manchesterColors = {
  red: '#dc2626',      // Emergência
  orange: '#EA580C',   // Muito Urgente
  yellow: '#FCD34D',   // Urgente
  green: '#22c55e',    // Pouco Urgente
  blue: '#0284c7',     // Consulta
};

const manchesterProtocols = [
  { id: 'red', label: 'Emergência', color: manchesterColors.red, description: 'Risco imediato à vida' },
  { id: 'orange', label: 'Muito Urgente', color: manchesterColors.orange, description: 'Pode evoluir para risco' },
  { id: 'yellow', label: 'Urgente', color: manchesterColors.yellow, description: 'Condição aguda mas estável' },
  { id: 'green', label: 'Pouco Urgente', color: manchesterColors.green, description: 'Sintomas crônicos ou leves' },
];

const commonSymptoms = [
  'Dor de cabeça',
  'Desmaio',
  'Sangramento',
  'Fratura exposta',
  'Queimadura',
  'Falta de ar',
  'Dor torácica',
  'Alergia',
  'Convulsão',
  'Trauma múltiplo',
];

export type RelatorioData = {
  // Triagem
  triagem: string;
  
  // Dados da Vítima
  nomeVitima: string;
  tipoVitima: string;
  idadeVitima: string;
  contatoEmergencia: string;
  
  // Sinais Vitais
  pa: string;
  fc: string;
  spo2: string;
  temperatura: string;
  horarioLeitura: string;
  alertaClinico: string;
  
  // Sintomas
  sintomas: string[];
  
  // Conduta
  observacoesCena: string;
  conduta: string;
  unidadeDestino: string;
  recebedorHospital: string;
  horarioEntrega: string;
};

interface RelatorioPDFProps {
  visible: boolean;
  onClose: () => void;
  ocorrencia: any;
  socorrista: any;
  ultimaLeitura?: any | null;
  alertas?: any[];
}

export default function RelatorioPDF({ visible, onClose, ocorrencia, socorrista, ultimaLeitura, alertas = [] }: RelatorioPDFProps) {
  const [section, setSection] = useState<'triagem' | 'vitima' | 'vitais' | 'sintomas' | 'conduta' | 'preview'>('triagem');
  const [savingDraft, setSavingDraft] = useState(false);
  
  const [formData, setFormData] = useState<RelatorioData>(() => buildInitialFormData(ocorrencia, ultimaLeitura, alertas));

  const [expandedSections, setExpandedSections] = useState({
    vitima: false,
    vitais: false,
    sintomas: false,
    conduta: false,
  });

  useEffect(() => {
    if (!visible || !ocorrencia?.id) return;

    let isActive = true;

    async function loadDraft() {
      const baseData = buildInitialFormData(ocorrencia, ultimaLeitura, alertas);
      const { data, error } = await supabase
        .from('formularios_ocorrencia')
        .select('dados_json')
        .eq('ocorrencia_id', ocorrencia.id)
        .maybeSingle();

      if (!isActive) return;

      if (error) {
        console.error('[RelatorioPDF] erro ao carregar rascunho:', error);
        setFormData(baseData);
        setSection('triagem');
        return;
      }

      const draft = (data?.dados_json || null) as Partial<RelatorioData> | null;
      setFormData(buildInitialFormData(ocorrencia, ultimaLeitura, alertas, draft || undefined));
      setSection(draft ? 'preview' : 'triagem');
    }

    void loadDraft();

    return () => {
      isActive = false;
    };
  }, [visible, ocorrencia?.id, ultimaLeitura?.id, alertas.length]);

  async function saveDraft(options?: { silent?: boolean; status?: 'rascunho' | 'gerado' }) {
    if (!ocorrencia?.id) {
      if (!options?.silent) Alert.alert('Rascunho indisponivel', 'Ocorrencia sem identificador para salvar o relatorio.');
      return false;
    }

    setSavingDraft(true);
    try {
      const { error } = await supabase.from('formularios_ocorrencia').upsert(
        {
          ocorrencia_id: ocorrencia.id,
          status: options?.status || 'rascunho',
          dados_json: formData,
          gerado_por: socorrista?.id || null,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: 'ocorrencia_id' }
      );

      if (error) {
        console.error('[RelatorioPDF] erro ao salvar rascunho:', error);
        if (!options?.silent) Alert.alert('Erro', 'Nao foi possivel salvar o rascunho do relatorio.');
        return false;
      }

      if (!options?.silent) Alert.alert('Rascunho salvo', 'O preenchimento do relatorio foi salvo.');
      return true;
    } finally {
      setSavingDraft(false);
    }
  }

  const toggleSection = (sec: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  const toggleSymptom = (symptom: string) => {
    setFormData(prev => ({
      ...prev,
      sintomas: prev.sintomas.includes(symptom)
        ? prev.sintomas.filter(s => s !== symptom)
        : [...prev.sintomas, symptom],
    }));
  };

  const handleNext = () => {
    const sections: Array<'triagem' | 'vitima' | 'vitais' | 'sintomas' | 'conduta' | 'preview'> = ['triagem', 'vitima', 'vitais', 'sintomas', 'conduta', 'preview'];
    const currentIdx = sections.indexOf(section);
    if (currentIdx < sections.length - 1) {
      setSection(sections[currentIdx + 1]);
    }
  };

  const handlePrevious = () => {
    const sections: Array<'triagem' | 'vitima' | 'vitais' | 'sintomas' | 'conduta' | 'preview'> = ['triagem', 'vitima', 'vitais', 'sintomas', 'conduta', 'preview'];
    const currentIdx = sections.indexOf(section);
    if (currentIdx > 0) {
      setSection(sections[currentIdx - 1]);
    }
  };

  const getTriagemInfo = (triagem: string) => {
    const map: Record<string, { label: string; cor: string; tempo: string }> = {
      red: { label: 'EMERGÊNCIA', cor: '#dc2626', tempo: 'ATENDIMENTO IMEDIATO' },
      orange: { label: 'MUITO URGENTE', cor: '#EA580C', tempo: 'ATENDIMENTO EM ATÉ 10 MIN' },
      yellow: { label: 'URGENTE', cor: '#d97706', tempo: 'ATENDIMENTO EM ATÉ 30 MIN' },
      green: { label: 'POUCO URGENTE', cor: '#22c55e', tempo: 'ATENDIMENTO EM ATÉ 120 MIN' },
    };
    return map[triagem] || map.yellow;
  };

  const generatePDF = async () => {
    try {
      const draftSaved = await saveDraft({ silent: true, status: 'rascunho' });
      if (!draftSaved) {
        Alert.alert('Erro', 'Nao foi possivel salvar o rascunho antes de gerar o PDF.');
        return;
      }

      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-BR');
      const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const triageInfo = getTriagemInfo(formData.triagem);

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8" />
          <title>Relatório APH - ${ocorrencia?.protocolo}</title>
          <style>
            @page { size: A4; margin: 8mm; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Arial', sans-serif;
              color: #000;
              background: #fff;
              line-height: 1.28;
              min-height: 281mm;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              color-adjust: exact;
            }
            .container {
              width: 100%;
              min-height: auto;
              margin: 0 auto;
              padding: 0;
              background: white;
              position: relative;
              min-height: 281mm;
              display: flex;
              flex-direction: column;
              page-break-after: avoid;
            }
            
            /* FAIXA DE GRAVIDADE NO TOPO */
            .severity-bar {
              width: 100%;
              background: ${triageInfo.cor} !important;
              background-color: ${triageInfo.cor} !important;
              background-image: linear-gradient(${triageInfo.cor}, ${triageInfo.cor}) !important;
              box-shadow: inset 0 0 0 1000px ${triageInfo.cor};
              border: 1px solid ${triageInfo.cor};
              border-top: 8px solid ${triageInfo.cor};
              color: #FFFFFF !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              color-adjust: exact;
              border-collapse: collapse;
              font-size: 17px;
              font-weight: bold;
              text-align: center;
              letter-spacing: 1px;
            }
            
            .severity-cell {
              background: ${triageInfo.cor} !important;
              background-color: ${triageInfo.cor} !important;
              background-image: linear-gradient(${triageInfo.cor}, ${triageInfo.cor}) !important;
              box-shadow: inset 0 0 0 1000px ${triageInfo.cor};
              color: #FFFFFF !important;
              padding: 9px 16px;
              text-align: center;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              color-adjust: exact;
            }
            .severity-time {
              color: #FFFFFF !important;
              font-size: 12px;
              margin-top: 2px;
              font-weight: normal;
              letter-spacing: 0.5px;
            }
            
            /* CABEÇALHO */
            .header {
              padding: 12px 16px;
              border-bottom: 3px solid #000;
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            
            .header-left {
              flex: 1;
            }
            
            .institution-name {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 4px;
            }
            
            .document-title {
              font-size: 12px;
              font-weight: bold;
              margin-bottom: 8px;
              text-transform: uppercase;
            }
            
            .header-right {
              text-align: right;
              font-size: 10px;
              line-height: 1.6;
            }
            
            .protocol-number {
              font-size: 14px;
              font-weight: bold;
              margin-top: 8px;
            }
            
            /* LINHA DE INFORMAÇÕES */
            .info-line {
              display: flex;
              font-size: 10px;
              margin: 2px 0;
            }
            
            .info-label {
              font-weight: bold;
              width: 100px;
              margin-right: 10px;
            }
            
            .info-value {
              flex: 1;
              border-bottom: 1px dotted #000;
            }
            
            /* SEÇÕES */
            .section {
              padding: 9px 16px;
              border-bottom: 1px solid #ccc;
            }
            
            .section-title {
              font-size: 11px;
              font-weight: bold;
              text-transform: uppercase;
              margin-bottom: 6px;
              padding-bottom: 3px;
              border-bottom: 2px solid #000;
              letter-spacing: 0.5px;
            }
            
            /* TABELA DE SINAIS VITAIS */
            .vitals-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
              margin-top: 6px;
            }
            
            .vitals-table td {
              border: 1px solid #000;
              padding: 4px 6px;
              text-align: left;
            }
            
            .vitals-label {
              font-weight: bold;
              background-color: #f0f0f0;
            }
            
            .vitals-value {
              width: 35%;
            }
            
            /* SINTOMAS */
            .symptoms-box {
              font-size: 10px;
              margin-top: 6px;
              padding: 8px;
              border: 1px solid #000;
              min-height: 28px;
              line-height: 1.5;
            }
            
            /* CONDUTA */
            .conduct-box {
              font-size: 10px;
              margin-top: 6px;
              padding: 8px;
              border: 1px solid #000;
              min-height: 42px;
              line-height: 1.5;
              white-space: pre-wrap;
              word-wrap: break-word;
            }
            
            /* ASSINATURA E RODAPÉ */
            .document-footer {
              width: 100%;
              margin-top: auto;
              background: #FFFFFF;
              page-break-inside: avoid;
              page-break-before: avoid;
            }
            
            .signature-area {
              display: flex;
              justify-content: center;
              gap: 32px;
              padding: 18px 20px 12px;
              font-size: 9px;
            }
            
            .signature-line {
              border-top: 1px solid #000;
              width: 150px;
              text-align: center;
              padding-top: 4px;
              line-height: 1.3;
            }

            .footer {
              padding: 7px 16px 0;
              font-size: 8px;
              border-top: 1px solid #999;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <!-- FAIXA DE GRAVIDADE -->
            <table class="severity-bar" bgcolor="${triageInfo.cor}" cellpadding="0" cellspacing="0" style="background:${triageInfo.cor} !important; background-color:${triageInfo.cor} !important; background-image:linear-gradient(${triageInfo.cor}, ${triageInfo.cor}) !important; box-shadow:inset 0 0 0 1000px ${triageInfo.cor}; border-color:${triageInfo.cor}; color:#FFFFFF !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;">
              <tr>
                <td class="severity-cell" bgcolor="${triageInfo.cor}" style="background:${triageInfo.cor} !important; background-color:${triageInfo.cor} !important; color:#FFFFFF !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;">
                  ${triageInfo.label}
                  <div class="severity-time">${triageInfo.tempo}</div>
                </td>
              </tr>
            </table>
            
            <!-- CABEÇALHO -->
            <div class="header">
              <div class="header-left">
                <div class="institution-name">PROJETI APH</div>
                <div class="document-title">Relatório de Atendimento Pré-Hospitalar</div>
              </div>
              <div class="header-right">
                <div>Protocolo: ${ocorrencia?.protocolo ? `#${ocorrencia.protocolo}` : ''}</div>
                <div>Viatura: ${getGuarnicaoLabel(ocorrencia) === 'Nao informada' ? '' : getGuarnicaoLabel(ocorrencia)}</div>
                <div>Socorrista: ${socorrista?.nome || socorrista?.email || ''}</div>
              </div>
            </div>
            
            <div class="section">
              <div class="section-title">Identificação</div>
              <div class="info-line">
                <div class="info-label">Local:</div>
                <div class="info-value">${fieldValue(ocorrencia?.endereco_texto)}</div>
              </div>
              <div class="info-line">
                <div class="info-label">GPS:</div>
                <div class="info-value">${ocorrencia?.latitude && ocorrencia?.longitude ? `${ocorrencia.latitude}, ${ocorrencia.longitude}` : ''}</div>
              </div>
              <div class="info-line">
                <div class="info-label">Ocorrência:</div>
                <div class="info-value">${fieldValue(ocorrencia?.tipo_ocorrencia?.nome)}</div>
              </div>
              <div class="info-line">
                <div class="info-label">Status:</div>
                <div class="info-value">${fieldValue(ocorrencia?.status)}</div>
              </div>
            </div>
            
            <div class="section">
              <div class="section-title">Vítima</div>
              <div class="info-line">
                <div class="info-label">Nome:</div>
                <div class="info-value">${fieldValue(formData.nomeVitima)}</div>
              </div>
              <div class="info-line">
                <div class="info-label">Tipo:</div>
                <div class="info-value">${fieldValue(formData.tipoVitima)}</div>
              </div>
              <div class="info-line">
                <div class="info-label">Idade:</div>
                <div class="info-value">${fieldValue(formData.idadeVitima, ' anos')}</div>
              </div>
              <div class="info-line">
                <div class="info-label">Contato:</div>
                <div class="info-value">${fieldValue(formData.contatoEmergencia)}</div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">Sinais vitais</div>
              <table class="vitals-table">
                <tr>
                  <td class="vitals-label">PA</td>
                  <td class="vitals-value">${fieldValue(formData.pa, ' mmHg')}</td>
                  <td class="vitals-label">FC</td>
                  <td class="vitals-value">${fieldValue(formData.fc, ' bpm')}</td>
                </tr>
                <tr>
                  <td class="vitals-label">SpO₂</td>
                  <td class="vitals-value">${fieldValue(formData.spo2, ' %')}</td>
                  <td class="vitals-label">Temp.</td>
                  <td class="vitals-value">${fieldValue(formData.temperatura, ' °C')}</td>
                </tr>
                <tr>
                  <td class="vitals-label">Leitura</td>
                  <td colspan="3">${fieldValue(formData.horarioLeitura)}</td>
                </tr>
                <tr>
                  <td class="vitals-label">Alerta</td>
                  <td colspan="3">${fieldValue(formData.alertaClinico)}</td>
                </tr>
              </table>
            </div>
            
            <!-- AVALIAÇÃO CLÍNICA -->
            <div class="section">
              <div class="section-title">Avaliação Clínica</div>
              <strong style="font-size: 10px;">Sintomas Observados:</strong>
              <div class="symptoms-box">
                ${formData.sintomas.length > 0 
                  ? formData.sintomas.map((s, i) => `${i > 0 ? ' • ' : ''}${s}`).join('')
                  : ''}
                ${formData.observacoesCena ? `<br>${formData.observacoesCena}` : ''}
              </div>
            </div>
            
            <!-- CONDUTA ADOTADA -->
            <div class="section">
              <div class="section-title">Conduta e destino</div>
              <div class="conduct-box">${fieldValue(formData.conduta)}</div>
            </div>

            <div class="section">
              <div class="section-title">Destino / entrega</div>
              <div class="info-line">
                <div class="info-label">Unidade:</div>
                <div class="info-value">${fieldValue(formData.unidadeDestino)}</div>
              </div>
              <div class="info-line">
                <div class="info-label">Recebedor:</div>
                <div class="info-value">${fieldValue(formData.recebedorHospital)}</div>
              </div>
              <div class="info-line">
                <div class="info-label">Horário:</div>
                <div class="info-value">${fieldValue(formData.horarioEntrega)}</div>
              </div>
            </div>
            
            <!-- ASSINATURA E RODAPÉ -->
            <div class="document-footer">
              <div class="signature-area">
                <div class="signature-line">
                  <strong>${socorrista?.nome || 'Profissional'}</strong><br>
                  Assinatura do Socorrista
                </div>
                <div class="signature-line">
                  Médico Responsável<br>
                </div>
              </div>
              <div class="footer">
                <div>PROJETI - Relatório de APH</div>
                <div style="text-align: right;">Informação confidencial - sigilo médico</div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      const result = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      await saveDraft({ silent: true, status: 'gerado' });

      Alert.alert('Sucesso', 'Relatório gerado com sucesso!', [
        {
          text: 'Compartilhar',
          onPress: async () => {
            try {
              if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(result.uri, {
                  mimeType: 'application/pdf',
                  // Note: Sharing API on Expo doesn't support filename directly
                  // The filename will be derived from the URI
                });
              } else {
                Alert.alert('Aviso', 'Compartilhamento não disponível neste dispositivo');
              }
            } catch (e) {
              console.error('Erro ao compartilhar:', e);
              Alert.alert('Erro', 'Não foi possível compartilhar o documento');
            }
          },
        },
        { text: 'OK' },
      ]);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      Alert.alert('Erro', 'Não foi possível gerar o relatório');
    }
  };

  const renderTriagemSection = () => (
    <ScrollView style={styles.sectionContent}>
      <Text style={styles.sectionTitle}>Selecione o Nível de Triagem</Text>
      <Text style={styles.sectionSubtitle}>Protocolo de Manchester - Classificação de Risco</Text>
      
      {manchesterProtocols.map((protocol) => (
        <TouchableOpacity
          key={protocol.id}
          style={[
            styles.triagemCard,
            { borderLeftColor: protocol.color },
            formData.triagem === protocol.id && styles.triagemCardSelected,
          ]}
          onPress={() => setFormData(prev => ({ ...prev, triagem: protocol.id }))}
        >
          <View style={[styles.triagemDot, { backgroundColor: protocol.color }]} />
          <View style={styles.triagemContent}>
            <Text style={styles.triagemLabel}>{protocol.label}</Text>
            <Text style={styles.triagemDescription}>{protocol.description}</Text>
          </View>
          {formData.triagem === protocol.id && (
            <MaterialCommunityIcons name="check-circle" size={24} color={protocol.color} />
          )}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderVitimaSection = () => (
    <ScrollView style={styles.sectionContent}>
      <View style={styles.accordion}>
        <TouchableOpacity
          style={styles.accordionHeader}
          onPress={() => toggleSection('vitima')}
        >
          <Text style={styles.accordionTitle}>Dados da Vítima</Text>
          <MaterialCommunityIcons
            name={expandedSections.vitima ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>
        
        {expandedSections.vitima && (
          <View style={styles.accordionContent}>
            <Text style={styles.inputLabel}>Nome da Vítima</Text>
            <TextInput
              style={styles.input}
              placeholder="Digite o nome"
              placeholderTextColor={colors.placeholder}
              value={formData.nomeVitima}
              onChangeText={(text) => setFormData(prev => ({ ...prev, nomeVitima: text }))}
            />

            <Text style={styles.inputLabel}>Tipo da Vítima</Text>
            <TextInput
              style={styles.input}
              placeholder="Adulto, criança ou recém-nascido"
              placeholderTextColor={colors.placeholder}
              value={formData.tipoVitima}
              onChangeText={(text) => setFormData(prev => ({ ...prev, tipoVitima: text }))}
            />
            
            <Text style={styles.inputLabel}>Idade (anos)</Text>
            <TextInput
              style={styles.input}
              placeholder="Digite a idade"
              placeholderTextColor={colors.placeholder}
              keyboardType="numeric"
              value={formData.idadeVitima}
              onChangeText={(text) => setFormData(prev => ({ ...prev, idadeVitima: text }))}
            />
            
            <Text style={styles.inputLabel}>Contato de Emergência</Text>
            <TextInput
              style={styles.input}
              placeholder="Telefone ou email"
              placeholderTextColor={colors.placeholder}
              value={formData.contatoEmergencia}
              onChangeText={(text) => setFormData(prev => ({ ...prev, contatoEmergencia: text }))}
            />
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderVitaisSection = () => (
    <ScrollView style={styles.sectionContent}>
      <View style={styles.accordion}>
        <TouchableOpacity
          style={styles.accordionHeader}
          onPress={() => toggleSection('vitais')}
        >
          <Text style={styles.accordionTitle}>Sinais Vitais</Text>
          <MaterialCommunityIcons
            name={expandedSections.vitais ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>
        
        {expandedSections.vitais && (
          <View style={styles.accordionContent}>
            <Text style={styles.inputLabel}>PA - Pressão Arterial (ex: 120/80)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 120/80 mmHg"
              placeholderTextColor={colors.placeholder}
              value={formData.pa}
              onChangeText={(text) => setFormData(prev => ({ ...prev, pa: text }))}
            />
            
            <Text style={styles.inputLabel}>FC - Frequência Cardíaca (bpm)</Text>
            <TextInput
              style={styles.input}
              placeholder="Batimentos por minuto"
              placeholderTextColor={colors.placeholder}
              keyboardType="numeric"
              value={formData.fc}
              onChangeText={(text) => setFormData(prev => ({ ...prev, fc: text }))}
            />
            
            <Text style={styles.inputLabel}>SpO₂ - Saturação de Oxigênio (%)</Text>
            <TextInput
              style={styles.input}
              placeholder="Percentual"
              placeholderTextColor={colors.placeholder}
              keyboardType="numeric"
              value={formData.spo2}
              onChangeText={(text) => setFormData(prev => ({ ...prev, spo2: text }))}
            />
            
            <Text style={styles.inputLabel}>Temperatura (°C)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 37.5"
              placeholderTextColor={colors.placeholder}
              keyboardType="decimal-pad"
              value={formData.temperatura}
              onChangeText={(text) => setFormData(prev => ({ ...prev, temperatura: text }))}
            />

            <Text style={styles.inputLabel}>Horário da leitura</Text>
            <TextInput
              style={styles.input}
              placeholder="Horário da última leitura"
              placeholderTextColor={colors.placeholder}
              value={formData.horarioLeitura}
              onChangeText={(text) => setFormData(prev => ({ ...prev, horarioLeitura: text }))}
            />

            <Text style={styles.inputLabel}>Alerta clínico associado</Text>
            <TextInput
              style={[styles.input, { minHeight: 70 }]}
              placeholder="Alerta clínico ativo ou observação dos sensores"
              placeholderTextColor={colors.placeholder}
              multiline
              textAlignVertical="top"
              value={formData.alertaClinico}
              onChangeText={(text) => setFormData(prev => ({ ...prev, alertaClinico: text }))}
            />
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderSintomasSection = () => (
    <ScrollView style={styles.sectionContent}>
      <View style={styles.accordion}>
        <TouchableOpacity
          style={styles.accordionHeader}
          onPress={() => toggleSection('sintomas')}
        >
          <Text style={styles.accordionTitle}>Sintomas Observados</Text>
          <MaterialCommunityIcons
            name={expandedSections.sintomas ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>
        
        {expandedSections.sintomas && (
          <View style={styles.accordionContent}>
            <Text style={styles.inputLabel}>Marque os sintomas observados:</Text>
            {commonSymptoms.map((symptom) => (
              <View key={symptom} style={styles.checkboxRow}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => toggleSymptom(symptom)}
                >
                  <MaterialCommunityIcons
                    name={formData.sintomas.includes(symptom) ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={24}
                    color={formData.sintomas.includes(symptom) ? colors.primary : colors.border}
                  />
                </TouchableOpacity>
                <Text style={styles.checkboxLabel}>{symptom}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderCondutaSection = () => (
    <ScrollView style={styles.sectionContent}>
      <View style={styles.accordion}>
        <TouchableOpacity
          style={styles.accordionHeader}
          onPress={() => toggleSection('conduta')}
        >
          <Text style={styles.accordionTitle}>Conduta Adotada</Text>
          <MaterialCommunityIcons
            name={expandedSections.conduta ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>
        
        {expandedSections.conduta && (
          <View style={styles.accordionContent}>
            <Text style={styles.inputLabel}>Observações da cena</Text>
            <TextInput
              style={[styles.input, { minHeight: 100 }]}
              placeholder="Ex: cena segura, familiares presentes, mecanismo do trauma, riscos no local..."
              placeholderTextColor={colors.placeholder}
              multiline
              textAlignVertical="top"
              value={formData.observacoesCena}
              onChangeText={(text) => setFormData(prev => ({ ...prev, observacoesCena: text }))}
            />

            <Text style={styles.inputLabel}>Descreva a conduta adotada</Text>
            <TextInput
              style={[styles.input, { minHeight: 150 }]}
              placeholder="Ex: Aplicado torniquete membro inferior direito, elevado membro, aguardando SAMU..."
              placeholderTextColor={colors.placeholder}
              multiline
              textAlignVertical="top"
              value={formData.conduta}
              onChangeText={(text) => setFormData(prev => ({ ...prev, conduta: text }))}
            />

            <Text style={styles.inputLabel}>Unidade de destino</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Hospital de Emergências de Macapá"
              placeholderTextColor={colors.placeholder}
              value={formData.unidadeDestino}
              onChangeText={(text) => setFormData(prev => ({ ...prev, unidadeDestino: text }))}
            />

            <Text style={styles.inputLabel}>Recebedor no hospital</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Enf. João Pereira"
              placeholderTextColor={colors.placeholder}
              value={formData.recebedorHospital}
              onChangeText={(text) => setFormData(prev => ({ ...prev, recebedorHospital: text }))}
            />

            <Text style={styles.inputLabel}>Horário da entrega</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 15:02"
              placeholderTextColor={colors.placeholder}
              value={formData.horarioEntrega}
              onChangeText={(text) => setFormData(prev => ({ ...prev, horarioEntrega: text }))}
            />
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderPreviewSection = () => {
    const triageInfo = getTriagemInfo(formData.triagem);
    return (
      <ScrollView style={styles.sectionContent} contentContainerStyle={styles.a4PreviewScroll}>
        <View style={styles.a4Page}>
          <View style={[styles.a4Severity, { backgroundColor: triageInfo.cor }]}>
            <Text style={styles.a4SeverityText}>{triageInfo.label}</Text>
            <Text style={styles.a4SeverityTime}>{triageInfo.tempo}</Text>
          </View>

          <View style={styles.a4Header}>
            <View>
              <Text style={styles.a4Brand}>PROJETI APH</Text>
              <Text style={styles.a4Subtitle}>Relatório de Atendimento Pré-Hospitalar</Text>
            </View>
            <View style={styles.a4HeaderMeta}>
              <Text style={styles.a4MetaText}>Protocolo: {ocorrencia?.protocolo ? `#${ocorrencia.protocolo}` : ''}</Text>
              <Text style={styles.a4MetaText}>Viatura: {getGuarnicaoLabel(ocorrencia) === 'Nao informada' ? '' : getGuarnicaoLabel(ocorrencia)}</Text>
              <Text style={styles.a4MetaText}>Socorrista: {socorrista?.nome || socorrista?.email || ''}</Text>
            </View>
          </View>

          <View style={styles.a4Section}>
            <Text style={styles.a4SectionTitle}>Identificação</Text>
            <PreviewLine label="Local" value={fieldValue(ocorrencia?.endereco_texto)} />
            <PreviewLine
              label="GPS"
              value={ocorrencia?.latitude && ocorrencia?.longitude ? `${ocorrencia.latitude.toFixed(4)}, ${ocorrencia.longitude.toFixed(4)}` : ''}
            />
            <PreviewLine label="Ocorrência" value={fieldValue(ocorrencia?.tipo_ocorrencia?.nome)} />
            <PreviewLine label="Status" value={fieldValue(ocorrencia?.status)} />
          </View>

          <View style={styles.a4Section}>
            <Text style={styles.a4SectionTitle}>Vítima</Text>
            <PreviewLine label="Nome" value={fieldValue(formData.nomeVitima)} />
            <PreviewLine label="Tipo" value={fieldValue(formData.tipoVitima)} />
            <PreviewLine label="Idade" value={fieldValue(formData.idadeVitima, ' anos')} />
            <PreviewLine label="Contato" value={fieldValue(formData.contatoEmergencia)} />
          </View>

          <View style={styles.a4Section}>
            <Text style={styles.a4SectionTitle}>Sinais vitais</Text>
            <View style={styles.a4VitalsTable}>
              <View style={styles.a4VitalsRow}>
                <Text style={styles.a4VitalsLabel}>PA</Text>
                <Text style={styles.a4VitalsValue}>{fieldValue(formData.pa, ' mmHg')}</Text>
                <Text style={styles.a4VitalsLabel}>FC</Text>
                <Text style={styles.a4VitalsValue}>{fieldValue(formData.fc, ' bpm')}</Text>
              </View>
              <View style={styles.a4VitalsRow}>
                <Text style={styles.a4VitalsLabel}>SpO₂</Text>
                <Text style={styles.a4VitalsValue}>{fieldValue(formData.spo2, ' %')}</Text>
                <Text style={styles.a4VitalsLabel}>Temp.</Text>
                <Text style={styles.a4VitalsValue}>{fieldValue(formData.temperatura, ' °C')}</Text>
              </View>
              <View style={styles.a4VitalsRow}>
                <Text style={styles.a4VitalsLabel}>Leitura</Text>
                <Text style={styles.a4VitalsWide}>{fieldValue(formData.horarioLeitura)}</Text>
              </View>
              <View style={styles.a4VitalsRow}>
                <Text style={styles.a4VitalsLabel}>Alerta</Text>
                <Text style={styles.a4VitalsWide}>{fieldValue(formData.alertaClinico)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.a4Section}>
            <Text style={styles.a4SectionTitle}>Avaliação clínica</Text>
            <Text style={styles.a4Box}>
              {formData.sintomas.length > 0 ? formData.sintomas.join(' • ') : ''}
              {formData.observacoesCena ? `\n${formData.observacoesCena}` : ''}
            </Text>
          </View>

          <View style={styles.a4Section}>
            <Text style={styles.a4SectionTitle}>Conduta e destino</Text>
            <Text style={styles.a4Box}>{fieldValue(formData.conduta)}</Text>
          </View>

          <View style={styles.a4PageNumber}>
            <Text style={styles.a4PageNumberText}>Página 1 de 2</Text>
          </View>
        </View>

        <View style={styles.a4Page}>
          <View style={styles.a4Section}>
            <Text style={styles.a4SectionTitle}>Destino / entrega da vítima</Text>
            <PreviewLine label="Unidade" value={fieldValue(formData.unidadeDestino)} />
            <PreviewLine label="Recebedor" value={fieldValue(formData.recebedorHospital)} />
            <PreviewLine label="Horário" value={fieldValue(formData.horarioEntrega)} />
          </View>

          <View style={styles.a4Section}>
            <Text style={styles.a4SectionTitle}>Resumo final do atendimento</Text>
            <Text style={styles.a4Box}>
              {ocorrencia?.protocolo || ocorrencia?.tipo_ocorrencia?.nome ? `Protocolo ${ocorrencia?.protocolo ? `#${ocorrencia.protocolo}` : ''} - ${ocorrencia?.tipo_ocorrencia?.nome || ''}.` : ''}
              {formData.nomeVitima || formData.tipoVitima ? `\nVítima: ${formData.nomeVitima || ''}${formData.nomeVitima && formData.tipoVitima ? ' / ' : ''}${formData.tipoVitima || ''}.` : ''}
              {ocorrencia?.status ? `\nStatus no momento do relatório: ${ocorrencia.status}.` : ''}
              {getGuarnicaoLabel(ocorrencia) !== 'Nao informada' ? `\nViatura: ${getGuarnicaoLabel(ocorrencia)}.` : ''}
            </Text>
          </View>

          <View style={styles.a4Section}>
            <Text style={styles.a4SectionTitle}>Observações de entrega</Text>
            <Text style={styles.a4Box}>
              {formData.unidadeDestino || formData.recebedorHospital || formData.horarioEntrega
                ? 'Entrega registrada conforme dados informados acima.'
                : ''}
            </Text>
          </View>

          <View style={styles.a4FooterPack}>
            <View style={styles.a4Signatures}>
              <View style={styles.a4SignatureLine}>
                <Text style={styles.a4SignatureName}>{socorrista?.nome || 'Profissional'}</Text>
                <Text style={styles.a4SignatureText}>Assinatura do Socorrista</Text>
              </View>
              <View style={styles.a4SignatureLine}>
                <Text style={styles.a4SignatureName}>{formatDateTime(new Date().toISOString())}</Text>
                <Text style={styles.a4SignatureText}>Data/hora de geração</Text>
              </View>
            </View>
            <View style={styles.a4Footer}>
              <Text style={styles.a4FooterText}>PROJETI - Relatório de APH</Text>
              <Text style={styles.a4FooterText}>Informação confidencial - sigilo médico</Text>
            </View>
          </View>

          <View style={styles.a4PageNumber}>
            <Text style={styles.a4PageNumberText}>Página 2 de 2</Text>
          </View>
        </View>
      </ScrollView>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <MaterialCommunityIcons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Relatório de APH</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.steps}>
          {['triagem', 'vitima', 'vitais', 'sintomas', 'conduta', 'preview'].map((step, idx) => (
            <View key={step} style={styles.stepContainer}>
              <View
                style={[
                  styles.stepCircle,
                  section === step && styles.stepCircleActive,
                  (['triagem', 'vitima', 'vitais', 'sintomas', 'conduta'].indexOf(section) >= idx) && styles.stepCircleCompleted,
                ]}
              >
                <Text style={styles.stepNumber}>{idx + 1}</Text>
              </View>
              {idx < 5 && <View style={styles.stepLine} />}
            </View>
          ))}
        </View>

        {section === 'triagem' && renderTriagemSection()}
        {section === 'vitima' && renderVitimaSection()}
        {section === 'vitais' && renderVitaisSection()}
        {section === 'sintomas' && renderSintomasSection()}
        {section === 'conduta' && renderCondutaSection()}
        {section === 'preview' && renderPreviewSection()}

        <View style={[styles.footer, section === 'preview' && styles.footerPreview]}>
          <TouchableOpacity
            style={[styles.draftButton, savingDraft && styles.buttonDisabled]}
            disabled={savingDraft}
            onPress={() => void saveDraft()}
          >
            <MaterialCommunityIcons name="content-save-outline" size={18} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.draftButtonText}>{savingDraft ? 'Salvando...' : 'Salvar rascunho'}</Text>
          </TouchableOpacity>

          {section === 'preview' && (
            <TouchableOpacity style={styles.generateButton} onPress={generatePDF}>
              <Text style={styles.generateButtonText}>Compartilhar PDF</Text>
            </TouchableOpacity>
          )}

          <View style={styles.footerNavigation}>
            <TouchableOpacity
              style={[styles.buttonSecondary, section === 'triagem' && styles.buttonDisabled]}
              disabled={section === 'triagem'}
              onPress={handlePrevious}
            >
              <MaterialCommunityIcons name="chevron-left" size={20} color={colors.text} />
              <Text style={styles.buttonText}>Anterior</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.buttonPrimary, section === 'preview' && styles.buttonDisabled]}
              disabled={section === 'preview'}
              onPress={handleNext}
            >
              <Text style={styles.buttonText}>Próximo</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function PreviewLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.a4Line}>
      <Text style={styles.a4LineLabel}>{label}</Text>
      <Text style={styles.a4LineValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  steps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.background,
  },
  stepContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  stepCircleCompleted: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  stepNumber: {
    color: colors.text,
    fontWeight: 'bold',
    fontSize: 14,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: 4,
  },
  sectionContent: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.placeholder,
    marginBottom: 16,
  },
  triagemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  triagemCardSelected: {
    backgroundColor: '#f8fafc',
  },
  triagemDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  triagemContent: {
    flex: 1,
  },
  triagemLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  triagemDescription: {
    fontSize: 12,
    color: colors.placeholder,
  },
  accordion: {
    backgroundColor: colors.card,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  accordionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  accordionContent: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.placeholder,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    marginBottom: 16,
    fontSize: 14,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  checkboxLabel: {
    marginLeft: 12,
    color: colors.text,
    fontSize: 14,
  },
  previewCard: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  previewSeverityBar: {
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
    alignItems: 'center',
  },
  previewSeverityText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  previewSeverityTime: {
    color: '#FFF',
    fontSize: 12,
    marginTop: 4,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: 10,
    marginBottom: 16,
    gap: 4,
  },
  summaryText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  previewSection: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  previewSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.placeholder,
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  previewSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  previewClinicalGrid: {
    gap: 12,
  },
  previewClinicalColumn: {
    width: '100%',
  },
  previewItem: {
    marginBottom: 8,
  },
  previewVitalItem: {
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.placeholder,
  },
  previewValue: {
    fontSize: 12,
    color: colors.text,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#ffffff',
    borderRadius: 4,
    flex: 1,
    marginLeft: 8,
  },
  previewFooter: {
    fontSize: 11,
    color: colors.success,
    marginTop: 12,
    padding: 8,
    backgroundColor: '#dcfce7',
    borderRadius: 4,
    fontWeight: '600',
  },
  a4PreviewScroll: {
    alignItems: 'center',
    paddingBottom: 20,
    gap: 16,
  },
  a4Page: {
    width: '100%',
    maxWidth: 360,
    aspectRatio: 1 / 1.414,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    overflow: 'hidden',
  },
  a4Severity: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  a4SeverityText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  a4SeverityTime: {
    color: '#ffffff',
    fontSize: 8,
    marginTop: 2,
    fontWeight: '700',
  },
  a4Header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#111827',
  },
  a4Brand: {
    color: '#111827',
    fontSize: 11,
    fontWeight: '900',
  },
  a4Subtitle: {
    color: '#111827',
    fontSize: 6,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  a4HeaderMeta: {
    alignItems: 'flex-end',
    flexShrink: 1,
  },
  a4MetaText: {
    color: '#111827',
    fontSize: 6,
    lineHeight: 9,
    textAlign: 'right',
  },
  a4Section: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
  },
  a4SectionTitle: {
    color: '#111827',
    fontSize: 7,
    fontWeight: '900',
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
    paddingBottom: 2,
    marginBottom: 4,
  },
  a4Line: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 1,
  },
  a4LineLabel: {
    width: 62,
    color: '#111827',
    fontSize: 7,
    fontWeight: '800',
  },
  a4LineValue: {
    flex: 1,
    color: '#111827',
    fontSize: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
    borderStyle: 'dotted',
    paddingBottom: 1,
  },
  a4VitalsTable: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: '#111827',
  },
  a4VitalsRow: {
    flexDirection: 'row',
  },
  a4VitalsLabel: {
    width: 48,
    color: '#111827',
    fontSize: 7,
    fontWeight: '900',
    padding: 3,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#111827',
  },
  a4VitalsValue: {
    flex: 1,
    color: '#111827',
    fontSize: 7,
    padding: 3,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#111827',
  },
  a4VitalsWide: {
    flex: 1,
    color: '#111827',
    fontSize: 7,
    padding: 3,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#111827',
  },
  a4Box: {
    minHeight: 28,
    color: '#111827',
    fontSize: 7,
    lineHeight: 10,
    borderWidth: 1,
    borderColor: '#111827',
    padding: 5,
  },
  a4FooterPack: {
    marginTop: 'auto',
  },
  a4Signatures: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 30,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 8,
  },
  a4SignatureLine: {
    width: 108,
    borderTopWidth: 1,
    borderTopColor: '#111827',
    alignItems: 'center',
    paddingTop: 3,
  },
  a4SignatureName: {
    color: '#111827',
    fontSize: 6,
    fontWeight: '800',
    textAlign: 'center',
  },
  a4SignatureText: {
    color: '#111827',
    fontSize: 6,
    textAlign: 'center',
  },
  a4Footer: {
    borderTopWidth: 1,
    borderTopColor: '#94a3b8',
    paddingHorizontal: 12,
    paddingVertical: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  a4FooterText: {
    color: '#334155',
    fontSize: 5,
  },
  a4PageNumber: {
    marginTop: 'auto',
    alignItems: 'center',
    paddingBottom: 6,
  },
  a4PageNumberText: {
    color: '#64748b',
    fontSize: 6,
    fontWeight: '700',
  },
  generateButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 8,
  },
  generateButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  draftButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
  },
  draftButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  footerPreview: {
    gap: 12,
  },
  footerNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  buttonSecondary: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonPrimary: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});


