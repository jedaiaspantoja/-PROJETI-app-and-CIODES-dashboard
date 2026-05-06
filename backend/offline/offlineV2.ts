import * as SQLite from 'expo-sqlite';
import { supabase } from '../connectors/postgre';

let db: SQLite.SQLiteDatabase | null = null;

export function getOfflineV2Db() {
  if (!db) db = SQLite.openDatabaseSync('projeti_v2.db');
  return db;
}

export async function initOfflineV2Schema() {
  const database = getOfflineV2Db();
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS tipos_vitima (
      id INTEGER PRIMARY KEY,
      codigo TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      descricao TEXT,
      ordem INTEGER DEFAULT 0,
      ativo INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS tipos_ocorrencia (
      id INTEGER PRIMARY KEY,
      codigo TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      descricao TEXT,
      icone TEXT,
      ordem INTEGER DEFAULT 0,
      ativo INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS tutoriais (
      id TEXT PRIMARY KEY,
      tipo_ocorrencia_id INTEGER,
      titulo TEXT NOT NULL,
      descricao TEXT,
      ativo INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS tutorial_passos (
      id TEXT PRIMARY KEY,
      tutorial_id TEXT NOT NULL,
      tipo_vitima_id INTEGER,
      ordem INTEGER NOT NULL,
      texto TEXT NOT NULL,
      midia_url TEXT,
      midia_tipo TEXT
    );

    CREATE TABLE IF NOT EXISTS ocorrencias_pendentes (
      id_local TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      criada_em TEXT NOT NULL,
      tentativas INTEGER NOT NULL DEFAULT 0,
      ultimo_erro TEXT
    );
  `);
}

export async function executeOfflineSelect<T = any>(sql: string, params: any[] = []) {
  return (await getOfflineV2Db().getAllAsync(sql, params)) as T[];
}

export async function executeOfflineRun(sql: string, params: any[] = []) {
  return getOfflineV2Db().runAsync(sql, params);
}

export async function cacheReferenceDataV2(data: {
  tiposVitima?: any[];
  tiposOcorrencia?: any[];
  tutoriais?: any[];
  passos?: any[];
}) {
  const database = getOfflineV2Db();
  await database.execAsync('BEGIN');
  try {
    for (const item of data.tiposVitima || []) {
      await database.runAsync(
        `INSERT OR REPLACE INTO tipos_vitima (id, codigo, nome, descricao, ordem, ativo)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [item.id, item.codigo, item.nome, item.descricao ?? null, item.ordem ?? 0, item.ativo === false ? 0 : 1]
      );
    }

    for (const item of data.tiposOcorrencia || []) {
      await database.runAsync(
        `INSERT OR REPLACE INTO tipos_ocorrencia (id, codigo, nome, descricao, icone, ordem, ativo)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [item.id, item.codigo, item.nome, item.descricao ?? null, item.icone ?? null, item.ordem ?? 0, item.ativo === false ? 0 : 1]
      );
    }

    for (const item of data.tutoriais || []) {
      await database.runAsync(
        `INSERT OR REPLACE INTO tutoriais (id, tipo_ocorrencia_id, titulo, descricao, ativo)
         VALUES (?, ?, ?, ?, ?)`,
        [item.id, item.tipo_ocorrencia_id ?? null, item.titulo, item.descricao ?? null, item.ativo === false ? 0 : 1]
      );
    }

    for (const item of data.passos || []) {
      await database.runAsync(
        `INSERT OR REPLACE INTO tutorial_passos (id, tutorial_id, tipo_vitima_id, ordem, texto, midia_url, midia_tipo)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [item.id, item.tutorial_id, item.tipo_vitima_id ?? null, item.ordem, item.texto, item.midia_url ?? null, item.midia_tipo ?? null]
      );
    }

    await database.execAsync('COMMIT');
  } catch (error) {
    await database.execAsync('ROLLBACK');
    throw error;
  }
}

export async function savePendingOccurrence(payload: any) {
  await executeOfflineRun(
    `INSERT OR REPLACE INTO ocorrencias_pendentes (id_local, payload_json, criada_em)
     VALUES (?, ?, ?)`,
    [payload.id_local, JSON.stringify(payload), new Date().toISOString()]
  );
}

export async function syncPendingOccurrencesV2() {
  const pendentes = await executeOfflineSelect<{
    id_local: string;
    payload_json: string;
    tentativas: number;
  }>(
    `SELECT id_local, payload_json, tentativas
     FROM ocorrencias_pendentes
     WHERE tentativas < 5
     ORDER BY criada_em ASC`
  );

  for (const row of pendentes) {
    try {
      const payload = JSON.parse(row.payload_json);
      const { id_local: _idLocal, ...remotePayload } = payload;

      const { error } = await supabase.from('ocorrencias').insert(remotePayload);
      if (error) throw error;

      await executeOfflineRun('DELETE FROM ocorrencias_pendentes WHERE id_local = ?', [row.id_local]);
    } catch (error: any) {
      await executeOfflineRun(
        `UPDATE ocorrencias_pendentes
         SET tentativas = tentativas + 1,
             ultimo_erro = ?
         WHERE id_local = ?`,
        [String(error?.message || error), row.id_local]
      );
    }
  }
}
