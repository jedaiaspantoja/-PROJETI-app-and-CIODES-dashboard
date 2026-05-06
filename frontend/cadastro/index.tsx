import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../backend/connectors/postgre';

const colors = {
  background: '#0F172A',
  text: '#F9FAFB',
  border: '#1F2937',
  card: '#020617',
  placeholder: '#6B7280',
  primary: '#2563EB',
  danger: '#EF4444',
};

type CadastroProps = {
  navigation: any;
  route?: any;
};

type Guarnicao = {
  id: string;
  nome: string | null;
  tipo_viatura: string | null;
  prefixo: string | null;
  descricao: string | null;
};

const sanitizeCpf = (value: string) => value.replace(/\D/g, '').slice(0, 11);
const sanitizeMatricula = (value: string) => value.replace(/\D/g, '').slice(0, 20);

const formatCpf = (value: string) => {
  const digits = sanitizeCpf(value);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
};

function guarnicaoLabel(guarnicao: Guarnicao) {
  return `${guarnicao.tipo_viatura || ''} ${guarnicao.prefixo || guarnicao.nome || ''}`.trim() || guarnicao.nome || 'Guarnicao';
}

export function isValidCpf(rawCpf: string): boolean {
  const cpf = sanitizeCpf(rawCpf);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split('').map((d) => parseInt(d, 10));

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += digits[i] * (10 - i);
  let firstCheck = (sum * 10) % 11;
  if (firstCheck === 10) firstCheck = 0;
  if (firstCheck !== digits[9]) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += digits[i] * (11 - i);
  let secondCheck = (sum * 10) % 11;
  if (secondCheck === 10) secondCheck = 0;

  return secondCheck === digits[10];
}

