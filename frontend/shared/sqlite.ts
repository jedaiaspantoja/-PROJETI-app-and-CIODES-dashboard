import * as SQLite from 'expo-sqlite';
import type { Caso } from './types';

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb() {
  if (!_db) _db = await SQLite.openDatabaseAsync('projeti.db');
  return _db;
}

/** Atualiza ou insere registros locais */
export async function upsertCasos(casos: Caso[]) {
  if (!casos?.length) return;
  const db = await getDb();
  await db.execAsync('BEGIN');
  try {
    for (const c of casos) {
      await db.runAsync(
        `INSERT INTO casos (id, titulo, descricao, atualizado_em)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           titulo = excluded.titulo,
           descricao = excluded.descricao,
           atualizado_em = excluded.atualizado_em
         WHERE excluded.atualizado_em >= casos.atualizado_em;`,
        [c.id, c.titulo, c.descricao ?? null, c.atualizado_em]
      );
    }
    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}

/** Busca os casos salvos localmente */
export async function getCasosOffline(): Promise<Caso[]> {
  const db = await getDb();
  return (
    (await db.getAllAsync<Caso>(
      `SELECT id, titulo, descricao, atualizado_em
       FROM casos
       ORDER BY atualizado_em DESC`
    )) ?? []
  );
}
