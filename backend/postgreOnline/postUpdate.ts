// backend/postgreOnline/postUpdate.ts
import {
  supabase,
  handleSupabase,
  User,
  InfOco,
  Tutorial,
  TutorialStep,
} from '../connectors/postgre';

/** Normaliza boolean vindo como 0/1/true/false */
function toBool(v: any): boolean | undefined {
  if (v === undefined) return undefined;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true' || s === '1') return true;
    if (s === 'false' || s === '0') return false;
  }
  return undefined;
}

/* ============================================================
   UPDATE USER
   ============================================================ */

export type UpdateUser = {
  id_user: number;
} & Partial<{
  nome_user: string;
  email_user: string;
  cpf_matricula: string; // ✅ no seu schema é TEXT
  telefone: string | null;
  cat_user_id: number | null;
  id_guarnicao_padrao: number | null;
}>;

export async function updateUser(user: UpdateUser) {
  const { id_user, ...rest } = user;

  const payload = {
    ...rest,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('users')
    .update(payload)
    .eq('id_user', id_user)
    .select()
    .single<User>();

  return handleSupabase<User>(data, error);
}

/* ============================================================
   UPDATE INF_OCO (ocorrência)
   ============================================================ */

export type UpdateInfOco = {
  id_oco: number;
} & Partial<{
  solicitante: number | null;
  local_oco: number | null;
  tipo_oco_id: number | null;
  tipo_viti_id: number | null;
  id_guarnicao: number | null;
  origem: string | null;
  is_treinamento: boolean | number; // aceita 0/1 mas vamos normalizar
  descricao_extra: string | null;
  data_ocorrencia: string; // ISO
  status: string;
}>;

export async function updateInfOco(oco: UpdateInfOco) {
  const { id_oco, ...rest } = oco;

  const isTreinamentoBool = toBool((rest as any).is_treinamento);

  const payload: any = {
    ...rest,
    updated_at: new Date().toISOString(),
  };

  // ✅ normaliza se veio
  if (isTreinamentoBool !== undefined) {
    payload.is_treinamento = isTreinamentoBool;
  }

  const { data, error } = await supabase
    .from('inf_oco')
    .update(payload)
    .eq('id_oco', id_oco)
    .select()
    .single<InfOco>();

  return handleSupabase<InfOco>(data, error);
}

/* ============================================================
   UPDATE TUTORIAL (tabela "tutoriais")
   ============================================================ */

export type UpdateTutorial = {
  id_tutorial: number;
} & Partial<{
  titulo: string;
  descricao: string | null;
  ativo: boolean | number; // aceita 0/1 mas vamos normalizar
  tipo_oco_id: number;
}>;

export async function updateTutorial(tut: UpdateTutorial) {
  const { id_tutorial, ...rest } = tut;

  const ativoBool = toBool((rest as any).ativo);

  const payload: any = { ...rest };
  if (ativoBool !== undefined) payload.ativo = ativoBool;

  const { data, error } = await supabase
    .from('tutoriais')
    .update(payload)
    .eq('id_tutorial', id_tutorial)
    .select()
    .single<Tutorial>();

  return handleSupabase<Tutorial>(data, error);
}

/* ============================================================
   UPDATE TUTORIAL_STEP (tabela "tutorial_steps")
   - inclui midia (FK para midia.id_midia)
   ============================================================ */

export type UpdateTutorialStep = {
  id_step: number;
} & Partial<{
  texto: string;
  ordem: number;
  id_tipo_vitim: number | null;
  midia: number | null; // ✅ sua coluna é "midia integer null"
}>;

export async function updateTutorialStep(step: UpdateTutorialStep) {
  const { id_step, ...rest } = step;

  const { data, error } = await supabase
    .from('tutorial_steps')
    .update(rest)
    .eq('id_step', id_step)
    .select()
    .maybeSingle<TutorialStep>();

  return handleSupabase<TutorialStep | null>(data ?? null, error);
}
