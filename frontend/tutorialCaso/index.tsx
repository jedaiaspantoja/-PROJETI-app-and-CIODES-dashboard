import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useVideoPlayer, VideoView } from 'expo-video';
import { supabase } from '../../backend/connectors/postgre';
import { cacheReferenceDataV2, executeOfflineSelect } from '../../backend/offline/offlineV2';
import TopHeader from '../shared/TopHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const colors = {
  background: '#0F172A',
  text: '#F9FAFB',
  secondary: '#CBD5E1',
  placeholder: '#94A3B8',
  card: '#020617',
  cardSoft: '#111827',
  primary: '#2563EB',
  success: '#22C55E',
  warning: '#F59E0B',
  border: '#1E293B',
};

type StepUI = {
  texto: string;
  objetivo?: string;
  midia_url?: string | null;
  midia_tipo?: string | null;
};

type TrainingGuide = {
  key: string;
  icon: string;
  imageUrl: string;
  focus: string;
  steps: StepUI[];
};

function inferIsRealEmergency(routeParams: any): boolean {
  const p = routeParams || {};
  if (typeof p.is_treinamento === 'boolean') return !p.is_treinamento;
  if (typeof p.isTreinamento === 'boolean') return !p.isTreinamento;
  if (typeof p.mode === 'string') return p.mode === 'real-online' || p.mode === 'real-offline' || p.mode === 'real';
  return false;
}

function normalizeKey(value?: string | null) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
function isVideoMedia(uri?: string | null, tipo?: string | null) {
  const normalizedType = normalizeKey(tipo);
  const normalizedUri = String(uri || '').toLowerCase().split('?')[0];
  return normalizedType.includes('video') || /\.(mp4|mov|m4v|webm)$/.test(normalizedUri);
}

function StepMedia({ uri, tipo }: { uri: string; tipo?: string | null }) {
  const isVideo = isVideoMedia(uri, tipo);
  const player = useVideoPlayer(isVideo ? { uri } : null, (instance) => {
    instance.loop = false;
    instance.muted = false;
  });

  useEffect(() => {
    if (!isVideo) return undefined;

    try {
      player.currentTime = 0;
      player.play();
    } catch (error) {
      console.warn('[TutorialCaso] Nao foi possivel iniciar o video automaticamente:', error);
    }

    return () => {
      try {
        player.pause();
      } catch {
        // O expo-video pode liberar o objeto nativo antes do cleanup em trocas rapidas de passo.
      }
    };
  }, [isVideo, player, uri]);

  if (isVideo) {
    return (
      <VideoView
        style={styles.stepMedia}
        player={player}
        nativeControls
        fullscreenOptions={{ enable: true }}
        contentFit="contain"
      />
    );
  }

  return <Image source={{ uri }} style={styles.stepMedia} resizeMode="cover" />;
}

