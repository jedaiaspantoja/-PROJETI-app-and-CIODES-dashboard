// backend/connectors/postgre.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Em Expo, o padrão recomendado é usar EXPO_PUBLIC_*
 * e setar no app.config / .env.
 * Mantive fallback para não quebrar seu build, mas avisei no console.
 */
export const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://fcjettvlsmoxnzolqmkc.supabase.co';

export const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_gcvNapfPrLZVI2x49C8stQ_wwXo3HDb';

if (!process.env.EXPO_PUBLIC_SUPABASE_URL || (!process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY && !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY)) {
  console.warn(
    '[Supabase] EXPO_PUBLIC_SUPABASE_URL/EXPO_PUBLIC_SUPABASE_ANON_KEY não encontrados. Usando fallback hardcoded (não recomendado).'
  );
}

const configuredSupabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  supabaseUrl;

const configuredSupabaseKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  supabaseAnonKey;

export const supabase: SupabaseClient = createClient(configuredSupabaseUrl, configuredSupabaseKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// =========================
// Tipos das tabelas (ajuste para refletir seu schema REAL)
// =========================

export type CatUser = {
  id_cat: number;
  nome: string;
};

export type User = {
  id_user: number;
  cat_user_id: number | null;
  nome_user: string | null;
  email_user: string | null;
  cpf_matricula: string | null;
  telefone: string | null;
  senha: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type TipoVitim = {
  id_tipo_vitim: number;
  tipo: string | null;
  descricao: string | null;
};

export type TipoOco = {
  id_tipo_oco: number;
  nome_oco: string | null;
  descricao: string | null;
  severidade: number | null; // smallint/int
  ativo: boolean | null;
};

export type Localizacao = {
  id_local: number;
  latitude: number | null; // numeric -> vem como number (ou string dependendo do client)
  longitude: number | null;
  precisao_m: number | null;
  fonte: string | null;
  capturado_em: string | null;
};

export type InfOco = {
  id_oco: number;
  solicitante: number | null;
  tipo_oco_id: number | null;
  tipo_viti_id: number | null;
  local_oco: number | null;
  is_treinamento: boolean;
  descricao_extra: string | null;
  data_ocorrencia: string | null;
  created_at: string | null;
  updated_at: string | null;
  status: string | null;
  id_guarnicao?: number | null; // se existir no seu schema, ok; se não, não atrapalha
};

export type InfOcoStatusLog = {
  id_log: number;
  id_oco: number;
  status: string | null;
  changed_at: string | null;
  observacao?: string | null; // você usa isso no app
};

/**
 * Schema que você mandou:
 * public.midia (id_midia, url, descricao, created_at)
 */
export type Midia = {
  id_midia: number;
  url: string;
  descricao: string | null;
  created_at: string;
};

/**
 * Schema que você mandou:
 * tutorial_steps.midia é INTEGER FK -> midia.id_midia
 */
export type Tutorial = {
  id_tutorial: number;
  titulo: string | null;
  descricao: string | null;
  ativo: boolean | null;
  tipo_oco_id: number | null;
};

export type TutorialStep = {
  id_step: number;
  id_tutorial: number;
  ordem: number;
  texto: string;
  id_tipo_vitim: number | null;
  midia: number | null; // FK para midia.id_midia
};

// =========================
// Helper genérico de retorno
// =========================

export type PgResult<T> = {
  data: T | null;
  error: string | null;
};

export function handleSupabase<T>(data: T | null, error: unknown): PgResult<T> {
  if (error) {
    // supabase retorna PostgrestError em geral (com .message)
    const msg =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as any).message)
        : 'Erro desconhecido';

    console.error('[Supabase error]', error);
    return { data: null, error: msg };
  }
  return { data, error: null };
}
