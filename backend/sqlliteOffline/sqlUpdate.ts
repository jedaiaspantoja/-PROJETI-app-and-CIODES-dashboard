// backend/sqlliteOffline/sqlUpdate.ts
import { executeRun, executeSelect } from '../connectors/sqllite';

/**
 * Gera um id_oco local NEGATIVO para não colidir com ids do Supabase (identity positivo).
 * Ex.: -Date.now()
 */
function generateLocalInfOcoId(): number {
  return -Math.abs(Date.now());
}

/**
 * (Opcional) garante que status nunca venha vazio.
 */
function normalizeStatus(status?: string | null): string {
  const s = (status ?? '').trim();
  return s ? s : 'guarnicao_disponivel';
}

/**
 * Cria ocorrência offline e marca como pendente de sincronização.
 *
 * IMPORTANTE:
 * - Se não passar id_oco, o método gera um id local NEGATIVO.
 * - Retorna o id_oco usado (para a UI navegar/abrir detalhes).
 */
export async function createInfOcoOffline(params: {
  id_oco?: number; // se não vier, geramos um negativo
  solicitante: number | null;
  local_oco: number | null;
  tipo_oco_id: number | null;
  tipo_viti_id: number | null;
  is_treinamento: number; // 0 ou 1
  descricao_extra?: string | null;
  dataOcorrenciaISO: string; // ISO string
  status?: string | null;
  id_guarnicao?: number | null;
  origem?: string | null; // 'app_civil', 'ciodes', etc.
}): Promise<number> {
  const {
    id_oco,
    solicitante,
    local_oco,
    tipo_oco_id,
    tipo_viti_id,
    is_treinamento,
    descricao_extra,
    dataOcorrenciaISO,
    status,
    id_guarnicao,
    origem,
  } = params;

  const nowISO = new Date().toISOString();
  const localId = typeof id_oco === 'number' && !Number.isNaN(id_oco) ? id_oco : generateLocalInfOcoId();

  await executeRun(
    `
    INSERT INTO inf_oco (
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
      synced,
      operation
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'create')
  `,
    [
      localId,
      solicitante,
      tipo_oco_id,
      tipo_viti_id,
      local_oco,
      id_guarnicao ?? null,
      origem ?? 'app_civil',
      is_treinamento,
      descricao_extra ?? null,
      dataOcorrenciaISO,
      nowISO,
      nowISO,
      normalizeStatus(status),
    ]
  );

  return localId;
}

/**
 * Atualiza ocorrência offline e marca como 'update'
 *
 * Observação importante:
 * - Com COALESCE(?, campo), você NÃO consegue diferenciar "não enviar" vs "setar null".
 *   Aqui assumimos que null = "não alterar". Se você precisar "setar null",
 *   a solução é usar flags (ex.: setLocalOcoNull: true) ou um sentinel.
 */
export async function updateInfOcoOffline(params: {
  id_oco: number;
  local_oco?: number | null;
  tipo_oco_id?: number | null;
  tipo_viti_id?: number | null;
  descricao_extra?: string | null;
  status?: string | null;
  id_guarnicao?: number | null;
  origem?: string | null;
}) {
  const {
    id_oco,
    local_oco,
    tipo_oco_id,
    tipo_viti_id,
    descricao_extra,
    status,
    id_guarnicao,
    origem,
  } = params;

  const nowISO = new Date().toISOString();

  await executeRun(
    `
    UPDATE inf_oco
    SET
      local_oco       = COALESCE(?, local_oco),
      tipo_oco_id     = COALESCE(?, tipo_oco_id),
      tipo_viti_id    = COALESCE(?, tipo_viti_id),
      descricao_extra = COALESCE(?, descricao_extra),
      status          = COALESCE(?, status),
      id_guarnicao    = COALESCE(?, id_guarnicao),
      origem          = COALESCE(?, origem),
      updated_at      = ?,
      synced          = 0,
      operation       = 'update'
    WHERE id_oco = ?
  `,
    [
      local_oco ?? null,
      tipo_oco_id ?? null,
      tipo_viti_id ?? null,
      descricao_extra ?? null,
      status ? normalizeStatus(status) : null,
      id_guarnicao ?? null,
      origem ?? null,
      nowISO,
      id_oco,
    ]
  );
}

/**
 * Marca registro para exclusão quando for sincronizar.
 * (Não deleta de imediato, para preservar histórico e permitir re-sync)
 */
export async function markInfOcoDeletedOffline(id_oco: number) {
  await executeRun(
    `
    UPDATE inf_oco
    SET
      synced    = 0,
      operation = 'delete',
      updated_at = ?
    WHERE id_oco = ?
  `,
    [new Date().toISOString(), id_oco]
  );
}

/**
 * --- MUITO IMPORTANTE (para sua sincronização ficar consistente) ---
 * Quando você inserir a ocorrência no Supabase e receber um id_oco remoto,
 * você PRECISA mapear o local -> remoto.
 *
 * A forma mais simples (se não houver outras FKs apontando para inf_oco):
 * - sobrescrever o id_oco local pelo remoto
 *
 * Se houver outras tabelas referenciando inf_oco.id_oco (ex.: inf_oco_status_log, inf_oco_midia),
 * então o melhor é: adicionar coluna `id_oco_remote` em inf_oco e NÃO sobrescrever id_oco.
 */
export async function replaceLocalInfOcoIdWithRemote(params: {
  localId: number;
  remoteId: number;
}) {
  const { localId, remoteId } = params;

  // ATENÇÃO: isso só é seguro se NÃO houver tabelas que referenciam inf_oco.id_oco
  await executeRun(
    `
    UPDATE inf_oco
    SET id_oco = ?,
        synced = 1,
        operation = 'none'
    WHERE id_oco = ?
  `,
    [remoteId, localId]
  );
}

/**
 * Alternativa segura (recomendada se você tem tabelas filhas referenciando id_oco):
 * - Crie a coluna `id_oco_remote` na tabela inf_oco
 * - Atualize somente essa coluna aqui
 *
 * Exemplo de migration SQLite:
 *   ALTER TABLE inf_oco ADD COLUMN id_oco_remote INTEGER;
 */
export async function setRemoteIdForLocalInfOco(params: {
  localId: number;
  remoteId: number;
}) {
  const { localId, remoteId } = params;

  // Só funciona se você já adicionou a coluna id_oco_remote no SQLite
  await executeRun(
    `
    UPDATE inf_oco
    SET id_oco_remote = ?,
        synced = 1,
        operation = 'none'
    WHERE id_oco = ?
  `,
    [remoteId, localId]
  );
}
