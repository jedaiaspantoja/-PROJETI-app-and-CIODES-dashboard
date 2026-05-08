import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import { FontAwesome6 } from '@expo/vector-icons';
import { supabase } from '../../backend/connectors/postgre';
import { getCurrentUser } from '../shared/authSession';

const colors = {
  background: '#0F172A',
  text: '#F9FAFB',
  secondary: '#9CA3AF',
  card: '#020617',
  cardAlt: '#111827',
  primary: '#2563EB',
  danger: '#DC2626',
  border: '#1F2937',
  warning: '#F59E0B',
};

type RecentOccurrence = {
  id: string;
  protocolo: string;
  status: string;
  criada_em: string;
  tipo_ocorrencia: { nome: string | null } | null;
  tipo_vitima: { nome: string | null } | null;
};

function statusToLabel(status: string | null | undefined) {
  switch ((status || '').toLowerCase()) {
    case 'registrada': return 'Registrada';
    case 'recebida_ciodes': return 'Recebida pelo CIODES';
    case 'guarnicao_empenhada': return 'Equipe empenhada';
    case 'em_deslocamento': return 'Equipe em deslocamento';
    case 'em_atendimento': return 'Em atendimento';
    case 'finalizada': return 'Finalizada';
    case 'cancelada': return 'Cancelada';
    default: return status || 'Sem status';
  }
}

