import React, { useState } from 'react';
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
  idadeVitima: string;
  contatoEmergencia: string;
  
  // Sinais Vitais
  pa: string;
  fc: string;
  spo2: string;
  temperatura: string;
  
  // Sintomas
  sintomas: string[];
  
  // Conduta
  conduta: string;
};

interface RelatorioPDFProps {
  visible: boolean;
  onClose: () => void;
  ocorrencia: any;
  socorrista: any;
}

export default function RelatorioPDF({ visible, onClose, ocorrencia, socorrista }: RelatorioPDFProps) {
  const [section, setSection] = useState<'triagem' | 'vitima' | 'vitais' | 'sintomas' | 'conduta' | 'preview'>('triagem');
  
  const [formData, setFormData] = useState<RelatorioData>({
    triagem: '',
    nomeVitima: ocorrencia?.vitima_nome || ocorrencia?.tipo_vitima?.nome || '',
    idadeVitima: resolveVictimAge(ocorrencia),
    contatoEmergencia: ocorrencia?.solicitante?.telefone || '',
    pa: '',
    fc: '',
    spo2: '',
    temperatura: '',
    sintomas: [],
    conduta: '',
  });

  const [expandedSections, setExpandedSections] = useState({
    vitima: false,
    vitais: false,
    sintomas: false,
    conduta: false,
  });

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
            
            /* DUAS COLUNAS */
            .two-columns {
              display: flex;
              gap: 20px;
            }
            
            .column {
              flex: 1;
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
              width: 45%;
              background-color: #f0f0f0;
            }
            
            .vitals-value {
              font-weight: bold;
              width: 55%;
            }
            
            /* DADOS DA VÍTIMA */
            .victim-data {
              font-size: 10px;
              margin-top: 6px;
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
            
            /* RODAPÉ */
            .footer {
              width: 100%;
              margin-top: auto;
              padding: 7px 16px 0;
              font-size: 8px;
              border-top: 1px solid #999;
              display: flex;
              justify-content: space-between;
              align-items: center;
              background: #FFFFFF;
              page-break-inside: avoid;
              page-break-before: avoid;
            }
            
            .signature-area {
              display: flex;
              justify-content: center;
              gap: 32px;
              margin-top: 14px;
              font-size: 9px;
            }
            
            .signature-line {
              border-top: 1px solid #000;
              width: 150px;
              text-align: center;
              padding-top: 4px;
              line-height: 1.3;
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
                <div class="institution-name">PROJETI - SISTEMA DE APH</div>
                <div class="document-title">Relatório de Atendimento Pré-Hospitalar</div>
              </div>
              <div class="header-right">
                <div><strong>Data:</strong> ${dateStr}</div>
                <div><strong>Hora:</strong> ${timeStr}</div>
                <div class="protocol-number">Protocolo: #${ocorrencia?.protocolo || 'N/A'}</div>
              </div>
            </div>
            
            <!-- DADOS DA OCORRÊNCIA E PROFISSIONAL -->
            <div class="section">
              <div class="section-title">Identificação</div>
              <div class="info-line">
                <div class="info-label">Profissional:</div>
                <div class="info-value">${socorrista?.email || 'Não identificado'}</div>
              </div>
              <div class="info-line">
                <div class="info-label">Local:</div>
                <div class="info-value">${ocorrencia?.endereco_texto || 'Não informado'}</div>
              </div>
              <div class="info-line">
                <div class="info-label">Localização GPS:</div>
                <div class="info-value">${ocorrencia?.latitude && ocorrencia?.longitude ? `${ocorrencia.latitude}, ${ocorrencia.longitude}` : 'Não registrado'}</div>
              </div>
              <div class="info-line">
                <div class="info-label">Tipo de Ocorrência:</div>
                <div class="info-value">${ocorrencia?.tipo_ocorrencia?.nome || 'Não especificado'}</div>
              </div>
            </div>
            
            <!-- DADOS DA VÍTIMA E SINAIS VITAIS -->
            <div class="section">
              <div class="section-title">Dados Clínicos</div>
              <div class="two-columns">
                <div class="column">
                  <strong style="font-size: 10px;">DADOS DA VÍTIMA</strong>
                  <div class="victim-data">
                    <div><strong>Nome/Tipo:</strong> ${formData.nomeVitima || 'Não informado'}</div>
                    <div><strong>Idade:</strong> ${formData.idadeVitima || 'N/A'} anos</div>
                    <div><strong>Contato Emergência:</strong> ${formData.contatoEmergencia || 'N/A'}</div>
                  </div>
                </div>
                <div class="column">
                  <strong style="font-size: 10px;">SINAIS VITAIS</strong>
                  <table class="vitals-table">
                    <tr>
                      <td class="vitals-label">Pressão Arterial (PA)</td>
                      <td class="vitals-value">${formData.pa || '-'} mmHg</td>
                    </tr>
                    <tr>
                      <td class="vitals-label">Frequência Cardíaca (FC)</td>
                      <td class="vitals-value">${formData.fc || '-'} bpm</td>
                    </tr>
                    <tr>
                      <td class="vitals-label">Saturação O₂ (SpO₂)</td>
                      <td class="vitals-value">${formData.spo2 || '-'} %</td>
                    </tr>
                    <tr>
                      <td class="vitals-label">Temperatura (T)</td>
                      <td class="vitals-value">${formData.temperatura || '-'} °C</td>
                    </tr>
                  </table>
                </div>
              </div>
            </div>
            
            <!-- AVALIAÇÃO CLÍNICA -->
            <div class="section">
              <div class="section-title">Avaliação Clínica</div>
              <strong style="font-size: 10px;">Sintomas Observados:</strong>
              <div class="symptoms-box">
                ${formData.sintomas.length > 0 
                  ? formData.sintomas.map((s, i) => `${i > 0 ? ' • ' : ''}${s}`).join('')
                  : 'Nenhum sintoma específico marcado'}
              </div>
            </div>
            
            <!-- CONDUTA ADOTADA -->
            <div class="section">
              <div class="section-title">Conduta e Evolução</div>
              <div class="conduct-box">${formData.conduta || '(Nenhuma conduta registrada)'}</div>
            </div>
            
            <!-- ASSINATURA -->
            <div style="padding: 10px 20px 12px; text-align: center; page-break-inside: avoid;">
              <div class="signature-area">
                <div class="signature-line">
                  <strong>${socorrista?.email || 'Profissional'}</strong><br>
                  Assinatura do Socorrista
                </div>
                <div class="signature-line">
                  ${dateStr}<br>
                  Data e Hora
                </div>
              </div>
            </div>
            
            <!-- RODAPÉ -->
            <div class="footer">
              <div>Documento gerado automaticamente pelo sistema PROJETI</div>
              <div style="text-align: right;">Informação confidencial - Protegida por lei de sigilo médico</div>
            </div>
          </div>
        </body>
        </html>
      `;

      const result = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

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
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderPreviewSection = () => {
    const triageInfo = getTriagemInfo(formData.triagem);
    return (
      <ScrollView style={styles.sectionContent}>
        {/* PREVIEW VISUAL */}
        <View style={[styles.previewCard, { borderTopWidth: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }]}>
          {/* Faixa de Gravidade */}
          <View style={[
            styles.previewSeverityBar,
            {
              backgroundColor: triageInfo.cor
            }
          ]}>
            <Text style={styles.previewSeverityText}>{triageInfo.label}</Text>
            <Text style={styles.previewSeverityTime}>{triageInfo.tempo}</Text>
          </View>

          <Text style={styles.previewTitle}>📋 Prévia do Documento</Text>
          
          <View style={styles.previewSection}>
            <Text style={styles.previewSectionTitle}>IDENTIFICAÇÃO</Text>
            <View style={styles.previewItem}>
              <Text style={styles.previewLabel}>Protocolo:</Text>
              <Text style={styles.previewValue}>#{ocorrencia?.protocolo || 'N/A'}</Text>
            </View>
            <View style={styles.previewItem}>
              <Text style={styles.previewLabel}>Local:</Text>
              <Text style={styles.previewValue}>{ocorrencia?.endereco_texto || 'Não informado'}</Text>
            </View>
            <View style={styles.previewItem}>
              <Text style={styles.previewLabel}>GPS:</Text>
              <Text style={styles.previewValue}>
                {ocorrencia?.latitude && ocorrencia?.longitude 
                  ? `${ocorrencia.latitude.toFixed(4)}, ${ocorrencia.longitude.toFixed(4)}`
                  : 'Não registrado'}
              </Text>
            </View>
          </View>

          <View style={styles.previewSection}>
            <Text style={styles.previewSectionTitle}>DADOS CLÍNICOS</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.previewSubtitle}>VÍTIMA</Text>
                <View style={styles.previewItem}>
                  <Text style={styles.previewLabel}>Nome:</Text>
                  <Text style={styles.previewValue}>{formData.nomeVitima || 'N/A'}</Text>
                </View>
                <View style={styles.previewItem}>
                  <Text style={styles.previewLabel}>Idade:</Text>
                  <Text style={styles.previewValue}>{formData.idadeVitima || 'N/A'} anos</Text>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.previewSubtitle}>SINAIS VITAIS</Text>
                <View style={styles.previewVitalItem}>
                  <Text style={styles.previewLabel}>PA:</Text>
                  <Text style={styles.previewValue}>{formData.pa || '-'} mmHg</Text>
                </View>
                <View style={styles.previewVitalItem}>
                  <Text style={styles.previewLabel}>FC:</Text>
                  <Text style={styles.previewValue}>{formData.fc || '-'} bpm</Text>
                </View>
                <View style={styles.previewVitalItem}>
                  <Text style={styles.previewLabel}>SpO₂:</Text>
                  <Text style={styles.previewValue}>{formData.spo2 || '-'} %</Text>
                </View>
                <View style={styles.previewVitalItem}>
                  <Text style={styles.previewLabel}>T:</Text>
                  <Text style={styles.previewValue}>{formData.temperatura || '-'} °C</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.previewSection}>
            <Text style={styles.previewSectionTitle}>AVALIAÇÃO CLÍNICA</Text>
            <View style={styles.previewItem}>
              <Text style={styles.previewLabel}>Sintomas:</Text>
              <Text style={styles.previewValue}>
                {formData.sintomas.length > 0 ? formData.sintomas.join(' • ') : 'Nenhum'}
              </Text>
            </View>
          </View>

          <View style={styles.previewSection}>
            <Text style={styles.previewSectionTitle}>CONDUTA E EVOLUÇÃO</Text>
            <Text style={[styles.previewValue, { marginTop: 8, minHeight: 40 }]}>
              {formData.conduta || '(Nenhuma conduta registrada)'}
            </Text>
          </View>

          <Text style={styles.previewFooter}>
            ✓ Documento em preto e branco com faixa de gravidade colorida
          </Text>
        </View>
        
        <TouchableOpacity style={styles.generateButton} onPress={generatePDF}>
          <MaterialCommunityIcons name="file-pdf-box" size={20} color="#FFF" style={{ marginRight: 8 }} />
          <Text style={styles.generateButtonText}>Gerar e Compartilhar PDF</Text>
        </TouchableOpacity>
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

        <View style={styles.footer}>
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
    </Modal>
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
  generateButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 8,
  },
  generateButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: colors.background,
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


