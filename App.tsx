import React from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TouchableOpacity, Alert, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import Login from './frontend/login';
import Cadastro from './frontend/cadastro';
import Home from './frontend/home';
import ListaCasos from './frontend/listaCasos';
import TipoVitima from './frontend/tipoVitima';
import TutorialCaso from './frontend/tutorialCaso';
import RegistroCasos from './frontend/registro';
import DetalheRegistro from './frontend/detalheRegistro';
import BombeiroDashboard from './frontend/bombeiro/BombeiroDashboard';
import BombeiroDetalhe from './frontend/bombeiro/BombeiroDetalhe';
import { initOfflineV2Schema, syncPendingOccurrencesV2 } from './backend/offline/offlineV2';

const Stack = createNativeStackNavigator();

export default function App() {
  React.useEffect(() => {
    void initOfflineV2Schema()
      .then(syncPendingOccurrencesV2)
      .catch((error) => {
        console.warn('[App] Falha ao inicializar/sincronizar SQLite v2:', error);
      });
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator
        id="RootStack"
        initialRouteName="Login"
        screenOptions={({ navigation, route }) => ({
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#F9FAFB',
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: '#0F172A' },
          headerTitleAlign: 'center',
          headerLeft: () => {
            return navigation.canGoBack() ? (
              <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
                <MaterialCommunityIcons name="chevron-left" size={32} color="#F9FAFB" />
              </TouchableOpacity>
            ) : null;
          },
          headerRight: () => {
            // Não mostrar perfil na tela de Login ou Cadastro se não quiser, mas a regra pediu em todas.
            if (route.name === 'Login' || route.name === 'Cadastro') return null;
            
            return (
              <TouchableOpacity 
                onPress={() => Alert.alert('Perfil', 'Aqui entrará a tela de Perfil / Logout')} 
                style={{ marginRight: 16 }}
              >
                <MaterialCommunityIcons name="account-circle" size={28} color="#2563EB" />
              </TouchableOpacity>
            );
          }
        })}
      >
        <Stack.Screen name="Login" component={Login} options={{ headerShown: false }} />
        <Stack.Screen name="Cadastro" component={Cadastro} options={{ title: 'Criar conta' }} />
        <Stack.Screen name="Home" component={Home} options={{ title: 'Início', headerShown: true }} />
        <Stack.Screen name="ListaCasos" component={ListaCasos} options={{ title: 'Tipo de ocorrência' }} />
        <Stack.Screen name="TipoVitima" component={TipoVitima} options={{ title: 'Tipo de vítima' }} />
        <Stack.Screen name="TutorialCaso" component={TutorialCaso} options={{ title: 'Orientação' }} />
        <Stack.Screen name="RegistroCasos" component={RegistroCasos} options={{ title: 'Histórico' }} />
        <Stack.Screen name="DetalheRegistro" component={DetalheRegistro} options={{ title: 'Detalhes' }} />
        <Stack.Screen name="BombeiroDashboard" component={BombeiroDashboard} options={{ title: 'Dashboard CIODES', headerShown: true }} />
        <Stack.Screen name="BombeiroDetalhe" component={BombeiroDetalhe} options={{ title: 'Ocorrência' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
