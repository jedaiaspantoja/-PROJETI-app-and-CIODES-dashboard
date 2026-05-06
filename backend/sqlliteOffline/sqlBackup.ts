// backend/sqlliteOffline/sqlBackup.ts
import { supabase } from '../connectors/postgre';
import { executeRun, executeSelect } from '../connectors/sqllite';
import { insertInfOco } from '../postgreOnline/postInsert';

/**
 * Tipos básicos (ajuste se sua tabela tiver mais colunas locais).
 */
type LocalInfOcoRow = {
  id_oco: number | null;
  solicitante: number | null;
  local_oco: number | null;
  tipo_oco_id: number | null;
  tipo_viti_id: number | null;
  is_treinamento: number; // 0/1
  data_ocorrencia: string | null;
  synced: number; // 0/1
  operation: string | null; // 'create' | 'update' | 'delete' | 'none' | 'error_fk' | null
};

/**
 * Helper genérico para sincronizar tabela de referência:
 * - busca no Supabase
 * - limpa tabela local (opcional)
 * - reinsere via INSERT OR REPLACE / UPSERT
 *
 * OBS: para midia, NÃO vamos limpar para preservar local_path.
 */
async function syncSimpleReferenceTable<T>(
  tableName: string,
  selectQuery: () => Promise<T[]>,
  clearLocalSql: string | null,
  insertRow: (row: T) => Promise<void>
) {
  try {
    const rows = await selectQuery();
    console.log(`[SYNC] ${tableName}: recebidos ${rows.length} registros do Supabase.`);

    if (clearLocalSql) {
      await executeRun(clearLocalSql);
    }

    for (const row of rows) {
      await insertRow(row);
    }

    console.log(`[SYNC] ${tableName}: sincronizado com sucesso.`);
  } catch (err) {
    console.error(`[SYNC] Erro em syncSimpleReferenceTable(${tableName}):`, err);
    throw err;
  }
}

/**
 * Garante que a coluna midia.local_path exista sem quebrar.
 * (Se você já chama isso no initOfflineSchema, aqui é só redundância segura.)
 */
async function ensureMidiaLocalPathColumn() {
  try {
    const cols = await executeSelect<{ name: string }>(`PRAGMA table_info(midia)`);
    const has = cols.some((c) => c.name === 'local_path');
    if (!has) {
      await executeRun(`ALTER TABLE midia ADD COLUMN local_path TEXT;`);
      console.log('[SYNC] midia.local_path criada.');
    }
  } catch (e) {
    console.warn('[SYNC] Não foi possível garantir midia.local_path (ignorar):', e);
  }
}

/**
 * Sincroniza as tabelas de referência:
 * - cat_user
 * - tipo_oco
 * - tipo_vitim
 * - tutoriais
 * - midia (preserva local_path)
 * - tutorial_steps (coluna midia int)
 */
