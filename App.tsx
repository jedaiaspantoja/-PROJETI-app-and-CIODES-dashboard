import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

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

import { SafeAreaProvider } from 'react-native-safe-area-context';

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
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          id="RootStack"
          initialRouteName="Login"
          screenOptions={{
            headerStyle: { backgroundColor: '#0F172A' },
            headerTintColor: '#F9FAFB',
            headerTitleStyle: { fontWeight: '700' },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: '#0F172A' },
          }}
        >
          <Stack.Screen name="Login" component={Login} options={{ headerShown: false }} />
          <Stack.Screen name="Cadastro" component={Cadastro} options={{ headerShown: false }} />
          <Stack.Screen name="Home" component={Home} options={{ headerShown: false }} />
          <Stack.Screen name="ListaCasos" component={ListaCasos} options={{ headerShown: false }} />
          <Stack.Screen name="TipoVitima" component={TipoVitima} options={{ headerShown: false }} />
          <Stack.Screen name="TutorialCaso" component={TutorialCaso} options={{ headerShown: false }} />
          <Stack.Screen name="RegistroCasos" component={RegistroCasos} options={{ headerShown: false }} />
          <Stack.Screen name="DetalheRegistro" component={DetalheRegistro} options={{ headerShown: false }} />
          <Stack.Screen name="BombeiroDashboard" component={BombeiroDashboard} options={{ headerShown: false }} />
          <Stack.Screen name="BombeiroDetalhe" component={BombeiroDetalhe} options={{ headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