function formatElapsed(iso?: string | null) {
  if (!iso) return '-';
  const start = new Date(iso).getTime();
  if (Number.isNaN(start)) return '-';
  const minutes = Math.max(0, Math.floor((Date.now() - start) / 60000));
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

export default function Home({ navigation }: any) {
  const [loadingEmergency, setLoadingEmergency] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [recentes, setRecentes] = useState<RecentOccurrence[]>([]);
  const styles = getStyles(colors);

  const carregarRecentes = useCallback(async () => {
    const user = getCurrentUser();
    if (!user) return;

    setLoadingRecent(true);
    const { data, error } = await supabase
      .from('ocorrencias')
      .select('id, protocolo, status, criada_em, tipo_ocorrencia:tipo_ocorrencia_id (nome), tipo_vitima:tipo_vitima_id (nome)')
      .eq('solicitante_id', user.id)
      .order('criada_em', { ascending: false })
      .limit(3);

    if (error) {
      console.error('[Home] Erro ao carregar recentes:', error);
      setRecentes([]);
    } else {
      setRecentes((data || []) as unknown as RecentOccurrence[]);
    }
    setLoadingRecent(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void carregarRecentes();
    }, [carregarRecentes])
  );

  const handleTreinamento = () => {
    navigation.navigate('ListaCasos', {
      mode: 'training',
      isTreinamento: true,
      dataOcorrenciaISO: new Date().toISOString(),
      userLocation: null,
    });
  };

  const seguirParaCasosReais = (mode: string, userLocation: any) => {
    navigation.navigate('ListaCasos', {
      mode,
      isTreinamento: false,
      dataOcorrenciaISO: new Date().toISOString(),
      userLocation,
    });
  };

  const handleOcorrenciaReal = async () => {
    setLoadingEmergency(true);

    try {
      const net = await NetInfo.fetch();
      const online = !!(net.isConnected && net.isInternetReachable !== false);

      if (!online) {
        Alert.alert(
          'Sem internet',
          'Vamos tentar ligar para o 193 e abrir o fluxo offline para salvar o chamado no aparelho.',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Continuar',
              onPress: () => {
                void Linking.openURL('tel:193');
                seguirParaCasosReais('real-offline', null);
              },
            },
          ]
        );
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Localizacao nao autorizada', 'Voce ainda pode abrir o chamado, mas o CIODES nao recebera coordenadas automaticamente.');
        seguirParaCasosReais('real-online', null);
        return;
      }

      let userLocation = null;
      try {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        userLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
      } catch (e) {
        console.error('[Home] Erro ao obter localizacao:', e);
        Alert.alert('Localizacao indisponivel', 'Nao foi possivel obter a posicao agora. O chamado seguira sem coordenadas.');
      }

      seguirParaCasosReais('real-online', userLocation);
    } catch (e) {
      console.error('[Home] Erro em ocorrencia real:', e);
      Alert.alert('Erro', 'Ocorreu um problema ao iniciar a ocorrencia. Tente novamente.');
    } finally {
      setLoadingEmergency(false);
    }
  };

  const handleVerOcorrencias = () => navigation.navigate('RegistroCasos');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>App do solicitante</Text>
      <Text style={styles.title}>Como podemos ajudar?</Text>
      <Text style={styles.subtitle}>Abra um chamado real em emergencia ou acesse treinamentos para se preparar.</Text>

      <TouchableOpacity style={styles.emergencyCard} onPress={handleOcorrenciaReal} disabled={loadingEmergency} activeOpacity={0.85}>
        <View style={styles.emergencyIcon}>
          {loadingEmergency ? <ActivityIndicator color="#FFFFFF" /> : <FontAwesome6 name="triangle-exclamation" size={24} color="#FFFFFF" />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.emergencyTitle}>Emergencia real</Text>
          <Text style={styles.emergencyText}>Coletar localizacao, informar ocorrencia e acionar o CIODES.</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.quickGrid}>
        <TouchableOpacity style={styles.quickCard} onPress={handleTreinamento}>
          <FontAwesome6 name="book-medical" size={20} color={colors.primary} />
          <Text style={styles.quickTitle}>Treinamento</Text>
          <Text style={styles.quickText}>Tutoriais para primeiros cuidados.</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickCard} onPress={handleVerOcorrencias}>
          <FontAwesome6 name="clock-rotate-left" size={20} color={colors.primary} />
          <Text style={styles.quickTitle}>Historico</Text>
          <Text style={styles.quickText}>Acompanhe seus chamados.</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Ultimas ocorrencias</Text>
        <TouchableOpacity onPress={handleVerOcorrencias}>
          <Text style={styles.sectionLink}>Ver todas</Text>
        </TouchableOpacity>
      </View>

      {loadingRecent ? (
        <View style={styles.loadingRecent}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Atualizando historico...</Text>
        </View>
      ) : recentes.length === 0 ? (
        <Text style={styles.emptyText}>Nenhuma ocorrencia registrada ainda.</Text>
      ) : (
        recentes.map((item) => (
          <TouchableOpacity key={item.id} style={styles.recentCard} onPress={() => navigation.navigate('DetalheRegistro', { registro: item })}>
            <View style={{ flex: 1 }}>
              <Text style={styles.recentTitle}>{item.tipo_ocorrencia?.nome || item.protocolo}</Text>
              <Text style={styles.recentText}>{item.tipo_vitima?.nome || 'Vitima nao informada'} - {formatElapsed(item.criada_em)}</Text>
            </View>
            <Text style={styles.statusText}>{statusToLabel(item.status)}</Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const getStyles = (c: typeof colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { paddingTop: 72, paddingHorizontal: 20, paddingBottom: 32 },
    eyebrow: { color: c.primary, fontSize: 13, fontWeight: '700', marginBottom: 6 },
    title: { fontSize: 30, fontWeight: '800', color: c.text, marginBottom: 8 },
    subtitle: { fontSize: 15, color: c.secondary, marginBottom: 22, lineHeight: 21 },
    emergencyCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: c.danger, borderRadius: 12, padding: 16, marginBottom: 14 },
    emergencyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
    emergencyTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
    emergencyText: { color: '#FEE2E2', fontSize: 13, marginTop: 3, lineHeight: 18 },
    quickGrid: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    quickCard: { flex: 1, minHeight: 120, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 14, justifyContent: 'space-between' },
    quickTitle: { color: c.text, fontSize: 16, fontWeight: '700', marginTop: 10 },
    quickText: { color: c.secondary, fontSize: 12, lineHeight: 17 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    sectionTitle: { color: c.text, fontSize: 17, fontWeight: '800' },
    sectionLink: { color: c.primary, fontSize: 13, fontWeight: '700' },
    loadingRecent: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
    loadingText: { color: c.secondary, fontSize: 13 },
    emptyText: { color: c.secondary, fontSize: 14 },
    recentCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.cardAlt, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 12, marginBottom: 10 },
    recentTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
    recentText: { color: c.secondary, fontSize: 12, marginTop: 3 },
    statusText: { color: c.warning, fontSize: 12, fontWeight: '700', textAlign: 'right', maxWidth: 120 },
  });
