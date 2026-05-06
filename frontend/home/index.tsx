// frontend/home/index.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import { FontAwesome6 } from '@expo/vector-icons';

const colors = {
  background: '#0F172A',
  text: '#F9FAFB',
  secondary: '#9CA3AF',
  card: '#020617',
  primary: '#2563EB',
  danger: '#DC2626',
};

export default function Home({ navigation }: any) {
  const [loading, setLoading] = useState(false);
  const styles = getStyles(colors);

  const handleTreinamento = () => {
    const dataOcorrenciaISO = new Date().toISOString();

    navigation.navigate('ListaCasos', {
      mode: 'training',
      isTreinamento: true,
      dataOcorrenciaISO,
      userLocation: null,
    });
  };

  const handleOcorrenciaReal = async () => {
    setLoading(true);
    const dataOcorrenciaISO = new Date().toISOString();

    try {
      const net = await NetInfo.fetch();
      const online = !!(
        net.isConnected && net.isInternetReachable !== false
      );

      console.log('[Home] Conectado?', online);

      // 🔴 OFFLINE → liga para 193 e depois abre tutoriais
      if (!online) {
        Alert.alert(
          'Sem conexão',
          'Você está sem internet. Vamos ligar para o 193 e, em seguida, abrir os tutoriais.'
        );
        Linking.openURL('tel:193');

        navigation.navigate('ListaCasos', {
          mode: 'real-offline',
          isTreinamento: false,
          dataOcorrenciaISO,
          userLocation: null,
        });
        return;
      }

      // 🔵 ONLINE → pedir permissão e pegar localização
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('[Home] Permissão de localização:', status);

      if (status !== 'granted') {
        Alert.alert(
          'Localização negada',
          'Não foi possível obter a localização. Mesmo assim você poderá seguir o fluxo.'
        );

        navigation.navigate('ListaCasos', {
          mode: 'real-online',
          isTreinamento: false,
          dataOcorrenciaISO,
          userLocation: null,
        });
        return;
      }

      // Tenta obter a posição
      let position;
      try {
        position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      } catch (e: any) {
        console.error('[Home] Erro ao obter posição:', e);
        Alert.alert(
          'Erro de localização',
          'Não foi possível obter a posição exata. Vamos seguir sem coordenadas.'
        );

        navigation.navigate('ListaCasos', {
          mode: 'real-online',
          isTreinamento: false,
          dataOcorrenciaISO,
          userLocation: null,
        });
        return;
      }

      const userLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      console.log('[Home] Localização obtida:', userLocation);

      navigation.navigate('ListaCasos', {
        mode: 'real-online',
        isTreinamento: false,
        dataOcorrenciaISO,
        userLocation,
      });
    } catch (e: any) {
      console.error('[Home] Erro em ocorrência real:', e);
      Alert.alert(
        'Erro',
        'Ocorreu um problema ao iniciar a ocorrência. Tente novamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerOcorrencias = () => {
    navigation.navigate('RegistroCasos');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>O que você deseja fazer?</Text>
      <Text style={styles.subtitle}>
        Escolha entre treinar com tutoriais ou registar uma ocorrência real.
      </Text>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Preparando ambiente...</Text>
        </View>
      ) : (
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.mainButton}
            onPress={handleTreinamento}
          >
            <FontAwesome6 name="book-medical" size={22} color="#FFFFFF" />
            <Text style={styles.mainButtonText}>Treinamento</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mainButton, styles.dangerButton]}
            onPress={handleOcorrenciaReal}
          >
            <FontAwesome6
              name="triangle-exclamation"
              size={22}
              color="#FFFFFF"
            />
            <Text style={styles.mainButtonText}>Ocorrência real</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleVerOcorrencias}
          >
            <FontAwesome6 name="list" size={18} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>
              Ver ocorrências registradas
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const getStyles = (c: typeof colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
      paddingTop: 80,
      paddingHorizontal: 24,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: c.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: c.secondary,
      marginBottom: 32,
    },
    buttonsContainer: {
      gap: 16,
    },
    mainButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
      paddingVertical: 16,
      borderRadius: 16,
      gap: 10,
    },
    mainButtonText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '600',
    },
    dangerButton: {
      backgroundColor: c.danger,
    },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
    },
    secondaryButtonText: {
      color: c.primary,
      fontSize: 16,
      fontWeight: '500',
    },
    loadingBox: {
      marginTop: 32,
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      color: c.secondary,
      fontSize: 16,
    },
  });