const TRAINING_GUIDES: TrainingGuide[] = [
  {
    key: 'engasgo',
    icon: 'lungs',
    imageUrl: 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=900&q=80',
    focus: 'Reconhecer obstrucao de vias aereas e agir sem piorar a situacao.',
    steps: [
      { objetivo: 'Reconhecer', texto: 'Observe se a pessoa consegue tossir, falar ou respirar. Se ela tosse forte, incentive a tossir e acompanhe de perto.' },
      { objetivo: 'Pedir ajuda', texto: 'Chame ajuda imediatamente e acione o servico de emergencia. Informe que ha suspeita de engasgo e diga a idade aproximada da vitima.' },
      { objetivo: 'Desobstruir', texto: 'Se a pessoa nao respira nem fala, posicione-se atras dela e realize compressoes abdominais firmes, para dentro e para cima, ate o objeto sair ou a vitima perder a consciencia.' },
      { objetivo: 'Evitar dano', texto: 'Nao coloque o dedo as cegas na boca. Remova apenas objeto visivel e facil de alcancar.' },
      { objetivo: 'Se piorar', texto: 'Se a vitima desmaiar, deite-a em superficie firme, acione ajuda novamente e inicie o protocolo de RCP se souber executar.' },
    ],
  },
  {
    key: 'rcp parada cardiorrespiratoria cardiorrespiratoria',
    icon: 'heart-pulse',
    imageUrl: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=900&q=80',
    focus: 'Identificar parada, pedir ajuda e iniciar suporte basico ate a equipe chegar.',
    steps: [
      { objetivo: 'Seguranca', texto: 'Verifique se o local e seguro. Aproxime-se, toque nos ombros da pessoa e chame em voz alta para avaliar resposta.' },
      { objetivo: 'Respiracao', texto: 'Observe o peito por ate 10 segundos. Se nao respira ou respira de forma anormal, trate como parada cardiorrespiratoria.' },
      { objetivo: 'Acionar suporte', texto: 'Peça para alguem ligar para a emergencia e buscar um DEA, se houver. Se estiver sozinho, acione o viva-voz antes de iniciar.' },
      { objetivo: 'Compressao', texto: 'Com as maos no centro do torax, faca compressoes fortes e rapidas, permitindo o retorno do peito entre elas. Evite interrupcoes.' },
      { objetivo: 'DEA', texto: 'Se houver DEA, ligue o aparelho e siga as instrucoes de voz. Continue ate a equipe assumir, a vitima reagir ou o local deixar de ser seguro.' },
    ],
  },
  {
    key: 'afogamento',
    icon: 'water',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
    focus: 'Proteger o socorrista, retirar da agua com seguranca e avaliar respiracao.',
    steps: [
      { objetivo: 'Nao virar vitima', texto: 'Nao entre na agua se isso colocar voce em risco. Use boia, corda, galho, toalha ou outro objeto para aproximar apoio.' },
      { objetivo: 'Retirada', texto: 'Ao retirar a pessoa, mantenha-a deitada e avalie rapidamente consciencia e respiracao.' },
      { objetivo: 'Chamar ajuda', texto: 'Acione a emergencia e informe local exato, tempo aproximado de submersao e estado da vitima.' },
      { objetivo: 'Respiracao', texto: 'Se respira, coloque de lado se nao houver suspeita forte de trauma e mantenha aquecida. Observe piora.' },
      { objetivo: 'Sem respiracao', texto: 'Se nao respira normalmente, inicie suporte basico/RCP se souber executar e siga as orientacoes do atendimento por telefone.' },
    ],
  },
  {
    key: 'convulsao',
    icon: 'brain',
    imageUrl: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=900&q=80',
    focus: 'Proteger a pessoa durante a crise e reconhecer sinais de gravidade.',
    steps: [
      { objetivo: 'Proteger', texto: 'Afaste objetos duros, pontiagudos ou quentes. Apoie a cabeca com algo macio, sem segurar o corpo a forca.' },
      { objetivo: 'Cronometrar', texto: 'Marque o tempo da crise. Essa informacao ajuda muito a equipe de atendimento.' },
      { objetivo: 'Nao fazer', texto: 'Nao coloque nada na boca, nao ofereca agua, comida ou remedio durante a crise.' },
      { objetivo: 'Depois da crise', texto: 'Quando os movimentos cessarem, deixe a pessoa de lado se estiver respirando e acompanhe ate recuperar orientacao.' },
      { objetivo: 'Emergencia', texto: 'Acione ajuda se durar mais de 5 minutos, repetir em sequencia, houver trauma, gravidez, diabetes, afogamento ou se for a primeira crise conhecida.' },
    ],
  },
  {
    key: 'trauma queda colisao corte',
    icon: 'kit-medical',
    imageUrl: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&w=900&q=80',
    focus: 'Controlar riscos imediatos sem movimentar a vitima desnecessariamente.',
    steps: [
      { objetivo: 'Cena segura', texto: 'Avalie transito, eletricidade, fogo, queda de objetos e violencia. So se aproxime se for seguro.' },
      { objetivo: 'Nao mover', texto: 'Evite movimentar a vitima, principalmente se houver queda, colisao, dor no pescoco, formigamento ou confusao.' },
      { objetivo: 'Sangramento', texto: 'Se houver sangramento intenso, pressione o local com pano limpo ou gaze, mantendo pressao continua.' },
      { objetivo: 'Consciencia', texto: 'Converse com a vitima, observe respiracao, cor da pele, nivel de consciencia e dor. Anote mudancas.' },
      { objetivo: 'Aguardar com acao', texto: 'Mantenha a vitima aquecida, sinalize o local e transmita ao socorro o mecanismo do trauma e o que mudou desde o inicio.' },
    ],
  },
];

