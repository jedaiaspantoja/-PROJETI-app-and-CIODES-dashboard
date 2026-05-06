import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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

const colors = {
  background: '#0F172A',
  text: '#F9FAFB',
  card: '#1E293B',
  placeholder: '#9CA3AF',
  primary: '#2563EB',
  border: '#334155',
};

type Caso = {
  id: number;
  codigo: string;
  title: string;
  description: string;
  tutorialId: string | null;
};

export default function ListaCasos({ navigation, route }: any) {
  const { mode, userLocation, isTreinamento, dataOcorrenciaISO } = route?.params || {};
  const [casos, setCasos] = useState<Caso[]>([]);
  const [loading, setLoading] = useState(true);

  const isModoReal = mode === 'real-online' || mode === 'real-offline';

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
          const offlineRows = await executeOfflineSelect<any>(
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
              description: item.descricao || 'Tutorial de atendimento pré-hospitalar.',
              tutorialId: item.tutorial_id || null,
            }))
          );
          return;
        }

        const mapped: Caso[] = ((data as any[]) || []).map((item) => {
          const tutorial = Array.isArray(item.tutoriais)
            ? item.tutoriais.find((t: any) => t.ativo !== false) || item.tutoriais[0]
            : item.tutoriais;

          return {
            id: item.id,
            codigo: item.codigo,
            title: item.nome || `Ocorrência #${item.id}`,
            description: item.descricao || 'Tutorial de atendimento pré-hospitalar.',
            tutorialId: tutorial?.id || null,
          };
        });

        setCasos(mapped);
        await cacheReferenceDataV2({
          tiposOcorrencia: data || [],
          tutoriais: ((data as any[]) || []).flatMap((item) =>
            Array.isArray(item.tutoriais)
              ? item.tutoriais.map((t: any) => ({
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
        Alert.alert('Erro', 'Não foi possível carregar os casos.');
      } finally {
        setLoading(false);
      }
    }

    void carregar();
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 12, color: colors.placeholder }}>Carregando casos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isModoReal ? 'Selecione o caso da ocorrência' : 'Casos de Treinamento'}</Text>

      {casos.length === 0 ? (
        <Text style={{ color: colors.placeholder }}>Nenhum caso disponível.</Text>
      ) : (
        <FlatList
          data={casos}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => {
                if (!item.tutorialId) {
                  Alert.alert('Tutorial indisponível', 'Este tipo de ocorrência ainda não possui tutorial.');
                  return;
                }

                navigation.navigate('TipoVitima', {
                  tutorialId: item.tutorialId,
                  tipo_ocorrencia_id: item.id,
                  title: item.title,
                  description: item.description,
                  mode,
                  userLocation,
                  isTreinamento,
                  dataOcorrenciaISO,
                });
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDescription}>{item.description}</Text>
              </View>

              <FontAwesome6 name="chevron-right" size={18} color={colors.placeholder} />
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}

      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <FontAwesome6 name="arrow-left" size={16} color={colors.placeholder} />
        <Text style={styles.backButtonText}>Voltar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 24,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  cardDescription: {
    fontSize: 14,
    color: colors.placeholder,
    marginTop: 4,
  },
  backButton: {
    marginTop: 'auto',
    marginBottom: 40,
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
