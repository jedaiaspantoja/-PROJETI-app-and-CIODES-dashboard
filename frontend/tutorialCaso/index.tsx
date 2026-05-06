import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Speech from 'expo-speech';
import { supabase } from '../../backend/connectors/postgre';
import { cacheReferenceDataV2, executeOfflineSelect } from '../../backend/offline/offlineV2';

const colors = {
  background: '#0F172A',
  text: '#F9FAFB',
  secondary: '#9CA3AF',
  placeholder: '#6B7280',
  card: '#020617',
  primary: '#2563EB',
};

type StepUI = {
  texto: string;
};

function inferIsRealEmergency(routeParams: any): boolean {
  const p = routeParams || {};
  if (typeof p.is_treinamento === 'boolean') return !p.is_treinamento;
  if (typeof p.isTreinamento === 'boolean') return !p.isTreinamento;
  if (typeof p.mode === 'string') return p.mode === 'real-online' || p.mode === 'real-offline' || p.mode === 'real';
  return false;
}

function getFallbackSteps(title: string | undefined): StepUI[] {
  const nome = title || 'ocorrência';
  return [
    { texto: `Mantenha a calma e garanta a segurança do local antes de se aproximar da vítima de ${nome}.` },
    { texto: 'Acione ou aguarde o atendimento especializado. Não movimente a vítima sem necessidade.' },
    { texto: 'Observe respiração, consciência e sinais de agravamento. Siga as orientações do CIODES.' },
    { texto: 'Permaneça ao lado da vítima até a chegada da equipe de socorro, se for seguro.' },
  ];
}

export default function TutorialCaso({ route, navigation }: any) {
  const { tutorialId, tipoVitimaId, profile, title } = route?.params || {};

  const [steps, setSteps] = useState<StepUI[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const isRealEmergency = useMemo(() => inferIsRealEmergency(route?.params), [route?.params]);
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
    speak(steps[index]?.texto || '');
  }, [steps, index, speak]);

  useEffect(() => () => stopSpeech(), [stopSpeech]);

  useEffect(() => {
    async function carregar() {
      try {
        setLoading(true);

        if (!tutorialId) {
          setSteps(getFallbackSteps(title));
          return;
        }

        let query = supabase
          .from('tutorial_passos')
          .select('id, tutorial_id, texto, ordem, tipo_vitima_id, midia_url, midia_tipo')
          .eq('tutorial_id', tutorialId)
          .order('ordem', { ascending: true });

        const { data, error } = await query;

        if (error) {
          console.error('[TutorialCaso] Erro Supabase:', error);
          const offlineRows = await executeOfflineSelect<any>(
            `SELECT texto, tipo_vitima_id
             FROM tutorial_passos
             WHERE tutorial_id = ?
             ORDER BY ordem ASC`,
            [tutorialId]
          );
          const offlineFiltered = offlineRows.filter(
            (step) => !step.tipo_vitima_id || !tipoVitimaId || step.tipo_vitima_id === tipoVitimaId
          );
          setSteps(offlineFiltered.length ? offlineFiltered.map((s) => ({ texto: s.texto })) : getFallbackSteps(title));
          return;
        }

        const filtered = ((data as any[]) || []).filter(
          (step) => !step.tipo_vitima_id || !tipoVitimaId || step.tipo_vitima_id === tipoVitimaId
        );

        setSteps(filtered.length ? filtered.map((s) => ({ texto: s.texto })) : getFallbackSteps(title));
        await cacheReferenceDataV2({ passos: data || [] });
        setIndex(0);
        didAutoSpeakOnceRef.current = false;
      } catch (e) {
        console.error('[TutorialCaso] Erro inesperado:', e);
        setSteps(getFallbackSteps(title));
      } finally {
        setLoading(false);
      }
    }

    void carregar();
  }, [tutorialId, tipoVitimaId, title]);

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
        <Text style={styles.stepText}>Nenhum passo disponível para este perfil.</Text>
        <View style={{ marginTop: 16 }} />
        <Button title="Voltar" onPress={() => navigation.goBack()} color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title || 'Tutorial de Atendimento'}</Text>
      <Text style={styles.subtitle}>
        Perfil: {String(profile || 'vítima')}
        {isRealEmergency ? ' • Emergência real' : ''}
      </Text>

      <View style={styles.card}>
        <Text style={styles.stepTitle}>Passo {index + 1}</Text>
        <Text style={styles.stepText}>{atual.texto}</Text>
        <Text style={styles.stepCounter}>{index + 1} de {total}</Text>

        {!isRealEmergency && (
          <TouchableOpacity style={styles.ttsButton} onPress={toggleSpeak} activeOpacity={0.7}>
            <Text style={styles.ttsButtonText}>{isSpeaking ? 'Parar leitura' : 'Ler passo'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.buttons}>
        <Button title="Voltar" onPress={voltar} color={colors.secondary} />
        <Button title={index === total - 1 ? 'Finalizar' : 'Avançar'} onPress={avancar} color={colors.primary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 60,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: colors.placeholder,
    marginBottom: 24,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    marginBottom: 24,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    color: colors.text,
    textAlign: 'center',
  },
  stepText: {
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center',
    color: colors.text,
  },
  stepCounter: {
    marginTop: 16,
    fontSize: 14,
    color: colors.secondary,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  ttsButton: {
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  ttsButtonText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 16,
  },
});
