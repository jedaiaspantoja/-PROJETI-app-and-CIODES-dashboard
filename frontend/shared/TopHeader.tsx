import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from './theme';
import { useResponsiveLayout } from './responsive';

interface TopHeaderProps {
  title?: string;
}

export default function TopHeader({ title = '' }: TopHeaderProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      Alert.alert('Sair', 'Deseja desconectar e voltar para o login?', [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Sair', 
          style: 'destructive',
          onPress: () => navigation.reset({
            index: 0,
            routes: [{ name: 'Login' as never }],
          })
        },
      ]);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) + 10, paddingHorizontal: layout.horizontalPadding }]}>
      <TouchableOpacity style={styles.button} onPress={handleBack}>
        <MaterialCommunityIcons 
          name={navigation.canGoBack() ? "chevron-left" : "logout"} 
          size={navigation.canGoBack() ? 30 : 24} 
          color={colors.text} 
        />
      </TouchableOpacity>

      <Text style={styles.title} numberOfLines={1}>{title}</Text>

      <TouchableOpacity 
        style={styles.button} 
        onPress={() => Alert.alert('Perfil', 'Abrindo configuração do perfil / Logout')}
      >
        <MaterialCommunityIcons name="account-circle" size={28} color={colors.secondaryAccent} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 15,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  button: {
    minWidth: 42,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPlaceholder: {
    width: 38,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  }
});
