import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from '../../backend/connectors/postgre';
import RelatorioPreview from './relatorio/RelatorioPreview';
import { abcdeOptions, colors, conductOptions, manchesterProtocols, sections, symptomOptions } from './relatorio/relatorioConstants';
import { buildRelatorioHtml } from './relatorio/relatorioHtml';
import { FormularioStatus, RelatorioData, Section } from './relatorio/relatorioTypes';
import {
  buildReportPayload,
  createInitialRelatorioData,
  formatDateTime,
  formatReverseAddress,
  getAddressText,
  getGpsText,
  getProfissionalName,
  getTriageInfo,
  validateReport,
} from './relatorio/relatorioUtils';

interface RelatorioPDFProps {
  visible: boolean;
  onClose: () => void;
  ocorrencia: any;
  socorrista: any;
  relatos?: any[];
}

export default function RelatorioPDF({ visible, onClose, ocorrencia, socorrista, relatos = [] }: RelatorioPDFProps) {
  const [section, setSection] = useState<Section>('triagem');
  const [loadingSavedReport, setLoadingSavedReport] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [formData, setFormData] = useState<RelatorioData>(() => createInitialRelatorioData(ocorrencia));

  const triageInfo = useMemo(() => getTriageInfo(formData.triagem), [formData.triagem]);
  const addressText = getAddressText(ocorrencia, resolvedAddress, resolvingAddress);
  const gps = getGpsText(ocorrencia);
  const profissional = getProfissionalName(socorrista);

  useEffect(() => {
    async function loadSavedReport() {
      if (!visible || !ocorrencia?.id) return;

      setLoadingSavedReport(true);
      try {
        const { data, error } = await supabase
          .from('formularios_ocorrencia')
          .select('dados_json, atualizado_em')
          .eq('ocorrencia_id', ocorrencia.id)
          .maybeSingle();

        if (error) {
          console.error('[RelatorioPDF] Erro ao carregar relatorio salvo:', error);
          return;
        }

        const savedFormData = (data?.dados_json as any)?.formData;
        if (savedFormData) {
          setFormData((prev) => ({ ...prev, ...savedFormData }));
          setLastSavedAt(data?.atualizado_em || null);
        }
      } finally {
        setLoadingSavedReport(false);
      }
    }

    void loadSavedReport();
  }, [visible, ocorrencia?.id]);

  useEffect(() => {
    async function resolveAddressFromCoordinates() {
      if (!visible || ocorrencia?.endereco_texto || ocorrencia?.latitude == null || ocorrencia?.longitude == null) return;

      setResolvingAddress(true);
      try {
        const results = await Location.reverseGeocodeAsync({
          latitude: Number(ocorrencia.latitude),
          longitude: Number(ocorrencia.longitude),
        });

        const formattedAddress = results[0] ? formatReverseAddress(results[0]) : '';
        setResolvedAddress(formattedAddress || null);
      } catch (error) {
        console.error('[RelatorioPDF] Erro ao converter coordenadas em endereco:', error);
        setResolvedAddress(null);
      } finally {
        setResolvingAddress(false);
      }
    }

    void resolveAddressFromCoordinates();
  }, [visible, ocorrencia?.endereco_texto, ocorrencia?.latitude, ocorrencia?.longitude]);

  function updateField<K extends keyof RelatorioData>(field: K, value: RelatorioData[K]) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function toggleList(field: 'sintomas' | 'abcde' | 'condutas', value: string) {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((item) => item !== value)
        : [...prev[field], value],
    }));
  }

  function goNext() {
    const currentIdx = sections.indexOf(section);
    if (currentIdx < sections.length - 1) setSection(sections[currentIdx + 1]);
  }

  function goPrevious() {
    const currentIdx = sections.indexOf(section);
    if (currentIdx > 0) setSection(sections[currentIdx - 1]);
  }

  async function saveReport(status: FormularioStatus, options?: { silent?: boolean }) {
    if (!ocorrencia?.id) {
      Alert.alert('Erro', 'Nao foi possivel identificar a ocorrencia para salvar o relatorio.');
      return false;
    }

    setSavingReport(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('formularios_ocorrencia')
        .upsert(
          {
            ocorrencia_id: ocorrencia.id,
            status,
            dados_json: buildReportPayload({ status, formData, ocorrencia, relatos, resolvedAddress }),
            gerado_por: socorrista?.id || null,
            atualizado_em: now,
          },
          { onConflict: 'ocorrencia_id' }
        );

      if (error) {
        console.error('[RelatorioPDF] Erro ao salvar relatorio:', error);
        Alert.alert('Erro', 'Nao foi possivel salvar o relatorio no banco.');
        return false;
      }

      setLastSavedAt(now);
      if (!options?.silent) {
        Alert.alert('Salvo', status === 'gerado' ? 'Relatorio salvo como gerado.' : 'Rascunho do relatorio salvo.');
      }
      return true;
    } finally {
      setSavingReport(false);
    }
  }

  async function generatePDF() {
    const validationError = validateReport(formData, ocorrencia);
    if (validationError) {
      Alert.alert('Relatorio incompleto', validationError);
      return;
    }

    try {
      const htmlContent = buildRelatorioHtml({
        formData,
        ocorrencia,
        socorrista,
        relatos,
        triageInfo,
        addressText,
        gps,
        profissional,
      });
      const result = await Print.printToFileAsync({ html: htmlContent, base64: false });
      const saved = await saveReport('gerado', { silent: true });

      Alert.alert('Sucesso', saved ? 'Relatorio gerado e salvo com sucesso.' : 'PDF gerado, mas o relatorio nao foi salvo.', [
        {
          text: 'Compartilhar',
          onPress: async () => {
            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf' });
            } else {
              Alert.alert('Aviso', 'Compartilhamento nao disponivel neste dispositivo.');
            }
          },
        },
        { text: 'OK' },
      ]);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      Alert.alert('Erro', 'Nao foi possivel gerar o relatorio.');
    }
  }

  function renderTriagem() {
    return (
      <ScrollView style={styles.sectionContent}>
        <Text style={styles.sectionTitle}>Classificacao de risco</Text>
        <Text style={styles.sectionSubtitle}>Selecione o nivel de triagem usado no atendimento.</Text>
        {manchesterProtocols.map((protocol) => (
          <TouchableOpacity
            key={protocol.id}
            style={[styles.optionCard, { borderLeftColor: protocol.color }, formData.triagem === protocol.id && styles.optionSelected]}
            onPress={() => updateField('triagem', protocol.id)}
          >
            <View style={[styles.optionDot, { backgroundColor: protocol.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>{protocol.label}</Text>
              <Text style={styles.optionDescription}>{protocol.description} - {protocol.tempo}</Text>
            </View>
            {formData.triagem === protocol.id ? <MaterialCommunityIcons name="check-circle" size={22} color={protocol.color} /> : null}
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }

  function renderVitima() {
    return (
      <ScrollView style={styles.sectionContent}>
        <Text style={styles.sectionTitle}>Dados da vitima</Text>
        <Field label="Nome/identificacao" value={formData.nomeVitima} onChangeText={(text) => updateField('nomeVitima', text)} />
        <View style={styles.row}>
          <Field label="Idade" value={formData.idadeVitima} keyboardType="numeric" onChangeText={(text) => updateField('idadeVitima', text)} />
          <Field label="Sexo" value={formData.sexoVitima} onChangeText={(text) => updateField('sexoVitima', text)} />
        </View>
        <Field label="Documento" value={formData.documentoVitima} onChangeText={(text) => updateField('documentoVitima', text)} />
        <Field label="Contato de emergencia" value={formData.contatoEmergencia} onChangeText={(text) => updateField('contatoEmergencia', text)} />
        <Field label="Queixa principal" value={formData.queixaPrincipal} multiline onChangeText={(text) => updateField('queixaPrincipal', text)} />
        <Field label="Alergias conhecidas" value={formData.alergias} onChangeText={(text) => updateField('alergias', text)} />
        <Field label="Medicamentos em uso" value={formData.medicamentos} onChangeText={(text) => updateField('medicamentos', text)} />
        <Field label="Historico clinico relevante" value={formData.historicoClinico} multiline onChangeText={(text) => updateField('historicoClinico', text)} />
      </ScrollView>
    );
  }

  function renderVitais() {
    return (
      <ScrollView style={styles.sectionContent}>
        <Text style={styles.sectionTitle}>Sinais vitais</Text>
        <View style={styles.row}>
          <Field label="PA" placeholder="120/80" value={formData.pa} onChangeText={(text) => updateField('pa', text)} />
          <Field label="FC" placeholder="bpm" keyboardType="numeric" value={formData.fc} onChangeText={(text) => updateField('fc', text)} />
        </View>
        <View style={styles.row}>
          <Field label="FR" placeholder="irpm" keyboardType="numeric" value={formData.fr} onChangeText={(text) => updateField('fr', text)} />
          <Field label="SpO2" placeholder="%" keyboardType="numeric" value={formData.spo2} onChangeText={(text) => updateField('spo2', text)} />
        </View>
        <View style={styles.row}>
          <Field label="Temperatura" placeholder="37.0" keyboardType="decimal-pad" value={formData.temperatura} onChangeText={(text) => updateField('temperatura', text)} />
          <Field label="Glicemia" placeholder="mg/dL" keyboardType="numeric" value={formData.glicemia} onChangeText={(text) => updateField('glicemia', text)} />
        </View>
        <View style={styles.row}>
          <Field label="Dor (0-10)" keyboardType="numeric" value={formData.dor} onChangeText={(text) => updateField('dor', text)} />
          <Field label="Horario" value={formData.horarioSinais} onChangeText={(text) => updateField('horarioSinais', text)} />
        </View>
        <Field label="Nivel de consciencia" placeholder="Alerta, verbal, dor, inconsciente..." value={formData.consciencia} onChangeText={(text) => updateField('consciencia', text)} />
      </ScrollView>
    );
  }

  function renderAvaliacao() {
    return (
      <ScrollView style={styles.sectionContent}>
        <Text style={styles.sectionTitle}>Avaliacao clinica</Text>
        <Text style={styles.groupTitle}>Sintomas observados</Text>
        <ChipGrid options={symptomOptions} selected={formData.sintomas} onToggle={(item) => toggleList('sintomas', item)} />
        <Text style={styles.groupTitle}>ABCDE</Text>
        {Object.entries(abcdeOptions).map(([group, options]) => (
          <View key={group} style={styles.groupBlock}>
            <Text style={styles.groupLabel}>{group.toUpperCase()}</Text>
            <ChipGrid options={options} selected={formData.abcde} onToggle={(item) => toggleList('abcde', item)} />
          </View>
        ))}
      </ScrollView>
    );
  }

  function renderConduta() {
    return (
      <ScrollView style={styles.sectionContent}>
        <Text style={styles.sectionTitle}>Conduta e evolucao</Text>
        <Text style={styles.groupTitle}>Condutas realizadas</Text>
        <ChipGrid options={conductOptions} selected={formData.condutas} onToggle={(item) => toggleList('condutas', item)} />
        <Field label="Descricao da conduta" value={formData.conduta} multiline large onChangeText={(text) => updateField('conduta', text)} />
        <Field label="Destino/finalizacao" placeholder="Ex: entregue ao SAMU, removida ao hospital..." value={formData.destino} multiline onChangeText={(text) => updateField('destino', text)} />
      </ScrollView>
    );
  }

  function renderPreview() {
    return (
      <ScrollView style={styles.sectionContent}>
        {loadingSavedReport ? <Text style={styles.savedInfo}>Carregando relatorio salvo...</Text> : null}
        {lastSavedAt ? <Text style={styles.savedInfo}>Ultimo salvamento: {formatDateTime(lastSavedAt)}</Text> : null}

        <RelatorioPreview
          formData={formData}
          ocorrencia={ocorrencia}
          socorrista={socorrista}
          relatos={relatos}
          triageInfo={triageInfo}
          addressText={addressText}
          gps={gps}
          profissional={profissional}
        />

        <TouchableOpacity style={styles.generateButton} onPress={generatePDF}>
          <MaterialCommunityIcons name="file-pdf-box" size={20} color="#FFF" style={{ marginRight: 8 }} />
          <Text style={styles.generateButtonText}>{savingReport ? 'Salvando...' : 'Gerar, salvar e compartilhar PDF'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveDraftButton} disabled={savingReport} onPress={() => void saveReport('rascunho')}>
          <MaterialCommunityIcons name="content-save-outline" size={20} color={colors.primary} style={{ marginRight: 8 }} />
          <Text style={styles.saveDraftButtonText}>{savingReport ? 'Salvando...' : 'Salvar rascunho'}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <MaterialCommunityIcons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Relatorio de APH</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.steps}>
          {sections.map((step, idx) => {
            const currentIdx = sections.indexOf(section);
            const isDone = idx < currentIdx;
            const isActive = step === section;
            return (
              <View key={step} style={styles.stepContainer}>
                <View style={[styles.stepCircle, isActive && styles.stepCircleActive, isDone && styles.stepCircleDone]}>
                  <Text style={styles.stepNumber}>{idx + 1}</Text>
                </View>
                {idx < sections.length - 1 ? <View style={[styles.stepLine, isDone && styles.stepLineDone]} /> : null}
              </View>
            );
          })}
        </View>

        {section === 'triagem' && renderTriagem()}
        {section === 'vitima' && renderVitima()}
        {section === 'vitais' && renderVitais()}
        {section === 'avaliacao' && renderAvaliacao()}
        {section === 'conduta' && renderConduta()}
        {section === 'preview' && renderPreview()}

        <View style={styles.footer}>
          <TouchableOpacity style={[styles.buttonSecondary, section === 'triagem' && styles.buttonDisabled]} disabled={section === 'triagem'} onPress={goPrevious}>
            <MaterialCommunityIcons name="chevron-left" size={20} color={colors.text} />
            <Text style={styles.buttonText}>Anterior</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.buttonPrimary, section === 'preview' && styles.buttonDisabled]} disabled={section === 'preview'} onPress={goNext}>
            <Text style={styles.buttonText}>Proximo</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  large,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  multiline?: boolean;
  large?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.textArea, large && styles.largeTextArea]}
        placeholder={placeholder || label}
        placeholderTextColor={colors.placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

function ChipGrid({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (item: string) => void }) {
  return (
    <View style={styles.chipGrid}>
      {options.map((item) => {
        const active = selected.includes(item);
        return (
          <TouchableOpacity key={item} style={[styles.chip, active && styles.chipActive]} onPress={() => onToggle(item)}>
            <MaterialCommunityIcons name={active ? 'checkbox-marked' : 'checkbox-blank-outline'} size={18} color={active ? '#FFF' : colors.placeholder} />
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{item}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text },
  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  stepContainer: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  stepCircleDone: { borderColor: colors.success, backgroundColor: colors.success },
  stepNumber: { color: colors.text, fontWeight: '800', fontSize: 13 },
  stepLine: { flex: 1, height: 2, backgroundColor: colors.border, marginHorizontal: 4 },
  stepLineDone: { backgroundColor: colors.success },
  sectionContent: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 6 },
  sectionSubtitle: { fontSize: 14, color: colors.placeholder, marginBottom: 16 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionSelected: { backgroundColor: '#172554', borderColor: colors.primary },
  optionDot: { width: 14, height: 14, borderRadius: 7, marginRight: 12 },
  optionTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  optionDescription: { color: colors.placeholder, fontSize: 12, marginTop: 3 },
  row: { flexDirection: 'row', gap: 12 },
  field: { flex: 1, marginBottom: 14 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: colors.placeholder, marginBottom: 7 },
  input: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
  },
  textArea: { minHeight: 78 },
  largeTextArea: { minHeight: 140 },
  groupTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 10, marginBottom: 10 },
  groupBlock: { marginBottom: 10 },
  groupLabel: { color: colors.placeholder, fontSize: 12, fontWeight: '800', marginBottom: 6 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#FFF' },
  generateButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 8,
  },
  generateButtonText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  saveDraftButton: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 8,
  },
  saveDraftButtonText: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  savedInfo: { color: colors.placeholder, fontSize: 12, marginBottom: 8 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 10,
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
  buttonText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  buttonDisabled: { opacity: 0.5 },
});
