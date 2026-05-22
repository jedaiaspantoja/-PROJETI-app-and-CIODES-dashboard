import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { supabase } from '../../backend/connectors/postgre';
import { cacheReferenceDataV2, executeOfflineSelect } from '../../backend/offline/offlineV2';
import TopHeader from '../shared/TopHeader';
import { colors } from '../shared/theme';
import { useResponsiveLayout } from '../shared/responsive';
import LoadingState from '../shared/LoadingState';

type FlowMode = 'training' | 'real-online' | 'real-offline' | string;

type ListaCasosParams = {
  mode?: FlowMode;
  userLocation?: unknown;
  isTreinamento?: boolean;
  dataOcorrenciaISO?: string;
};

type ListaCasosProps = {
  navigation: {
    navigate: (screen: 'TipoVitima', params: Record<string, unknown>) => void;
    goBack: () => void;
  };
  route?: {
    params?: ListaCasosParams;
  };
};

type Caso = {
  id: number;
  codigo: string;
  title: string;
  description: string;
  tutorialId: string | null;
};

type TutorialRef = {
  id: string;
  ativo: boolean | null;
};

type TipoOcorrenciaRow = {
  id: number;
  codigo: string;
  nome: string | null;
  descricao: string | null;
  tutoriais: TutorialRef[] | TutorialRef | null;
};

type IconName = React.ComponentProps<typeof FontAwesome6>['name'];

type TrainingMeta = {
  icon: IconName;
  focus: string;
  duration: string;
};

const trainingMeta: Record<string, TrainingMeta> = {
  engasgo: {
    icon: 'lungs',
    focus: 'Reconhecer engasgo, pedir ajuda e aplicar manobras sem colocar a mão às cegas na boca.',
    duration: '5 passos',
  },
  rcp: {
    icon: 'heart-pulse',
    focus: 'Verificar resposta e respiração, acionar suporte, iniciar compressões e usar DEA se disponível.',
    duration: '5 passos',
  },
  afogamento: {
    icon: 'water',
    focus: 'Evitar risco ao socorrista, retirar com segurança, avaliar respiração e aquecer a vítima.',
    duration: '5 passos',
  },
  convulsao: {
    icon: 'brain',
    focus: 'Proteger durante a crise, cronometrar a duração e reconhecer quando acionar emergência.',
    duration: '5 passos',
  },
  trauma: {
    icon: 'kit-medical',
    focus: 'Controlar riscos da cena, evitar movimentação indevida e lidar com sangramento intenso.',
    duration: '5 passos',
  },
};

const defaultTrainingMeta: TrainingMeta = {
  icon: 'hand-holding-medical',
  focus: 'Treinar avaliação inicial, acionamento correto e acompanhamento seguro da vítima.',
  duration: 'Treino guiado',
};

function getTrainingMeta(codigo: string): TrainingMeta {
  return trainingMeta[codigo.toLowerCase()] || defaultTrainingMeta;
}

function resolveFlowMode(params: ListaCasosParams) {
  const mode = params.mode || (params.isTreinamento ? 'training' : 'real-online');
  const isModoReal = mode === 'real-online' || mode === 'real-offline';
  const isTreinamento = mode === 'training' || (!isModoReal && params.isTreinamento === true);

  return {
    mode,
    isModoReal,
    isTreinamento,
  };
}

