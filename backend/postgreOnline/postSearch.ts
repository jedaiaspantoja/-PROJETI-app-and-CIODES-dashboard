// backend/postgreOnline/postSearch.ts
import { supabase, handleSupabase } from '../connectors/postgre';
import type {
  CatUser,
  TipoOco,
  TipoVitim,
  Midia,
  User,
  InfOco,
  Tutorial,
  TutorialStep,
  Localizacao,
} from '../connectors/postgre';

export type TutorialStepRow = TutorialStep;

/**
 * Step com mídia já resolvida via FK tutorial_steps.midia -> midia.id_midia
 */
export type TutorialStepWithMidia = TutorialStep & {
  midia_ref: Midia | null;
};

/**
 * Ocorrência com relações carregadas (users, tipo_oco, tipo_vitim, localizacao).
 */
export type InfOcoWithRelations = InfOco & {
  users: {
    id_user: number;
    nome_user: string;
    telefone: string | null;
  } | null;
  tipo_oco: {
    id_tipo_oco: number;
    nome_oco: string;
  } | null;
  tipo_vitim: {
    id_tipo_vitim: number;
    tipo: string;
  } | null;
  localizacao: Localizacao | null;
};

// =========================
// CAT_USER
// =========================
export async function getAllCatUser() {
  const { data, error } = await supabase.from('cat_user').select('*');
  return handleSupabase<CatUser[]>(data ?? [], error);
}

// =========================
// TIPO_VITIM
// =========================
export async function getAllTipoVitim() {
  const { data, error } = await supabase.from('tipo_vitim').select('*');
  return handleSupabase<TipoVitim[]>(data ?? [], error);
}

// =========================
// TIPO_OCO
// =========================
export async function getAllTipoOco() {
  const { data, error } = await supabase.from('tipo_oco').select('*');
  return handleSupabase<TipoOco[]>(data ?? [], error);
}

// =========================
// MIDIA (biblioteca dos tutoriais)
// =========================
export async function getAllMidia() {
  const { data, error } = await supabase.from('midia').select('*');
  return handleSupabase<Midia[]>(data ?? [], error);
}

// =========================
// TUTORIAIS
// =========================
export async function getAllTutoriais() {
  const { data, error } = await supabase.from('tutoriais').select('*');
  return handleSupabase<Tutorial[]>(data ?? [], error);
}

// =========================
// TUTORIAL_STEPS (um tutorial) - APENAS steps (sem join)
// =========================
export async function getTutorialSteps(id_tutorial: number) {
  const { data, error } = await supabase
    .from('tutorial_steps')
    .select('*')
    .eq('id_tutorial', id_tutorial)
    .order('ordem', { ascending: true });

  return handleSupabase<TutorialStepRow[]>( (data as TutorialStepRow[] | null) ?? [], error);
}

// =========================
// TUTORIAL_STEPS (um tutorial) - COM JOIN DA MÍDIA (RECOMENDADO)
// midia_ref traz url/descricao/created_at da tabela midia
// =========================
export async function getTutorialStepsWithMidia(id_tutorial: number) {
  const { data, error } = await supabase
    .from('tutorial_steps')
    .select(
      `
      id_step,
      id_tutorial,
      ordem,
      texto,
      id_tipo_vitim,
      midia,
      midia_ref:midia (
        id_midia,
        url,
        descricao,
        created_at
      )
    `
    )
    .eq('id_tutorial', id_tutorial)
    .order('ordem', { ascending: true })
    .order('id_step', { ascending: true });

  return handleSupabase<TutorialStepWithMidia[]>(
    (data as unknown as TutorialStepWithMidia[] | null) ?? [],
    error
  );
}

// =========================
// TUTORIAL_STEPS (todos – para sync offline)
// - aqui eu recomendo trazer com join também, para você popular a tabela offline "midia"
// =========================
export async function getAllTutorialStepsWithMidia() {
  const { data, error } = await supabase
    .from('tutorial_steps')
    .select(
      `
      id_step,
      id_tutorial,
      ordem,
      texto,
      id_tipo_vitim,
      midia,
      midia_ref:midia (
        id_midia,
        url,
        descricao,
        created_at
      )
    `
    )
    .order('id_tutorial', { ascending: true })
    .order('ordem', { ascending: true })
    .order('id_step', { ascending: true });

  return handleSupabase<TutorialStepWithMidia[]>(
    (data as unknown as TutorialStepWithMidia[] | null) ?? [],
    error
  );
}

// =========================
// USERS
// =========================
export async function getUserByEmail(email: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email_user', email)
    .maybeSingle<User>();

  return handleSupabase<User | null>(data ?? null, error);
}

// =========================
// INF_OCO por usuário (histórico do civil)
// =========================
export async function getInfOcoByUser(userId: number) {
  const { data, error } = await supabase
    .from('inf_oco')
    .select('*')
    .eq('solicitante', userId)
    .order('data_ocorrencia', { ascending: false });

  return handleSupabase<InfOco[]>(data ?? [], error);
}

// =========================
// INF_OCO detalhe com joins
// =========================
export async function getInfOcoDetalhe(id_oco: number) {
  const { data, error } = await supabase
    .from('inf_oco')
    .select(
      `
      id_oco,
      solicitante,
      tipo_oco_id,
      tipo_viti_id,
      local_oco,
      id_guarnicao,
      origem,
      is_treinamento,
      descricao_extra,
      data_ocorrencia,
      created_at,
      updated_at,
      status,
      users:solicitante (
        id_user,
        nome_user,
        telefone
      ),
      tipo_oco:tipo_oco_id (
        id_tipo_oco,
        nome_oco
      ),
      tipo_vitim:tipo_viti_id (
        id_tipo_vitim,
        tipo
      ),
      localizacao:local_oco (
        id_local,
        latitude,
        longitude,
        precisao_m,
        fonte,
        capturado_em
      )
    `
    )
    .eq('id_oco', id_oco)
    .maybeSingle();

  return handleSupabase<InfOcoWithRelations | null>(
    (data as unknown as InfOcoWithRelations | null) ?? null,
    error
  );
}