export default function Cadastro({ navigation, route }: CadastroProps) {
  const papel = route?.params?.papel === 'socorrista' ? 'socorrista' : 'solicitante';
  const isSocorrista = papel === 'socorrista';

  const [fullName, setFullName] = useState('');
  const [documento, setDocumento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [guarnicoes, setGuarnicoes] = useState<Guarnicao[]>([]);
  const [selectedGuarnicaoId, setSelectedGuarnicaoId] = useState<string | null>(null);
  const [loadingGuarnicoes, setLoadingGuarnicoes] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isSocorrista) return;

    async function loadGuarnicoes() {
      setLoadingGuarnicoes(true);
      const { data, error } = await supabase
        .from('guarnicoes')
        .select('id, nome, tipo_viatura, prefixo, descricao')
        .eq('ativo', true)
        .order('nome', { ascending: true });

      if (error) {
        console.error('[Cadastro] erro ao carregar guarnicoes:', error);
        Alert.alert('Guarnicoes indisponiveis', 'Nao foi possivel carregar as guarnicoes ativas.');
        setGuarnicoes([]);
      } else {
        setGuarnicoes((data || []) as Guarnicao[]);
      }
      setLoadingGuarnicoes(false);
    }

    void loadGuarnicoes();
  }, [isSocorrista]);

  const handleRegister = async () => {
    if (!fullName.trim() || !documento.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Erro', `Preencha nome, ${isSocorrista ? 'matricula' : 'CPF'}, email e senha.`);
      return;
    }

    const documentoLimpo = isSocorrista ? sanitizeMatricula(documento) : sanitizeCpf(documento);
    if (!isSocorrista && !isValidCpf(documentoLimpo)) {
      Alert.alert('CPF invalido', 'O CPF informado nao e matematicamente valido.');
      return;
    }

    if (isSocorrista && !documentoLimpo) {
      Alert.alert('Matricula invalida', 'Informe uma matricula numerica valida.');
      return;
    }

    if (isSocorrista && !selectedGuarnicaoId) {
      Alert.alert('Guarnicao obrigatoria', 'Selecione a guarnicao ativa em que voce atua.');
      return;
    }

    setLoading(true);
    try {
      const { data: existingProfile, error: existingProfileError } = await supabase
        .from('usuarios')
        .select('id, auth_user_id, papel')
        .eq('cpf_matricula', documentoLimpo)
        .maybeSingle();

      if (existingProfileError) {
        console.error('[Cadastro] erro ao verificar perfil existente:', existingProfileError);
        Alert.alert('Erro no cadastro', 'Nao foi possivel verificar se este documento ja esta cadastrado.');
        return;
      }

      if (existingProfile?.auth_user_id) {
        Alert.alert('Conta ja cadastrada', 'Este documento ja possui uma conta. Volte para o login.');
        return;
      }

      if (existingProfile && existingProfile.papel !== papel) {
        Alert.alert('Cadastro divergente', 'Este documento ja esta cadastrado em outro tipo de acesso.');
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password.trim(),
        options: {
          data: {
            nome: fullName.trim(),
            papel,
            cpf_matricula: documentoLimpo,
          },
        },
      });

      if (authError || !authData.user) {
        console.error('[Cadastro] erro auth:', authError);
        Alert.alert('Erro no cadastro', authError?.message || 'Nao foi possivel criar o usuario de autenticacao.');
        return;
      }

      const profilePayload = {
        auth_user_id: authData.user.id,
        papel,
        nome: fullName.trim(),
        email: email.trim().toLowerCase(),
        cpf_matricula: documentoLimpo,
        telefone: telefone.trim() || null,
        senha_hash: null,
      };

      const profileRequest = existingProfile
        ? supabase
            .from('usuarios')
            .update(profilePayload)
            .eq('id', existingProfile.id)
            .select('id')
            .single()
        : supabase
            .from('usuarios')
            .insert(profilePayload)
            .select('id')
            .single();

      const { data, error } = await profileRequest;

      if (error || !data) {
        console.error('[Cadastro] erro supabase:', error);
        Alert.alert('Erro no cadastro', 'Nao foi possivel criar sua conta. Verifique se o email ou documento ja nao estao cadastrados.');
        return;
      }

      if (isSocorrista && selectedGuarnicaoId) {
        const { error: disableOldError } = await supabase
          .from('guarnicao_membros')
          .update({ ativo: false })
          .eq('usuario_id', data.id);

        if (disableOldError) {
          console.error('[Cadastro] erro ao limpar guarnicoes antigas:', disableOldError);
        }

        const { error: membroError } = await supabase.from('guarnicao_membros').upsert(
          {
            guarnicao_id: selectedGuarnicaoId,
            usuario_id: data.id,
            funcao: 'Socorrista',
            ativo: true,
          },
          { onConflict: 'guarnicao_id,usuario_id' }
        );

        if (membroError) {
          console.error('[Cadastro] erro ao vincular guarnicao:', membroError);
          Alert.alert('Conta criada parcialmente', 'Sua conta foi criada, mas nao foi possivel vincular a guarnicao. Peça ao CIODES para ajustar sua escala.');
          return;
        }
      }

      Alert.alert('Conta criada', 'Sua conta foi criada com sucesso!', [
        {
          text: 'Ir para Login',
          onPress: () =>
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            }),
        },
      ]);
    } catch (err) {
      console.error('[Cadastro] erro inesperado:', err);
      Alert.alert('Erro inesperado', 'Ocorreu um problema ao criar sua conta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Criar conta</Text>
          <Text style={styles.subtitle}>
            {isSocorrista ? 'Informe seus dados profissionais e selecione sua guarnicao.' : 'Preencha seus dados para se cadastrar.'}
          </Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Nome completo</Text>
            <TextInput
              style={styles.input}
              placeholder="Digite seu nome completo"
              placeholderTextColor={colors.placeholder}
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{isSocorrista ? 'Matricula' : 'CPF'}</Text>
            <TextInput
              style={styles.input}
              placeholder={isSocorrista ? 'Informe sua matricula' : '000.000.000-00'}
              placeholderTextColor={colors.placeholder}
              keyboardType="numeric"
              value={documento}
              onChangeText={(value) => setDocumento(isSocorrista ? sanitizeMatricula(value) : formatCpf(value))}
              maxLength={isSocorrista ? 20 : 14}
            />
          </View>

          {isSocorrista && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>Guarnicao ativa</Text>
              {loadingGuarnicoes ? (
                <View style={styles.inlineLoading}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.inlineLoadingText}>Carregando guarnicoes...</Text>
                </View>
              ) : guarnicoes.length === 0 ? (
                <Text style={styles.warningText}>Nenhuma guarnicao ativa cadastrada. Cadastre no Dashboard CIODES antes.</Text>
              ) : (
                <View style={styles.guarnicaoList}>
                  {guarnicoes.map((guarnicao) => {
                    const active = selectedGuarnicaoId === guarnicao.id;
                    return (
                      <TouchableOpacity
                        key={guarnicao.id}
                        style={[styles.guarnicaoOption, active && styles.guarnicaoOptionActive]}
                        onPress={() => setSelectedGuarnicaoId(guarnicao.id)}
                      >
                        <Text style={[styles.guarnicaoTitle, active && styles.guarnicaoTitleActive]}>{guarnicaoLabel(guarnicao)}</Text>
                        {guarnicao.descricao ? <Text style={styles.guarnicaoSubtitle}>{guarnicao.descricao}</Text> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          <View style={styles.formGroup}>
            <Text style={styles.label}>Telefone (opcional)</Text>
            <TextInput
              style={styles.input}
              placeholder="(00) 00000-0000"
              placeholderTextColor={colors.placeholder}
              keyboardType="phone-pad"
              value={telefone}
              onChangeText={setTelefone}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="seuemail@exemplo.com"
              placeholderTextColor={colors.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Senha</Text>
            <TextInput
              style={styles.input}
              placeholder="Crie uma senha"
              placeholderTextColor={colors.placeholder}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Criar conta</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.secondaryButtonText}>Ja tenho conta, voltar para Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 24,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    color: colors.placeholder,
    fontSize: 14,
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 12,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#020617',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
  },
  inlineLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  inlineLoadingText: {
    color: colors.placeholder,
    fontSize: 13,
  },
  warningText: {
    color: colors.danger,
    fontSize: 13,
  },
  guarnicaoList: {
    gap: 8,
  },
  guarnicaoOption: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#020617',
  },
  guarnicaoOptionActive: {
    borderColor: colors.primary,
    backgroundColor: '#172554',
  },
  guarnicaoTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  guarnicaoTitleActive: {
    color: '#BFDBFE',
  },
  guarnicaoSubtitle: {
    color: colors.placeholder,
    fontSize: 12,
    marginTop: 3,
  },
  button: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
});