export default function ListaCasos({ navigation, route }: ListaCasosProps) {
  const layout = useResponsiveLayout();
  const params = route?.params || {};
  const { mode, isModoReal, isTreinamento } = resolveFlowMode(params);
  const { userLocation, dataOcorrenciaISO } = params;

  const [casos, setCasos] = useState<Caso[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from('tipos_ocorrencia')
          .select(
            `
            id,
            codigo,
            nome,
            descricao,
            tutoriais (
              id,
              ativo
            )
          `
          )
          .eq('ativo', true)
          .order('ordem', { ascending: true });

        if (error) {
          console.error('[ListaCasos] Erro Supabase:', error);
          const offlineRows = await executeOfflineSelect<{
            id: number;
            codigo: string;
            nome: string;
            descricao: string | null;
            tutorial_id: string | null;
          }>(
            `SELECT o.id, o.codigo, o.nome, o.descricao, t.id AS tutorial_id
             FROM tipos_ocorrencia o
             LEFT JOIN tutoriais t ON t.tipo_ocorrencia_id = o.id AND t.ativo = 1
             WHERE o.ativo = 1
             ORDER BY o.ordem ASC`
          );
          setCasos(
            offlineRows.map((item) => ({
              id: item.id,
              codigo: item.codigo,
              title: item.nome,
              description: item.descricao || 'Tutorial de atendimento pre-hospitalar.',
              tutorialId: item.tutorial_id || null,
            }))
          );
          return;
        }

        const rows = (data || []) as TipoOcorrenciaRow[];
        const mapped: Caso[] = rows.map((item) => {
          const tutorial = Array.isArray(item.tutoriais)
            ? item.tutoriais.find((t) => t.ativo !== false) || item.tutoriais[0]
            : item.tutoriais;

          return {
            id: item.id,
            codigo: item.codigo,
            title: item.nome || `Ocorrencia #${item.id}`,
            description: item.descricao || 'Tutorial de atendimento pre-hospitalar.',
            tutorialId: tutorial?.id || null,
          };
        });

        setCasos(mapped);
        await cacheReferenceDataV2({
          tiposOcorrencia: rows,
          tutoriais: rows.flatMap((item) =>
            Array.isArray(item.tutoriais)
              ? item.tutoriais.map((t) => ({
                  ...t,
                  titulo: item.nome,
                  descricao: item.descricao,
                  tipo_ocorrencia_id: item.id,
                }))
              : []
          ),
        });
      } catch (e) {
        console.error('[ListaCasos] Erro inesperado:', e);
        Alert.alert('Erro', 'Nao foi possivel carregar os casos.');
      } finally {
        setLoading(false);
      }
    }

    void carregar();
  }, []);

  if (loading) {
    return (
      <LoadingState
        title="Carregando casos"
        subtitle="Buscando tipos de ocorrência e tutoriais disponíveis."
        icon="kit-medical"
      />
    );
  }

  return (
    <View style={styles.container}>
      <TopHeader title={isModoReal ? 'Emergência' : 'Treinamento'} />
      <View
        style={[
          styles.content,
          {
            paddingHorizontal: layout.horizontalPadding,
            maxWidth: layout.maxContentWidth,
            alignSelf: 'center',
            width: '100%',
          },
        ]}
      >
        <View style={styles.headerPanel}>
        <Text style={styles.eyebrow}>{isModoReal ? 'Registro assistido' : 'Capacitação guiada'}</Text>
        <Text style={styles.title}>{isModoReal ? 'Selecione o caso da ocorrencia' : 'Treinamentos de APH'}</Text>
      {!isModoReal ? (
        <Text style={styles.intro}>Escolha uma situacao para praticar decisoes rapidas antes de uma emergencia real.</Text>
      ) : null}
        </View>

      {casos.length === 0 ? (
        <View style={styles.emptyPanel}>
          <FontAwesome6 name="folder-open" size={18} color={colors.placeholder} />
          <Text style={styles.emptyText}>Nenhum caso disponível no momento.</Text>
        </View>
      ) : (
        <FlatList
          data={casos}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => {
            const meta = getTrainingMeta(item.codigo);
            return (
              <TouchableOpacity
                style={[styles.card, layout.isSmall && styles.cardSmall]}
                activeOpacity={0.84}
                onPress={() => {
                  if (!item.tutorialId) {
                    Alert.alert('Tutorial indisponivel', 'Este tipo de ocorrencia ainda nao possui tutorial.');
                    return;
                  }

                  navigation.navigate('TipoVitima', {
                    tutorialId: item.tutorialId,
                    tipo_ocorrencia_id: item.id,
                    codigo: item.codigo,
                    title: item.title,
                    description: item.description,
                    mode,
                    userLocation,
                    isTreinamento,
                    dataOcorrenciaISO,
                  });
                }}
              >
                <View style={styles.iconBox}>
                  <FontAwesome6 name={meta.icon} size={20} color={colors.primary} />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={[styles.cardHeader, layout.isSmall && styles.cardHeaderSmall]}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    {!isModoReal ? <Text style={styles.badge}>{meta.duration}</Text> : null}
                  </View>
                  <Text style={styles.cardDescription}>{isModoReal ? item.description : meta.focus}</Text>
                </View>

                <FontAwesome6 name="chevron-right" size={16} color={colors.placeholder} />
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
  },
  headerPanel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: colors.radiusLg,
    backgroundColor: colors.card,
    padding: 16,
    marginTop: 16,
    marginBottom: 14,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  intro: {
    color: colors.placeholder,
    fontSize: 15,
    lineHeight: 21,
  },
  emptyPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: colors.radiusMd,
    backgroundColor: colors.card,
    padding: 14,
  },
  emptyText: {
    flex: 1,
    color: colors.placeholder,
    fontSize: 14,
    lineHeight: 19,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    padding: 15,
    borderRadius: colors.radiusLg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  cardSmall: {
    alignItems: 'flex-start',
    gap: 10,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  cardHeaderSmall: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    flexShrink: 1,
  },
  badge: {
    color: colors.success,
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 11,
    fontWeight: '800',
  },
  cardDescription: {
    fontSize: 13,
    color: colors.placeholder,
    marginTop: 5,
    lineHeight: 18,
  },
  backButton: {
    marginTop: 'auto',
    marginBottom: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  backButtonText: {
    color: colors.placeholder,
    fontSize: 16,
  },
});

