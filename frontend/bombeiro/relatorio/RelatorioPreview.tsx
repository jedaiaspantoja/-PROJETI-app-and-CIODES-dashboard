import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RelatorioContext } from './relatorioTypes';
import { formatDateTime } from './relatorioUtils';

type RelatorioPreviewProps = RelatorioContext;

export default function RelatorioPreview({
  formData,
  ocorrencia,
  relatos,
  triageInfo,
  addressText,
  gps,
  profissional,
}: RelatorioPreviewProps) {
  return (
    <View style={styles.documentPreview}>
      <View style={[styles.documentSeverity, { backgroundColor: triageInfo.color }]}>
        <Text style={styles.documentSeverityTitle}>{triageInfo.label}</Text>
        <Text style={styles.documentSeveritySub}>{triageInfo.tempo}</Text>
      </View>

      <View style={styles.documentHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.documentTitle}>Relatorio de Atendimento Pre-Hospitalar</Text>
          <Text style={styles.documentSubtitle}>PROJETI - Sistema de APH</Text>
        </View>
        <View style={styles.documentProtocolBox}>
          <Text style={styles.documentMeta}>Protocolo</Text>
          <Text style={styles.documentProtocol}>#{ocorrencia?.protocolo || 'N/A'}</Text>
          <Text style={styles.documentMeta}>Status: {ocorrencia?.status || 'N/A'}</Text>
        </View>
      </View>

      <DocumentSection title="1. Identificacao">
        <DocumentRow label="Aberta em" value={formatDateTime(ocorrencia?.criada_em)} label2="Profissional" value2={profissional} />
        <DocumentRow label="Tipo" value={ocorrencia?.tipo_ocorrencia?.nome || 'Nao especificado'} label2="Vitima" value2={ocorrencia?.tipo_vitima?.nome || 'Nao informado'} />
        <DocumentRow label="Solicitante" value={ocorrencia?.solicitante?.nome || 'Nao informado'} label2="Telefone" value2={ocorrencia?.solicitante?.telefone || 'Nao informado'} />
        <DocumentRow label="Endereco" value={addressText} />
        <DocumentRow label="GPS" value={gps} />
      </DocumentSection>

      <DocumentSection title="2. Dados da vitima">
        <DocumentRow label="Nome/identificacao" value={formData.nomeVitima || 'Nao informado'} label2="Idade" value2={formData.idadeVitima || 'N/A'} />
        <DocumentRow label="Sexo" value={formData.sexoVitima || 'N/A'} label2="Documento" value2={formData.documentoVitima || 'N/A'} />
        <DocumentRow label="Contato" value={formData.contatoEmergencia || 'N/A'} label2="Queixa principal" value2={formData.queixaPrincipal || 'N/A'} />
        <DocumentRow label="Alergias" value={formData.alergias || 'Nao informado'} label2="Medicamentos" value2={formData.medicamentos || 'Nao informado'} />
        <DocumentRow label="Historico clinico" value={formData.historicoClinico || 'Nao informado'} />
      </DocumentSection>

      <DocumentSection title="3. Avaliacao clinica">
        <View style={styles.documentGrid}>
          <View style={styles.documentGridCol}>
            <DocumentMiniRow label="PA" value={`${formData.pa || '-'} mmHg`} />
            <DocumentMiniRow label="FC" value={`${formData.fc || '-'} bpm`} />
            <DocumentMiniRow label="FR" value={`${formData.fr || '-'} irpm`} />
            <DocumentMiniRow label="SpO2" value={`${formData.spo2 || '-'}%`} />
          </View>
          <View style={styles.documentGridCol}>
            <DocumentMiniRow label="Temperatura" value={`${formData.temperatura || '-'} C`} />
            <DocumentMiniRow label="Glicemia" value={`${formData.glicemia || '-'} mg/dL`} />
            <DocumentMiniRow label="Dor" value={`${formData.dor || '-'} / 10`} />
            <DocumentMiniRow label="Consciencia" value={formData.consciencia || '-'} />
          </View>
        </View>
        <DocumentTextBox label={`Sintomas observados (${formData.horarioSinais || 'horario nao informado'})`} value={formData.sintomas.join(' - ') || 'Nenhum sintoma especifico marcado'} />
        <DocumentTextBox label="ABCDE" value={formData.abcde.join(' - ') || 'Sem marcacoes registradas'} />
      </DocumentSection>

      <DocumentSection title="4. Condutas e evolucao">
        <DocumentTextBox label="Condutas marcadas" value={formData.condutas.join(' - ') || 'Nenhuma conduta marcada'} />
        <DocumentTextBox label="Descricao da conduta" value={formData.conduta || 'Nenhuma descricao registrada'} />
        <DocumentTextBox label="Destino/finalizacao" value={formData.destino || 'Nao informado'} />
      </DocumentSection>

      <DocumentSection title="5. Historico de relatos">
        {relatos.length === 0 ? (
          <Text style={styles.documentEmptyText}>Nenhum relato anterior registrado.</Text>
        ) : (
          relatos.map((relato) => (
            <View key={relato.id} style={styles.documentReportItem}>
              <Text style={styles.documentReportMeta}>{formatDateTime(relato.criado_em)} - {relato.socorrista?.nome || 'Socorrista'}</Text>
              <Text style={styles.documentReportText}>{relato.texto}</Text>
            </View>
          ))
        )}
      </DocumentSection>

      <View style={styles.documentSignatures}>
        <View style={styles.documentSignature}>
          <Text style={styles.documentSignatureText}>{profissional}</Text>
          <Text style={styles.documentMeta}>Socorrista responsavel</Text>
        </View>
        <View style={styles.documentSignature}>
          <Text style={styles.documentSignatureText}>Responsavel pela vitima</Text>
          <Text style={styles.documentMeta}>Assinatura opcional</Text>
        </View>
        <View style={styles.documentSignature}>
          <Text style={styles.documentSignatureText}>Recebedor no destino</Text>
          <Text style={styles.documentMeta}>Assinatura/recebimento</Text>
        </View>
      </View>
    </View>
  );
}

function DocumentSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.documentSection}>
      <Text style={styles.documentSectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function DocumentRow({ label, value, label2, value2 }: { label: string; value: string; label2?: string; value2?: string }) {
  return (
    <View style={styles.documentRow}>
      <View style={styles.documentCellLabel}>
        <Text style={styles.documentLabelText}>{label}</Text>
      </View>
      <View style={styles.documentCellValue}>
        <Text style={styles.documentValueText}>{value}</Text>
      </View>
      {label2 ? (
        <>
          <View style={styles.documentCellLabel}>
            <Text style={styles.documentLabelText}>{label2}</Text>
          </View>
          <View style={styles.documentCellValue}>
            <Text style={styles.documentValueText}>{value2}</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

function DocumentMiniRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.documentMiniRow}>
      <Text style={styles.documentMiniLabel}>{label}</Text>
      <Text style={styles.documentMiniValue}>{value}</Text>
    </View>
  );
}

function DocumentTextBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.documentTextBlock}>
      <Text style={styles.documentTextLabel}>{label}</Text>
      <Text style={styles.documentTextValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  documentPreview: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  documentSeverity: { padding: 12, alignItems: 'center' },
  documentSeverityTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', textTransform: 'uppercase' },
  documentSeveritySub: { color: '#FFFFFF', fontSize: 12, marginTop: 3 },
  documentHeader: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderBottomWidth: 2,
    borderBottomColor: '#111827',
  },
  documentTitle: { color: '#111827', fontSize: 17, fontWeight: '900' },
  documentSubtitle: { color: '#4B5563', fontSize: 11, marginTop: 3 },
  documentProtocolBox: { alignItems: 'flex-end', maxWidth: 130 },
  documentProtocol: { color: '#111827', fontSize: 13, fontWeight: '900', marginVertical: 2 },
  documentMeta: { color: '#6B7280', fontSize: 9 },
  documentSection: { paddingHorizontal: 12, paddingTop: 12 },
  documentSectionTitle: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
    paddingBottom: 4,
    marginBottom: 6,
  },
  documentRow: {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderColor: '#CBD5E1',
  },
  documentCellLabel: {
    width: '25%',
    backgroundColor: '#F8FAFC',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#CBD5E1',
    padding: 6,
  },
  documentCellValue: {
    flex: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#CBD5E1',
    padding: 6,
  },
  documentLabelText: { color: '#111827', fontSize: 10, fontWeight: '900' },
  documentValueText: { color: '#111827', fontSize: 10, lineHeight: 14 },
  documentGrid: { flexDirection: 'row', gap: 8 },
  documentGridCol: { flex: 1 },
  documentMiniRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 4,
  },
  documentMiniLabel: {
    width: 86,
    backgroundColor: '#F8FAFC',
    color: '#111827',
    fontSize: 10,
    fontWeight: '900',
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: '#CBD5E1',
  },
  documentMiniValue: { flex: 1, color: '#111827', fontSize: 10, padding: 6 },
  documentTextBlock: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 7,
    marginTop: 6,
  },
  documentTextLabel: { color: '#111827', fontSize: 10, fontWeight: '900', marginBottom: 4 },
  documentTextValue: { color: '#111827', fontSize: 10, lineHeight: 15 },
  documentEmptyText: { color: '#4B5563', fontSize: 10, paddingVertical: 4 },
  documentReportItem: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 7,
    marginBottom: 6,
  },
  documentReportMeta: { color: '#374151', fontSize: 9, fontWeight: '900', marginBottom: 3 },
  documentReportText: { color: '#111827', fontSize: 10, lineHeight: 15 },
  documentSignatures: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingTop: 68,
    paddingBottom: 22,
    marginTop: 44,
  },
  documentSignature: {
    width: '28%',
    borderTopWidth: 1,
    borderTopColor: '#111827',
    alignItems: 'center',
    paddingTop: 6,
  },
  documentSignatureText: { color: '#111827', fontSize: 10, fontWeight: '700', textAlign: 'center' },
});
