import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../backend/connectors/postgre';
import { setCurrentUser } from '../shared/authSession';
import { colors } from '../shared/theme';
import { useResponsiveLayout } from '../shared/responsive';

type Props = {
  navigation: any;
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

export default function Login({ navigation }: Props) {
  const layout = useResponsiveLayout();
  const [isSocorrista, setIsSocorrista] = useState(false);
  const [cpf, setCpf] = useState('');
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    const documento = onlyDigits(isSocorrista ? matricula : cpf);

    if (!documento || !senha.trim()) {
      Alert.alert('Atenção', 'Informe documento e senha.');
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('usuarios')
        .select('id, auth_user_id, nome, email, cpf_matricula, telefone, papel, ativo')
        .eq('cpf_matricula', documento)
        .eq('ativo', true)
        .maybeSingle();

      if (error) {
        console.error('[Login] Erro Supabase:', error);
        Alert.alert('Erro', error.message || 'Erro ao tentar entrar.');
        return;
      }

      if (!data) {
        Alert.alert('Credenciais inválidas', 'Usuário ou senha incorretos.');
        return;
      }

      if (!data.email) {
        Alert.alert('Conta incompleta', 'Esta conta não possui email para autenticação.');
        return;
      }

      if (!data.auth_user_id) {
        Alert.alert(
          'Conta sem Auth',
          'Este cadastro existe no banco, mas ainda não possui login no Supabase Auth. Cadastre-se novamente para vincular a senha.'
        );
        return;
      }

      if (isSocorrista && data.papel !== 'socorrista') {
        Alert.alert('Acesso negado', 'Esta conta não está cadastrada como socorrista.');
        return;
      }

      if (!isSocorrista && data.papel !== 'solicitante') {
        Alert.alert('Acesso incorreto', 'Use o modo de acesso correto para esta conta.');
        return;
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: senha.trim(),
      });

      if (authError) {
        console.error('[Login] Erro Auth:', authError);
        Alert.alert('Credenciais inválidas', authError.message || 'Não foi possível autenticar.');
        return;
      }

      setCurrentUser(data as any);
      navigation.reset({
        index: 0,
        routes: [{ name: isSocorrista ? 'BombeiroDashboard' : 'Home' }],
      });
    } catch (e) {
      console.error('[Login] Erro inesperado:', e);
      Alert.alert('Erro', 'Ocorreu um erro inesperado ao tentar entrar.');
    } finally {
      setLoading(false);
    }
  }

  function handleGoToCadastro() {
    navigation.navigate('Cadastro', {
      papel: isSocorrista ? 'socorrista' : 'solicitante',
    });
  }

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingHorizontal: layout.horizontalPadding },
      ]}
      enableOnAndroid
    >
      <View style={[styles.hero, layout.isTablet && styles.wideBlock]}>
        <View style={styles.logoMark}>
          <MaterialCommunityIcons name="medical-bag" size={34} color="#FFFFFF" />
        </View>
        <Text style={styles.eyebrow}>Gestão pública de saúde</Text>
        <Text style={[styles.title, layout.isSmall && styles.titleSmall]}>Painel de Saúde e População</Text>
        <Text style={styles.subtitle}>
          Acesse ocorrências, treinamentos e acompanhamento em tempo real.
        </Text>
      </View>

      <View style={[styles.card, layout.isTablet && styles.wideBlock]}>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleButton, !isSocorrista && styles.toggleButtonActive]}
            onPress={() => setIsSocorrista(false)}
          >
            <MaterialCommunityIcons name="account" size={18} color={!isSocorrista ? '#FFFFFF' : colors.placeholder} />
            <Text style={[styles.toggleButtonText, !isSocorrista && styles.toggleButtonTextActive]}>
              Solicitante
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleButton, isSocorrista && styles.toggleButtonActive]}
            onPress={() => setIsSocorrista(true)}
          >
            <MaterialCommunityIcons name="ambulance" size={18} color={isSocorrista ? '#FFFFFF' : colors.placeholder} />
            <Text style={[styles.toggleButtonText, isSocorrista && styles.toggleButtonTextActive]}>
              Socorrista
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>{isSocorrista ? 'Matrícula' : 'CPF'}</Text>
          <View style={styles.inputWrap}>
            <MaterialCommunityIcons name="card-account-details-outline" size={20} color={colors.placeholder} />
            <TextInput
              style={styles.input}
              placeholder={isSocorrista ? 'Informe sua matrícula' : 'Digite seu CPF'}
              placeholderTextColor={colors.placeholder}
              value={isSocorrista ? matricula : cpf}
              onChangeText={isSocorrista ? setMatricula : setCpf}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Senha</Text>
          <View style={styles.inputWrap}>
            <MaterialCommunityIcons name="lock-outline" size={20} color={colors.placeholder} />
            <TextInput
              style={styles.input}
              placeholder="Digite sua senha"
              placeholderTextColor={colors.placeholder}
              secureTextEntry
              value={senha}
              onChangeText={setSenha}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.loginButtonText}>Entrar</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleGoToCadastro} style={styles.linkButton}>
          <Text style={styles.linkText}>Não tem conta? Cadastre-se</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 34,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 22,
  },
  logoMark: {
    width: 70,
    height: 70,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginBottom: 14,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  titleSmall: {
    fontSize: 24,
  },
  wideBlock: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.placeholder,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: colors.radiusLg,
    padding: 18,
  },
  toggleRow: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 999,
    backgroundColor: colors.cardAlt,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
  },
  toggleButtonText: {
    color: colors.placeholder,
    fontWeight: '800',
    fontSize: 13,
  },
  toggleButtonTextActive: {
    color: '#FFF',
  },
  formGroup: {
    marginBottom: 14,
  },
  label: {
    color: colors.text,
    marginBottom: 7,
    fontSize: 13,
    fontWeight: '800',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: colors.radiusSm,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: colors.text,
  },
  loginButton: {
    backgroundColor: colors.primary,
    borderRadius: colors.radiusSm,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  linkButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    color: colors.primary,
    fontWeight: '800',
  },
});