function getTrainingGuide(title?: string, codigo?: string): TrainingGuide {
  const key = `${normalizeKey(codigo)} ${normalizeKey(title)}`;
  return (
    TRAINING_GUIDES.find((guide) => guide.key.split(' ').some((token) => token && key.includes(token))) ||
    {
      key: 'geral',
      icon: 'hand-holding-medical',
      imageUrl: 'https://images.unsplash.com/photo-1584362917165-526a968579e8?auto=format&fit=crop&w=900&q=80',
      focus: 'Treinar avaliacao inicial, acionamento correto e acompanhamento seguro.',
      steps: [
        { objetivo: 'Seguranca', texto: 'Antes de agir, confirme se o ambiente esta seguro para voce, para a vitima e para outras pessoas.' },
        { objetivo: 'Avaliar', texto: 'Tente conversar com a vitima, observe respiracao, consciencia, sangramentos e sinais de piora.' },
        { objetivo: 'Acionar ajuda', texto: 'Ligue para a emergencia e informe local, tipo de ocorrencia, quantidade de vitimas e riscos presentes.' },
        { objetivo: 'Acompanhar', texto: 'Permaneça por perto se for seguro, reavalie a vitima e atualize a equipe sobre qualquer mudanca.' },
      ],
    }
  );
}

function isWeakTrainingContent(steps: StepUI[]) {
  if (steps.some((step) => step.midia_url)) return false;
  if (steps.length < 4) return true;
  const joined = steps.map((s) => s.texto).join(' ').toLowerCase();
  return joined.includes('aguarde o atendimento') || joined.includes('permaneça ao lado') || joined.includes('permanece ao lado');
}

function getRealEmergencyFallbackSteps(title: string | undefined): StepUI[] {
  const nome = title || 'ocorrencia';
  return [
    { objetivo: 'Seguranca', texto: `Mantenha a calma e garanta a seguranca do local antes de se aproximar da vitima de ${nome}.` },
    { objetivo: 'Ajuda', texto: 'Acione ou aguarde o atendimento especializado. Nao movimente a vitima sem necessidade.' },
    { objetivo: 'Observacao', texto: 'Observe respiracao, consciencia e sinais de agravamento. Siga as orientacoes do CIODES.' },
    { objetivo: 'Acompanhamento', texto: 'Permaneça ao lado da vitima ate a chegada da equipe de socorro, se for seguro.' },
  ];
}

