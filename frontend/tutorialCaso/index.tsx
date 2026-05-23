import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useVideoPlayer, VideoView } from 'expo-video';
import { supabase } from '../../backend/connectors/postgre';
import { cacheReferenceDataV2, executeOfflineSelect } from '../../backend/offline/offlineV2';
import TopHeader from '../shared/TopHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../shared/theme';
import LoadingState from '../shared/LoadingState';

type StepUI = {
  texto: string;
  objetivo?: string;
  midia_url?: string | null;
  midia_tipo?: string | null;
  tipo_vitima_id?: number | string | null;
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

function normalizeMediaType(uri?: string | null, tipo?: string | null) {
  if (isVideoMedia(uri, tipo)) return 'video';
  const normalizedType = normalizeKey(tipo);
  if (normalizedType.includes('lottie')) return 'lottie';
  if (normalizedType.includes('image') || normalizedType.includes('imagem')) return 'imagem';
  return tipo || (uri ? 'imagem' : null);
}

function sameVictimType(stepVictimId?: number | string | null, tipoVitimaId?: number | string | null) {
  return !stepVictimId || !tipoVitimaId || String(stepVictimId) === String(tipoVitimaId);
}

function mapStepRow(row: any): StepUI {
  const mediaUrl = row.midia_url ?? row.midia_ref?.url ?? row.midia?.url ?? row.url ?? null;
  const mediaType = normalizeMediaType(mediaUrl, row.midia_tipo ?? row.midia_ref?.tipo ?? row.midia?.tipo ?? null);

  return {
    texto: row.texto,
    midia_url: mediaUrl,
    midia_tipo: mediaType,
    tipo_vitima_id: row.tipo_vitima_id ?? row.id_tipo_vitim ?? null,
  };
}

function toOfflinePasso(row: any, tutorialId: string | number) {
  return {
    id: String(row.id ?? row.id_step ?? `${tutorialId}-${row.ordem}`),
    tutorial_id: String(row.tutorial_id ?? row.id_tutorial ?? tutorialId),
    tipo_vitima_id: row.tipo_vitima_id ?? row.id_tipo_vitim ?? null,
    ordem: row.ordem ?? 0,
    texto: row.texto,
    midia_url: row.midia_url ?? row.midia_ref?.url ?? row.midia?.url ?? row.url ?? null,
    midia_tipo: normalizeMediaType(row.midia_url ?? row.midia_ref?.url ?? row.midia?.url ?? row.url ?? null, row.midia_tipo),
  };
}

async function loadRemoteTutorialSteps(tutorialId: string | number) {
  const { data, error } = await supabase
    .from('tutorial_passos')
    .select('id, tutorial_id, texto, ordem, tipo_vitima_id, midia_url, midia_tipo')
    .eq('tutorial_id', tutorialId)
    .order('ordem', { ascending: true });

  if (error) throw error;
  return (data || []) as any[];
}

async function loadOfflineTutorialSteps(tutorialId: string | number) {
  return executeOfflineSelect<any>(
    `SELECT id, tutorial_id, texto, ordem, tipo_vitima_id, midia_url, midia_tipo
     FROM tutorial_passos
     WHERE tutorial_id = ?
     ORDER BY ordem ASC`,
    [tutorialId]
  );
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
      console.warn('[TutorialCaso] Não foi possível iniciar o vídeo automaticamente:', error);
    }

    return () => {
      try {
        player.pause();
      } catch {
        // O expo-video pode liberar o objeto nativo antes do cleanup em trocas rápidas de passo.
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
    focus: 'Reconhecer sinais de engasgo e agir com segurança sem piorar a obstrução.',
    steps: [
      { objetivo: 'Reconhecer', texto: 'Observe se a pessoa consegue tossir, falar ou respirar. Se ela tosse com força, incentive a tosse e acompanhe de perto.' },
      { objetivo: 'Pedir ajuda', texto: 'Chame ajuda imediatamente e acione o serviço de emergência. Informe a suspeita de engasgo e a idade aproximada da vítima.' },
      { objetivo: 'Desobstruir', texto: 'Se a pessoa não consegue respirar nem falar, posicione-se atrás dela e faça compressões abdominais firmes, para dentro e para cima.' },
      { objetivo: 'Evitar dano', texto: 'Não coloque os dedos às cegas na boca. Remova apenas objetos visíveis e fáceis de alcançar.' },
      { objetivo: 'Se piorar', texto: 'Se a vítima perder a consciência, deite-a em superfície firme, acione ajuda novamente e inicie RCP se souber executar.' },
    ],
  },
  {
    key: 'rcp parada cardiorrespiratoria cardiorrespiratoria',
    icon: 'heart-pulse',
    imageUrl: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=900&q=80',
    focus: 'Identificar parada cardiorrespiratória, pedir ajuda e iniciar suporte básico até a equipe chegar.',
    steps: [
      { objetivo: 'Segurança', texto: 'Verifique se o local é seguro. Aproxime-se, toque nos ombros da pessoa e chame em voz alta para avaliar resposta.' },
      { objetivo: 'Respiração', texto: 'Observe o tórax por até 10 segundos. Se a pessoa não respira ou respira de forma anormal, trate como parada cardiorrespiratória.' },
      { objetivo: 'Acionar suporte', texto: 'Peça para alguém acionar a emergência e buscar um DEA, se houver. Se estiver sozinho, use o viva-voz antes de iniciar.' },
      { objetivo: 'Compressões', texto: 'Posicione as mãos no centro do tórax e faça compressões fortes e rápidas. Permita o retorno do peito entre elas.' },
      { objetivo: 'Continuar', texto: 'Continue até a equipe assumir, a vítima reagir, o DEA orientar outra ação ou o local deixar de ser seguro.' },
    ],
  },
  {
    key: 'afogamento',
    icon: 'water',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
    focus: 'Proteger o socorrista, retirar a vítima da água com segurança e avaliar a respiração.',
    steps: [
      { objetivo: 'Não virar vítima', texto: 'Não entre na água se isso colocar você em risco. Use boia, corda, galho, toalha ou outro objeto para aproximar apoio.' },
      { objetivo: 'Retirada', texto: 'Após retirar a pessoa da água, mantenha-a deitada e avalie rapidamente consciência e respiração.' },
      { objetivo: 'Chamar ajuda', texto: 'Acione a emergência e informe o local exato, o tempo aproximado de submersão e o estado da vítima.' },
      { objetivo: 'Respiração', texto: 'Se a vítima respira, coloque-a de lado se não houver suspeita forte de trauma. Mantenha-a aquecida e observe sinais de piora.' },
      { objetivo: 'Sem respiração', texto: 'Se não respira normalmente, inicie suporte básico/RCP se souber executar e siga as orientações recebidas por telefone.' },
    ],
  },
  {
    key: 'convulsao',
    icon: 'brain',
    imageUrl: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=900&q=80',
    focus: 'Proteger a pessoa durante a crise e reconhecer sinais de gravidade.',
    steps: [
      { objetivo: 'Proteger', texto: 'Afaste objetos duros, pontiagudos ou quentes. Apoie a cabeça com algo macio, sem segurar o corpo à força.' },
      { objetivo: 'Cronometrar', texto: 'Marque o tempo da crise. Essa informação ajuda muito a equipe de atendimento.' },
      { objetivo: 'Não fazer', texto: 'Não coloque nada na boca e não ofereça água, comida ou remédio durante a crise.' },
      { objetivo: 'Depois da crise', texto: 'Quando os movimentos cessarem, deixe a pessoa de lado se estiver respirando e acompanhe até recuperar a orientação.' },
      { objetivo: 'Emergência', texto: 'Acione ajuda se a crise durar mais de 5 minutos, repetir em sequência, houver trauma, gravidez, diabetes, afogamento ou se for a primeira crise conhecida.' },
    ],
  },
  {
    key: 'trauma queda colisao corte',
    icon: 'kit-medical',
    imageUrl: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&w=900&q=80',
    focus: 'Controlar riscos imediatos sem movimentar a vítima desnecessariamente.',
    steps: [
      { objetivo: 'Cena segura', texto: 'Avalie trânsito, eletricidade, fogo, queda de objetos e violência. Só se aproxime se o local for seguro.' },
      { objetivo: 'Não mover', texto: 'Evite movimentar a vítima, principalmente se houver queda, colisão, dor no pescoço, formigamento ou confusão.' },
      { objetivo: 'Sangramento', texto: 'Se houver sangramento intenso, pressione o local com pano limpo ou gaze, mantendo pressão contínua.' },
      { objetivo: 'Consciência', texto: 'Converse com a vítima e observe respiração, cor da pele, nível de consciência e dor. Anote mudanças.' },
      { objetivo: 'Aguardar com ação', texto: 'Mantenha a vítima aquecida, sinalize o local e informe ao socorro o mecanismo do trauma e o que mudou desde o início.' },
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
      focus: 'Treinar avaliação inicial, acionamento correto e acompanhamento seguro.',
      steps: [
        { objetivo: 'Segurança', texto: 'Antes de agir, confirme se o ambiente está seguro para você, para a vítima e para outras pessoas ao redor.' },
        { objetivo: 'Avaliar', texto: 'Tente conversar com a vítima. Observe respiração, consciência, sangramentos e sinais de piora.' },
        { objetivo: 'Acionar ajuda', texto: 'Ligue para a emergência e informe local, tipo de ocorrência, quantidade de vítimas e riscos presentes.' },
        { objetivo: 'Acompanhar', texto: 'Permaneça por perto se for seguro, reavalie a vítima e atualize a equipe sobre qualquer mudança.' },
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
  const nome = title || 'ocorrência';
  return [
    { objetivo: 'Segurança', texto: `Mantenha a calma e garanta a segurança do local antes de se aproximar da vítima de ${nome}.` },
    { objetivo: 'Ajuda', texto: 'Acione ou aguarde o atendimento especializado. Não movimente a vítima sem necessidade.' },
    { objetivo: 'Observação', texto: 'Observe respiração, consciência e sinais de agravamento. Siga as orientações do CIODES.' },
    { objetivo: 'Acompanhamento', texto: 'Permaneça ao lado da vítima até a chegada da equipe de socorro, se for seguro.' },
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

        let rows: any[] = [];

        try {
          rows = await loadRemoteTutorialSteps(tutorialId);
        } catch (error) {
          console.warn('[TutorialCaso] Não foi possível buscar tutorial_passos no Supabase, usando cache offline:', error);
          rows = await loadOfflineTutorialSteps(tutorialId);
        }

        const mapped = rows.filter((step) => sameVictimType(step.tipo_vitima_id ?? step.id_tipo_vitim, tipoVitimaId)).map(mapStepRow);

        if (!isRealEmergency && isWeakTrainingContent(mapped)) {
          setSteps(guide.steps);
        } else {
          setSteps(mapped.length ? mapped : isRealEmergency ? getRealEmergencyFallbackSteps(title) : guide.steps);
        }

        await cacheReferenceDataV2({ passos: rows.map((row) => toOfflinePasso(row, tutorialId)) });
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
    const currentStep = steps[index];
    if (isVideoMedia(currentStep?.midia_url, currentStep?.midia_tipo)) return;

    if (!didAutoSpeakOnceRef.current) {
      didAutoSpeakOnceRef.current = true;
      speak(currentStep?.texto || '');
      return;
    }

    speak(currentStep?.texto || '');
  }, [isRealEmergency, loading, steps, index, speak]);

  if (loading) {
    return (
      <LoadingState
        title="Preparando tutorial"
        subtitle="Organizando passos, mídias e orientação por voz."
        icon="book-medical"
      />
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
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
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
        <Text style={styles.stepText}>Nenhum passo disponível para este perfil.</Text>
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
            <Text style={styles.subtitle}>{isRealEmergency ? 'Emergência real' : guide.focus}</Text>
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
    borderRadius: colors.radiusMd,
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
    borderRadius: colors.radiusMd,
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
    borderRadius: colors.radiusLg,
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
    marginTop: 16,
    marginHorizontal: 16,
    color: colors.success,
    fontSize: 16,
    fontWeight: '800',
  },
  stepText: {
    marginTop: 10,
    marginHorizontal: 16,
    marginBottom: 18,
    fontSize: 16,
    lineHeight: 24,
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
    borderRadius: colors.radiusSm,
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
    borderRadius: colors.radiusSm,
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

