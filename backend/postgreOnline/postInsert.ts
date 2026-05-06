// backend/postgreOnline/postInsert.ts
import { supabase } from '../connectors/postgre';

/**
 * Payload para criação de uma ocorrência no Supabase.
 * Usado tanto pelo app (civil/bombeiro) quanto pelo sync offline.
 */
export type NewInfOco = {
  solicitante?: number | null; // id_user do solicitante (civil ou CIODES)
  tipo_oco_id?: number | null; // FK -> tipo_oco.id_tipo_oco
  tipo_viti_id?: number | null; // FK -> tipo_vitim.id_tipo_vitim
  local_oco?: number | null; // FK -> localizacao.id_local
  is_treinamento: boolean | number; // aceita 0/1 do SQLite
  descricao_extra?: string | null;
  data_ocorrencia?: string; // ISO string
  status?: string; // ex.: 'guarnicao_disponivel'
  id_guarnicao?: number | null; // FK -> guarnicao.id_guarnicao
  origem?: string | null; // 'app_civil', 'ciodes', etc.
};

export type InsertResult<T> = {
  data: T | null;
  error: string | null;
};

/**
 * Helper genérico para validar FKs.
 * Se o registro não existir (ou policy bloquear leitura), devolve null para evitar erro de constraint.
 *
 * Observação:
 * - Se RLS bloquear o SELECT nessa tabela, o "error" vem preenchido; nesse caso retornamos null.
 *   (Se você quiser "falhar" em vez de anular, mude essa lógica.)
 */
async function validateFk(
  table: string,
  pkColumn: string,
  value: number | null | undefined
): Promise<number | null> {
  if (value == null) return null;

  const n = typeof value === 'number' ? value : Number(value);
  if (!n || Number.isNaN(n)) return null;

  const { data, error } = await supabase
    .from(table)
    .select(pkColumn)
    .eq(pkColumn, n)
    .maybeSingle();

  if (error || !data) {
    console.warn(
      `[insertInfOco] FK inválida ou não acessível (RLS) em ${table}.${pkColumn}. Valor:`,
      n
    );
    return null;
  }

  return n;
}

/**
 * Cria uma ocorrência em inf_oco, garantindo:
 * - FKs inválidas viram null (evita violação de constraint)
 * - defaults coerentes
 */
export async function insertInfOco(
  payload: NewInfOco
): Promise<InsertResult<{ id_oco: number }>> {
  try {
    // =============================
    // 1) Validar FKs (em paralelo)
    // =============================
    const [
      solicitanteSafe,
      tipoOcoSafe,
      tipoVitiSafe,
      localOcoSafe,
      guarnicaoSafe,
    ] = await Promise.all([
      validateFk('users', 'id_user', payload.solicitante ?? null),
      validateFk('tipo_oco', 'id_tipo_oco', payload.tipo_oco_id ?? null),
      validateFk('tipo_vitim', 'id_tipo_vitim', payload.tipo_viti_id ?? null),
      validateFk('localizacao', 'id_local', payload.local_oco ?? null),
      validateFk('guarnicao', 'id_guarnicao', payload.id_guarnicao ?? null),
    ]);

    // =============================
    // 2) Defaults
    // =============================
    const statusDefault = (payload.status || 'guarnicao_disponivel').toString();

    const dataOcorrencia = payload.data_ocorrencia ?? new Date().toISOString();

    const origem = (payload.origem ?? 'app_civil').toString();

    const isTreinamento =
      typeof payload.is_treinamento === 'boolean'
        ? payload.is_treinamento
        : Number(payload.is_treinamento) === 1;

    // =============================
    // 3) Insert no Supabase
    // =============================
    const { data, error } = await supabase
      .from('inf_oco')
      .insert({
        solicitante: solicitanteSafe,
        tipo_oco_id: tipoOcoSafe,
        tipo_viti_id: tipoVitiSafe,
        local_oco: localOcoSafe,
        is_treinamento: isTreinamento,
        descricao_extra: payload.descricao_extra ?? null,
        data_ocorrencia: dataOcorrencia,
        status: statusDefault,
        id_guarnicao: guarnicaoSafe,
        origem,
      })
      // Se sua policy não permite retornar linha, isso pode falhar.
      // Mantive porque você usa no app. Se der erro por RLS, me diga que eu ajusto para "insert sem select" + requery.
      .select('id_oco')
      .maybeSingle();

    if (error || !data?.id_oco) {
      console.error('[Supabase] Erro ao inserir em inf_oco:', error);
      return { data: null, error: error?.message || 'Falha ao inserir inf_oco' };
    }

    return { data: { id_oco: data.id_oco }, error: null };
  } catch (e: any) {
    console.error('[insertInfOco] Erro inesperado:', e);
    return { data: null, error: String(e?.message ?? e) };
  }
}