export default function TutorialCaso({ route, navigation }: any) {
  const { tutorialId, tipoVitimaId, title, codigo, protocolo, ocorrenciaId } = route?.params || {};

  const [steps, setSteps] = useState<StepUI[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const insets = useSafeAreaInsets();

  const isRealEmergency = useMemo(() => inferIsRealEmergency(route?.params), [route?.params]);
  const guide = useMemo(() => getTrainingGuide(title, codigo), [title, codigo]);
  const didAutoSpeakOnceRef = useRef(false);

  const stopSpeech = useCallback(() => {
    try {
      Speech.stop();
    } finally {
      setIsSpeaking(false);
    }
  }, []);

  const speak = useCallback(
    (text: string) => {
      const t = (text || '').trim();
      if (!t) return;

      stopSpeech();
      setIsSpeaking(true);
      Speech.speak(t, {
        language: 'pt-BR',
        pitch: 1,
        rate: 0.95,
        onDone: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    },
    [stopSpeech]
  );

  const speakCurrentStep = useCallback(() => {
    if (!steps.length) return;
    const step = steps[index];
    speak(`${step?.objetivo ? `${step.objetivo}. ` : ''}${step?.texto || ''}`);
  }, [steps, index, speak]);

  useEffect(() => () => stopSpeech(), [stopSpeech]);

  useEffect(() => {
    async function carregar() {
      try {
        setLoading(true);

        if (!tutorialId) {
          setSteps(isRealEmergency ? getRealEmergencyFallbackSteps(title) : guide.steps);
          return;
        }

        const { data, error } = await supabase
          .from('tutorial_passos')
          .select('id, tutorial_id, texto, ordem, tipo_vitima_id, midia_url, midia_tipo')
          .eq('tutorial_id', tutorialId)
          .order('ordem', { ascending: true });

        if (error) {
          console.error('[TutorialCaso] Erro Supabase:', error);
          const offlineRows = await executeOfflineSelect<any>(
            `SELECT texto, tipo_vitima_id, midia_url, midia_tipo
             FROM tutorial_passos
             WHERE tutorial_id = ?
             ORDER BY ordem ASC`,
            [tutorialId]
          );
          const offlineFiltered = offlineRows.filter(
            (step) => !step.tipo_vitima_id || !tipoVitimaId || step.tipo_vitima_id === tipoVitimaId
          );
          const mapped = offlineFiltered.map((s) => ({
            texto: s.texto,
            midia_url: s.midia_url ?? null,
            midia_tipo: s.midia_tipo ?? null,
          }));
          setSteps(!isRealEmergency && isWeakTrainingContent(mapped) ? guide.steps : mapped.length ? mapped : getRealEmergencyFallbackSteps(title));
          return;
        }

        const filtered = ((data as any[]) || []).filter(
          (step) => !step.tipo_vitima_id || !tipoVitimaId || step.tipo_vitima_id === tipoVitimaId
        );
        const mapped = filtered.map((s) => ({
          texto: s.texto,
          midia_url: s.midia_url ?? null,
          midia_tipo: s.midia_tipo ?? null,
        }));

        if (!isRealEmergency && isWeakTrainingContent(mapped)) {
          setSteps(guide.steps);
        } else {
          setSteps(mapped.length ? mapped : isRealEmergency ? getRealEmergencyFallbackSteps(title) : guide.steps);
        }

        await cacheReferenceDataV2({ passos: data || [] });
        setIndex(0);
        didAutoSpeakOnceRef.current = false;
      } catch (e) {
        console.error('[TutorialCaso] Erro inesperado:', e);
        setSteps(isRealEmergency ? getRealEmergencyFallbackSteps(title) : guide.steps);
      } finally {
        setLoading(false);
      }
    }

    void carregar();
  }, [tutorialId, tipoVitimaId, title, guide, isRealEmergency]);

  useEffect(() => {
    if (!isRealEmergency || loading || !steps.length) return;

    if (!didAutoSpeakOnceRef.current) {
      didAutoSpeakOnceRef.current = true;
      speak(steps[0]?.texto || '');
      return;
    }

    speak(steps[index]?.texto || '');
  }, [isRealEmergency, loading, steps, index, speak]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 12, color: colors.secondary }}>Carregando tutorial...</Text>
      </View>
    );
  }

  const total = steps.length;
  const atual = total > 0 ? steps[index] : null;
  const mediaUri = atual?.midia_url || (!isRealEmergency ? guide.imageUrl : null);
  const mediaTipo = atual?.midia_url ? atual.midia_tipo : 'imagem';

  const avancar = () => {
    if (index < total - 1) {
      setIndex((v) => v + 1);
      stopSpeech();
    } else {
      stopSpeech();
      navigation.goBack();
    }
  };

  const voltar = () => {
    if (index > 0) {
      setIndex((v) => v - 1);
      stopSpeech();
    } else {
      stopSpeech();
      navigation.goBack();
    }
  };

  const toggleSpeak = () => {
    if (!total) return;
    if (isSpeaking) stopSpeech();
    else speakCurrentStep();
  };

  if (!atual) {
    return (
      <View style={styles.center}>
        <Text style={styles.stepText}>Nenhum passo disponivel para este perfil.</Text>
        <View style={{ marginTop: 16 }} />
        <Button title="Voltar" onPress={() => navigation.goBack()} color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopHeader title={isRealEmergency ? 'Instruções' : 'Treinamento'} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {isRealEmergency && (protocolo || ocorrenciaId) ? (
          <View style={styles.protocolBox}>
            <Text style={styles.protocolLabel}>Chamado aberto</Text>
            <Text style={styles.protocolValue}>Protocolo: {protocolo || ocorrenciaId}</Text>
          </View>
        ) : null}

        <View style={styles.headerRow}>
          <View style={styles.iconBadge}>
            <FontAwesome6 name={(guide.icon as any) || 'hand-holding-medical'} size={22} color={colors.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title || 'Tutorial de Atendimento'}</Text>
            <Text style={styles.subtitle}>{isRealEmergency ? 'Emergencia real' : guide.focus}</Text>
          </View>
        </View>

        <View style={styles.card}>
          {mediaUri ? <StepMedia key={`${index}-${mediaUri}`} uri={mediaUri} tipo={mediaTipo} /> : null}

          <View style={styles.stepHeader}>
            <Text style={styles.stepTitle}>Passo {index + 1}</Text>
            <Text style={styles.stepCounter}>{index + 1} de {total}</Text>
          </View>

          {atual.objetivo ? <Text style={styles.objective}>{atual.objetivo}</Text> : null}
          <Text style={styles.stepText}>{atual.texto}</Text>

          {!isRealEmergency && (
            <TouchableOpacity style={styles.ttsButton} onPress={toggleSpeak} activeOpacity={0.7}>
              <FontAwesome6 name={isSpeaking ? 'pause' : 'volume-high'} size={15} color={colors.primary} />
              <Text style={styles.ttsButtonText}>{isSpeaking ? 'Parar leitura' : 'Ler passo'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <View style={[styles.buttons, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <TouchableOpacity style={styles.secondaryButton} onPress={voltar}>
          <FontAwesome6 name="arrow-left" size={15} color={colors.secondary} />
          <Text style={styles.secondaryButtonText}>Voltar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} onPress={avancar}>
          <Text style={styles.primaryButtonText}>{index === total - 1 ? 'Finalizar' : 'Avancar'}</Text>
          <FontAwesome6 name={index === total - 1 ? 'check' : 'arrow-right'} size={15} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 24,
  },
  protocolBox: {
    width: '100%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.card,
    padding: 12,
    marginBottom: 16,
  },
  protocolLabel: {
    color: colors.secondary,
    fontSize: 12,
    marginBottom: 3,
  },
  protocolValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  headerRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.placeholder,
    marginTop: 4,
    lineHeight: 19,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  stepMedia: {
    width: '100%',
    height: 210,
    backgroundColor: colors.cardSoft,
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  stepCounter: {
    fontSize: 13,
    color: colors.secondary,
  },
  objective: {
    marginTop: 14,
    marginHorizontal: 18,
    color: colors.success,
    fontSize: 15,
    fontWeight: '800',
  },
  stepText: {
    marginTop: 8,
    marginHorizontal: 18,
    marginBottom: 18,
    fontSize: 18,
    lineHeight: 27,
    color: colors.text,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButtonText: {
    color: colors.secondary,
    fontSize: 15,
    fontWeight: '800',
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  ttsButton: {
    marginHorizontal: 18,
    marginBottom: 18,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  ttsButtonText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 15,
  },
});