export async function syncReferenceDataFromOnline() {
  try {
    console.log('[SYNC] Iniciando sincronização de dados de referência...');

    // 0) garantir coluna local_path antes de mexer na midia
    await ensureMidiaLocalPathColumn();

    // 1) cat_user
    await syncSimpleReferenceTable(
      'cat_user',
      async () => {
        const { data, error } = await supabase
          .from('cat_user')
          .select('id_cat, nome')
          .order('id_cat', { ascending: true });
        if (error) throw error;
        return (data as any[]) || [];
      },
      'DELETE FROM cat_user',
      async (row: any) => {
        await executeRun('INSERT OR REPLACE INTO cat_user (id_cat, nome) VALUES (?, ?)', [
          row.id_cat,
          row.nome ?? '',
        ]);
      }
    );

    // 2) tipo_oco
    await syncSimpleReferenceTable(
      'tipo_oco',
      async () => {
        const { data, error } = await supabase
          .from('tipo_oco')
          .select('id_tipo_oco, nome_oco, descricao, severidade, ativo')
          .order('id_tipo_oco', { ascending: true });
        if (error) throw error;
        return (data as any[]) || [];
      },
      'DELETE FROM tipo_oco',
      async (row: any) => {
        await executeRun(
          `
          INSERT OR REPLACE INTO tipo_oco (id_tipo_oco, nome_oco, descricao, severidade, ativo)
          VALUES (?, ?, ?, ?, ?)
        `,
          [
            row.id_tipo_oco,
            row.nome_oco ?? '',
            row.descricao ?? null,
            row.severidade ?? null,
            row.ativo ?? 1,
          ]
        );
      }
    );

    // 3) tipo_vitim
    await syncSimpleReferenceTable(
      'tipo_vitim',
      async () => {
        const { data, error } = await supabase
          .from('tipo_vitim')
          .select('id_tipo_vitim, tipo, descricao')
          .order('id_tipo_vitim', { ascending: true });
        if (error) throw error;
        return (data as any[]) || [];
      },
      'DELETE FROM tipo_vitim',
      async (row: any) => {
        await executeRun(
          `
          INSERT OR REPLACE INTO tipo_vitim (id_tipo_vitim, tipo, descricao)
          VALUES (?, ?, ?)
        `,
          [row.id_tipo_vitim, row.tipo ?? '', row.descricao ?? null]
        );
      }
    );

    // 4) tutoriais
    await syncSimpleReferenceTable(
      'tutoriais',
      async () => {
        const { data, error } = await supabase
          .from('tutoriais')
          .select('id_tutorial, titulo, descricao, ativo, tipo_oco_id')
          .order('id_tutorial', { ascending: true });
        if (error) throw error;
        return (data as any[]) || [];
      },
      'DELETE FROM tutoriais',
      async (row: any) => {
        await executeRun(
          `
          INSERT OR REPLACE INTO tutoriais (id_tutorial, titulo, descricao, ativo, tipo_oco_id)
          VALUES (?, ?, ?, ?, ?)
        `,
          [
            row.id_tutorial,
            row.titulo ?? '',
            row.descricao ?? null,
            row.ativo ?? 1,
            row.tipo_oco_id ?? null,
          ]
        );
      }
    );

    // 5) midia (NÃO DELETA! preserva local_path)
    await syncSimpleReferenceTable(
      'midia',
      async () => {
        const { data, error } = await supabase
          .from('midia')
          .select('id_midia, url, descricao, created_at')
          .order('id_midia', { ascending: true });
        if (error) throw error;
        return (data as any[]) || [];
      },
      null, // << NÃO LIMPA
      async (row: any) => {
        // UPSERT preservando local_path existente
        await executeRun(
          `
          INSERT INTO midia (id_midia, url, descricao, created_at, local_path)
          VALUES (?, ?, ?, ?, NULL)
          ON CONFLICT(id_midia) DO UPDATE SET
            url = excluded.url,
            descricao = excluded.descricao,
            created_at = excluded.created_at
        `,
          [row.id_midia, row.url ?? '', row.descricao ?? null, row.created_at ?? null]
        );
      }
    );

    // 6) tutorial_steps (limpa e repõe: tabela de referência)
    await syncSimpleReferenceTable(
      'tutorial_steps',
      async () => {
        const { data, error } = await supabase
          .from('tutorial_steps')
          .select('id_step, id_tutorial, ordem, texto, id_tipo_vitim, midia')
          .order('id_tutorial', { ascending: true })
          .order('ordem', { ascending: true })
          .order('id_step', { ascending: true });
        if (error) throw error;
        return (data as any[]) || [];
      },
      'DELETE FROM tutorial_steps',
      async (row: any) => {
        await executeRun(
          `
          INSERT OR REPLACE INTO tutorial_steps (
            id_step, id_tutorial, ordem, texto, id_tipo_vitim, midia
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
          [
            row.id_step,
            row.id_tutorial,
            row.ordem ?? 0,
            row.texto ?? '',
            row.id_tipo_vitim ?? null,
            row.midia ?? null,
          ]
        );
      }
    );

    console.log('[SYNC] Dados de referência sincronizados (sem erros fatais).');
  } catch (err) {
    console.error('[SYNC] Erro ao sincronizar dados de referência (wrapper):', err);
  }
}

/**
 * Verifica se um tipo_oco_id existe na tabela local tipo_oco.
 * Ajuda a impedir envio com FK inválida.
 */
async function localTipoOcoExists(tipoOcoId: number | null): Promise<boolean> {
  if (!tipoOcoId) return false;
  const rows = await executeSelect<{ id_tipo_oco: number }>(
    'SELECT id_tipo_oco FROM tipo_oco WHERE id_tipo_oco = ? LIMIT 1',
    [tipoOcoId]
  );
  return rows.length > 0;
}

/**
 * Marca um registro local como erro de FK para não ficar reenviando eternamente.
 */
async function markLocalInfOcoAsFkError(localId: number | null, reason: string) {
  if (!localId) return;
  console.warn(
    `[SYNC] Marcando inf_oco local id_oco=${localId} como error_fk. Motivo: ${reason}`
  );
  await executeRun(
    `
      UPDATE inf_oco
      SET operation = 'error_fk'
      WHERE id_oco = ?
    `,
    [localId]
  );
}

/**
 * Sincroniza inf_oco pendentes (registrados offline) para o Supabase.
 * Apenas registros com synced = 0 e operation = 'create'.
 */
export async function syncInfOcoPendingToOnline() {
  try {
    console.log('[SYNC] Verificando inf_oco pendentes para enviar ao servidor...');

    const pendentes = await executeSelect<LocalInfOcoRow>(
      `
      SELECT
        id_oco,
        solicitante,
        local_oco,
        tipo_oco_id,
        tipo_viti_id,
        is_treinamento,
        data_ocorrencia,
        synced,
        operation
      FROM inf_oco
      WHERE synced = 0
    `
    );

    if (!pendentes.length) {
      console.log('[SYNC] Nenhuma ocorrência pendente para enviar.');
      return;
    }

    console.log(`[SYNC] Encontradas ${pendentes.length} ocorrências pendentes.`);

    for (const row of pendentes) {
      if (row.operation !== 'create') {
        console.log(
          `[SYNC] Ignorando linha com operation='${row.operation}' (id_oco local = ${row.id_oco}).`
        );
        continue;
      }

      const tipoOcoOkLocal = await localTipoOcoExists(row.tipo_oco_id);
      if (!tipoOcoOkLocal) {
        await markLocalInfOcoAsFkError(
          row.id_oco,
          `tipo_oco_id inválido/local inexistente: ${row.tipo_oco_id}`
        );
        continue;
      }

      try {
        const { data, error } = await insertInfOco({
          solicitante: row.solicitante,
          local_oco: row.local_oco,
          tipo_oco_id: row.tipo_oco_id,
          tipo_viti_id: row.tipo_viti_id,
          is_treinamento: !!row.is_treinamento,
          data_ocorrencia: row.data_ocorrencia ?? undefined,
          origem: 'app_civil',
        });

        if (error || !data) {
          console.error(
            `[SYNC] Erro ao enviar inf_oco local (id_oco local = ${row.id_oco}) para Supabase:`,
            error
          );
          await markLocalInfOcoAsFkError(row.id_oco, `falha ao inserir no Supabase: ${error}`);
          continue;
        }

        console.log(
          `[SYNC] Ocorrência local (id_oco local = ${row.id_oco}) enviada. id_oco remoto = ${data?.id_oco}`
        );

        await executeRun(
          `
          UPDATE inf_oco
          SET synced = 1,
              operation = 'none'
          WHERE id_oco = ?
        `,
          [row.id_oco]
        );
      } catch (err2) {
        console.error(
          `[SYNC] Erro inesperado ao sincronizar ocorrência local (id_oco = ${row.id_oco}):`,
          err2
        );
        await markLocalInfOcoAsFkError(row.id_oco, `erro inesperado: ${String(err2)}`);
      }
    }

    console.log('[SYNC] Sincronização de ocorrências pendentes finalizada.');
  } catch (err) {
    console.error('[SYNC] Erro geral em syncInfOcoPendingToOnline:', err);
  }
}
