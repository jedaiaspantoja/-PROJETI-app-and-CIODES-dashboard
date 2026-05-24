import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { supabase } from '../../backend/connectors/postgre';
import { getCurrentUser, setCurrentUser } from '../shared/authSession';
import TopHeader from '../shared/TopHeader';
import { colors } from '../shared/theme';
import { useResponsiveLayout } from '../shared/responsive';

type ProfileUser = {
  id: string;
  nome: string | null;
  email: string | null;
  cpf_matricula?: string | null;
  telefone?: string | null;
  data_nascimento?: string | null;
  papel: 'solicitante' | 'socorrista' | 'ciodes' | 'admin';
  ativo?: boolean;
};


function formatBirthDateInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function formatBirthDateFromISO(value?: string | null) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return '';
  return `${day.slice(0, 2)}/${month}/${year}`;
}

function parseBirthDateBR(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length !== 8) return undefined;

  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  const currentYear = new Date().getFullYear();

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    year < 1900 ||
    year > currentYear
  ) {
    return undefined;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function formatRole(role?: string | null) {
  switch (role) {
    case 'solicitante': return 'Solicitante';
    case 'socorrista': return 'Socorrista';
    case 'ciodes': return 'CIODES';
    case 'admin': return 'Administrador';
    default: return 'Usuário';
  }
}

function formatDocument(value?: string | null, role?: string | null) {
  if (!value) return '-';
  if (role !== 'solicitante') return value;
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11) return value;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export default function Perfil({ navigation }: any) {
  const layout = useResponsiveLayout();
  const [user, setUser] = useState<ProfileUser | null>(() => getCurrentUser() as ProfileUser | null);
  const [nome, setNome] = useState(user?.nome || '');
  const [telefone, setTelefone] = useState(user?.telefone || '');
  const [dataNascimento, setDataNascimento] = useState(formatBirthDateFromISO(user?.data_nascimento));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const documentoLabel = useMemo(() => (user?.papel === 'socorrista' ? 'Matrícula' : 'CPF'), [user?.papel]);

  useEffect(() => {
    async function carregarPerfil() {
      const current = getCurrentUser() as ProfileUser | null;
      if (!current) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome, email, cpf_matricula, telefone, data_nascimento, papel, ativo')
        .eq('id', current.id)
        .maybeSingle();

      if (error) {
        console.error('[Perfil] Erro ao carregar perfil:', error);
        setUser(current);
      } else if (data) {
        const loaded = data as ProfileUser;
        setUser(loaded);
        setCurrentUser(loaded);
        setNome(loaded.nome || '');
        setTelefone(loaded.telefone || '');
        setDataNascimento(formatBirthDateFromISO(loaded.data_nascimento));
      }
      setLoading(false);
    }

    void carregarPerfil();
  }, [navigation]);

  async function salvarPerfil() {
    if (!user) return;
    const nomeLimpo = nome.trim();
    const telefoneLimpo = telefone.trim();
    const dataNascimentoISO = parseBirthDateBR(dataNascimento);

    if (dataNascimentoISO === undefined) {
      Alert.alert('Data inválida', 'Informe a data de nascimento no formato DD/MM/AAAA.');
      return;
    }

    if (!nomeLimpo) {
      Alert.alert('Nome obrigatório', 'Informe seu nome completo.');
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from('usuarios')
      .update({
        nome: nomeLimpo,
        telefone: telefoneLimpo || null,
        data_nascimento: dataNascimentoISO,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('id, nome, email, cpf_matricula, telefone, data_nascimento, papel, ativo')
      .single();

    setSaving(false);

    if (error || !data) {
      console.error('[Perfil] Erro ao atualizar perfil:', error);
      Alert.alert('Erro', error?.message || 'Não foi possível atualizar o perfil.');
      return;
    }

    const updated = data as ProfileUser;
    setUser(updated);
    setCurrentUser(updated);
    Alert.alert('Perfil atualizado', 'Suas informações foram salvas.');
  }

  async function sair() {
    await supabase.auth.signOut();
    setCurrentUser(null);
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }

  return (
    <View style={styles.root}>
      <TopHeader title="Perfil" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: layout.horizontalPadding,
            maxWidth: layout.maxContentWidth,
            alignSelf: 'center',
            width: '100%',
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.summaryCard}>
          <View style={styles.avatar}>
            <FontAwesome6 name="user" size={24} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.nome || 'Usuário'}</Text>
            <Text style={styles.role}>{formatRole(user?.papel)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Dados da conta</Text>

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadingText}>Carregando perfil...</Text>
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Nome completo</Text>
            <TextInput
              style={styles.input}
              value={nome}
              onChangeText={setNome}
              placeholder="Seu nome completo"
              placeholderTextColor={colors.placeholder}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Telefone</Text>
            <TextInput
              style={styles.input}
              value={telefone}
              onChangeText={setTelefone}
              placeholder="(00) 00000-0000"
              placeholderTextColor={colors.placeholder}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.readOnlyRow}>
            <Text style={styles.readOnlyLabel}>E-mail</Text>
            <Text style={styles.readOnlyValue}>{user?.email || '-'}</Text>
          </View>

          <View style={styles.readOnlyRow}>
            <Text style={styles.readOnlyLabel}>{documentoLabel}</Text>
            <Text style={styles.readOnlyValue}>{formatDocument(user?.cpf_matricula, user?.papel)}</Text>
          </View>

          <TouchableOpacity style={[styles.saveButton, saving && styles.disabledButton]} onPress={salvarPerfil} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Salvar alterações</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={sair}>
          <FontAwesome6 name="right-from-bracket" size={16} color={colors.danger} />
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingTop: 16, paddingBottom: 32 },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: colors.radiusLg,
    padding: 16,
    marginBottom: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  name: { color: colors.text, fontSize: 20, fontWeight: '800' },
  role: { color: colors.secondary, fontSize: 13, marginTop: 3, fontWeight: '700' },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: colors.radiusLg,
    padding: 16,
  },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 14 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  loadingText: { color: colors.secondary, fontSize: 13 },
  fieldGroup: { marginBottom: 13 },
  label: { color: colors.text, fontSize: 13, fontWeight: '800', marginBottom: 6 },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: colors.radiusSm,
    backgroundColor: '#FFFFFF',
    color: colors.text,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  readOnlyRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: colors.radiusSm,
    backgroundColor: colors.cardAlt,
    padding: 12,
    marginBottom: 10,
  },
  readOnlyLabel: { color: colors.placeholder, fontSize: 12, fontWeight: '800', marginBottom: 3 },
  readOnlyValue: { color: colors.text, fontSize: 15, fontWeight: '700' },
  saveButton: {
    minHeight: 48,
    borderRadius: colors.radiusSm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  disabledButton: { opacity: 0.7 },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  logoutButton: {
    minHeight: 48,
    borderRadius: colors.radiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    backgroundColor: colors.card,
  },
  logoutText: { color: colors.danger, fontSize: 15, fontWeight: '800' },
});