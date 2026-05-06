import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

const colors = {
  background: '#0F172A',
  text: '#F9FAFB',
  secondary: '#9CA3AF',
  card: '#020617',
  primary: '#2563EB',
  border: '#1F2937',
};

function formatarData(dataISO?: string | null) {
  if (!dataISO) return 'Não disponível';
  const d = new Date(dataISO);
  if (Number.isNaN(d.getTime())) return 'Não disponível';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function statusToLabel(status?: string | null) {
  switch ((status || '').toLowerCase()) {
    case 'registrada':
      return 'Registrada';
    case 'recebida_ciodes':
      return 'Recebida pelo CIODES';
    case 'guarnicao_empenhada':
      return 'Guarnição empenhada';
    case 'em_deslocamento':
      return 'Em deslocamento';
    case 'em_atendimento':
      return 'Em atendimento';
    case 'finalizada':
      return 'Finalizada';
    case 'cancelada':
      return 'Cancelada';
    default:
      return status || 'Sem status';
  }
}

export default function DetalheRegistro({ navigation, route }: any) {
  const registro = route?.params?.registro ?? {};

  const titulo = registro.title || `Ocorrência ${registro.protocolo || ''}`;
  const descricao = registro.description || 'Sem descrição adicional.';
  const status = statusToLabel(registro.status);
  const data = formatarData(registro.created_at || registro.criada_em);

  const lat = registro.latitude == null ? null : Number(registro.latitude);
  const lng = registro.longitude == null ? null : Number(registro.longitude);
  const temCoordenadas = lat !== null && lng !== null && !Number.isNaN(lat) && !Number.isNaN(lng);

  const region = temCoordenadas
    ? {
        latitude: lat as number,
        longitude: lng as number,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }
    : {
        latitude: -14.235,
        longitude: -51.9253,
        latitudeDelta: 30,
        longitudeDelta: 30,
      };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>{'< Voltar'}</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Detalhes da ocorrência</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={styles.card}>
          <Text style={styles.title}>{titulo}</Text>
          <Text style={styles.subtitle}>Protocolo: {registro.protocolo || '-'}</Text>
          <Text style={styles.subtitle}>Status: {status}</Text>
          <Text style={styles.subtitle}>Data: {data}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Localização</Text>

          <View style={styles.mapWrapper}>
            {temCoordenadas ? (
              <MapView style={styles.map} initialRegion={region}>
                <Marker coordinate={{ latitude: lat as number, longitude: lng as number }} title={titulo} />
              </MapView>
            ) : (
              <View style={styles.mapFallback}>
                <Text style={styles.mapFallbackText}>Não há coordenadas registradas para essa ocorrência.</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Resumo</Text>
          <Text style={styles.value}>{descricao}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 40,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#020617',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    paddingVertical: 6,
    paddingRight: 12,
    paddingLeft: 4,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: colors.secondary,
    fontSize: 13,
    marginTop: 3,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  value: {
    color: colors.text,
    fontSize: 14,
  },
  mapWrapper: {
    marginTop: 12,
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#020617',
  },
  map: {
    flex: 1,
  },
  mapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  mapFallbackText: {
    color: colors.secondary,
    fontSize: 12,
    textAlign: 'center',
  },
});
