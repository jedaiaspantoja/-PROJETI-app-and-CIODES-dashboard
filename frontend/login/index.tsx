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
import { supabase } from '../../backend/connectors/postgre';
import { setCurrentUser } from '../shared/authSession';

const colors = {
  background: '#0F172A',
  text: '#F9FAFB',
  border: '#1F2937',
  card: '#020617',
  placeholder: '#6B7280',
  primary: '#2563EB',
};

type Props = {
  navigation: any;
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

export default function Login({ navigation }: Props) {
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
          'Este cadastro existe no banco, mas ainda nao possui login no Supabase Auth. Cadastre-se novamente para vincular a senha.'
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
      contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, paddingTop: 60 }}
      enableOnAndroid={true}
    >
      <Text style={styles.title}>PROJETI</Text>
      <Text style={styles.subtitle}>
        {isSocorrista ? 'Acesso do Socorrista' : 'Acesso do Solicitante'}
      </Text>

      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleButton, !isSocorrista && styles.toggleButtonActive]}
          onPress={() => setIsSocorrista(false)}
        >
          <Text style={[styles.toggleButtonText, !isSocorrista && styles.toggleButtonTextActive]}>
            Solicitante
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleButton, isSocorrista && styles.toggleButtonActive]}
          onPress={() => setIsSocorrista(true)}
        >
          <Text style={[styles.toggleButtonText, isSocorrista && styles.toggleButtonTextActive]}>
            Socorrista
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>{isSocorrista ? 'Matrícula' : 'CPF'}</Text>
      <TextInput
        style={styles.input}
        placeholder={isSocorrista ? 'Informe sua matrícula' : 'Digite seu CPF'}
        placeholderTextColor={colors.placeholder}
        value={isSocorrista ? matricula : cpf}
        onChangeText={isSocorrista ? setMatricula : setCpf}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Senha</Text>
      <TextInput
        style={styles.input}
        placeholder="••••••••"
        placeholderTextColor={colors.placeholder}
        secureTextEntry
        value={senha}
        onChangeText={setSenha}
      />

      <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.loginButtonText}>Entrar</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={handleGoToCadastro} style={styles.linkButton}>
        <Text style={styles.linkText}>Não tem conta? Cadastre-se</Text>
      </TouchableOpacity>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.placeholder,
    textAlign: 'center',
    marginBottom: 32,
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    marginBottom: 24,
    borderRadius: 999,
    backgroundColor: colors.card,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
  },
  toggleButtonText: {
    color: colors.placeholder,
    fontWeight: '500',
  },
  toggleButtonTextActive: {
    color: '#FFF',
  },
  label: {
    color: colors.text,
    marginBottom: 4,
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    color: colors.text,
    backgroundColor: colors.card,
  },
  loginButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    color: colors.placeholder,
    textDecorationLine: 'underline',
  },
});


