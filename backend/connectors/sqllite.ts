// backend/connectors/sqllite.ts
import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

// Abre (ou cria) o banco local
export function getOfflineDb() {
  if (!db) {
    // mantém o mesmo nome para não quebrar o que você já tem
    db = SQLite.openDatabaseSync('projeti_offline_v20.db');
  }
  return db;
}

/**
 * Executa um SELECT e retorna um array tipado.
 */
export async function executeSelect<T = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const database = getOfflineDb();
  const rows = (await database.getAllAsync(sql, params)) as T[];
  return rows;
}

/**
 * Executa INSERT/UPDATE/DELETE.
 */
export async function executeRun(
  sql: string,
  params: any[] = []
): Promise<{ rowsAffected: number; insertId?: number }> {
  const database = getOfflineDb();
  const result = await database.runAsync(sql, params);

  return {
    rowsAffected: result.changes ?? 0,
    insertId: result.lastInsertRowId,
  };
}

/* ============================================================
   MIGRAÇÕES IDOMPOTENTES (NÃO DUPLICAM COLUNAS)
   ============================================================ */

async function columnExists(table: string, column: string): Promise<boolean> {
  const database = getOfflineDb();
  const cols = await database.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${table})`
  );
  return cols.some((c) => c.name === column);
}

async function tableExists(table: string): Promise<boolean> {
  const rows = await executeSelect<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=? LIMIT 1`,
    [table]
  );
  return rows.length > 0;
}

/**
 * Garante midia.local_path (apenas se não existir).
 * Evita o erro: duplicate column name: local_path
 */
export async function ensureMidiaLocalPathColumn() {
  const database = getOfflineDb();

  const exists = await tableExists('midia');
  if (!exists) return;

  const has = await columnExists('midia', 'local_path');
  if (!has) {
    await database.execAsync(`ALTER TABLE midia ADD COLUMN local_path TEXT;`);
    console.log('[SQLite] Coluna midia.local_path criada.');
  } else {
    console.log('[SQLite] Coluna midia.local_path já existe (ok).');
  }
}

/**
 * Garante que tutorial_steps tenha coluna "midia" (INTEGER) e NÃO use midia_codigos.
 * Se detectar schema antigo, recria a tabela (é dado de referência/sync, pode recriar).
 */
export async function ensureTutorialStepsSchema() {
  const database = getOfflineDb();

  const exists = await tableExists('tutorial_steps');
  if (!exists) return;

  const hasMidia = await columnExists('tutorial_steps', 'midia');
  const hasMidiaCodigos = await columnExists('tutorial_steps', 'midia_codigos');

  // Caso antigo detectado (midia_codigos) e falta midia: recria
  if (!hasMidia && hasMidiaCodigos) {
    console.warn(
      '[SQLite] tutorial_steps está no schema antigo (midia_codigos). Recriando para schema novo (midia INTEGER)...'
    );

    await database.execAsync(`
      PRAGMA foreign_keys = OFF;

      ALTER TABLE tutorial_steps RENAME TO tutorial_steps_old;

      CREATE TABLE IF NOT EXISTS tutorial_steps (
        id_step        INTEGER PRIMARY KEY,
        id_tutorial    INTEGER NOT NULL,
        ordem          INTEGER NOT NULL,
        texto          TEXT NOT NULL,
        id_tipo_vitim  INTEGER,
        midia          INTEGER,
        UNIQUE (id_tutorial, ordem, id_tipo_vitim)
      );

      -- Migra dados básicos (texto etc.). Não tem como mapear midia_codigos -> midia (id) automaticamente.
      INSERT INTO tutorial_steps (id_step, id_tutorial, ordem, texto, id_tipo_vitim, midia)
      SELECT id_step, id_tutorial, ordem, texto, id_tipo_vitim, NULL
      FROM tutorial_steps_old;

      DROP TABLE tutorial_steps_old;

      PRAGMA foreign_keys = ON;
    `);

    console.log('[SQLite] tutorial_steps recriada no schema novo.');
    return;
  }

  // Se tabela já é nova, mas não tem midia (muito improvável), tenta ALTER
  if (!hasMidia && !hasMidiaCodigos) {
    try {
      await database.execAsync(`ALTER TABLE tutorial_steps ADD COLUMN midia INTEGER;`);
      console.log('[SQLite] Coluna tutorial_steps.midia criada.');
    } catch (e) {
      console.warn('[SQLite] Falha ao criar coluna tutorial_steps.midia (ignorar):', e);
    }
  }
}

/**
 * Cria o schema offline espelhando o Postgre,
 * incluindo cache local_path em midia e tutorial_steps com FK midia.
 */
export async function initOfflineSchema() {
  const database = getOfflineDb();

  await database.execAsync(`
    PRAGMA foreign_keys = OFF;

    -- =========================
    -- CATEGORIAS DE USUÁRIO
    -- =========================
    CREATE TABLE IF NOT EXISTS cat_user (
      id_cat INTEGER PRIMARY KEY,
      nome   TEXT NOT NULL
    );

    -- =========================
    -- GUARNAÇÃO (VIATURA / EQUIPE)
    -- =========================
    CREATE TABLE IF NOT EXISTS guarnicao (
      id_guarnicao  INTEGER PRIMARY KEY,
      tipo_viatura  TEXT NOT NULL,
      prefixo       TEXT NOT NULL,
      descricao     TEXT,
      ativo         INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT
    );

    -- =========================
    -- MEMBROS DE GUARNAÇÃO POR PLANTÃO
    -- =========================
    CREATE TABLE IF NOT EXISTS guarnicao_membros (
      id_membro      INTEGER PRIMARY KEY,
      id_guarnicao   INTEGER NOT NULL,
      id_user        INTEGER NOT NULL,
      data_plantao   TEXT NOT NULL,
      turno          TEXT,
      ativo_no_turno INTEGER NOT NULL DEFAULT 1,
      created_at     TEXT
    );

    -- =========================
    -- USUÁRIOS
    -- =========================
    CREATE TABLE IF NOT EXISTS users (
      id_user             INTEGER PRIMARY KEY,
      cat_user_id         INTEGER,
      nome_user           TEXT NOT NULL,
      email_user          TEXT NOT NULL,
      cpf_matricula       TEXT NOT NULL,
      telefone            TEXT,
      id_guarnicao_padrao INTEGER,
      senha               TEXT NOT NULL,
      created_at          TEXT,
      updated_at          TEXT,
      synced              INTEGER DEFAULT 0,
      operation           TEXT DEFAULT 'create'
    );

    -- =========================
    -- TIPOS DE VÍTIMA
    -- =========================
    CREATE TABLE IF NOT EXISTS tipo_vitim (
      id_tipo_vitim INTEGER PRIMARY KEY,
      tipo          TEXT NOT NULL,
      descricao     TEXT
    );

    -- =========================
    -- TIPOS DE OCORRÊNCIA
    -- =========================
    CREATE TABLE IF NOT EXISTS tipo_oco (
      id_tipo_oco INTEGER PRIMARY KEY,
      nome_oco    TEXT NOT NULL,
      descricao   TEXT,
      severidade  INTEGER,
      ativo       INTEGER NOT NULL DEFAULT 1
    );

    -- =========================
    -- LOCALIZAÇÃO
    -- =========================
    CREATE TABLE IF NOT EXISTS localizacao (
      id_local      INTEGER PRIMARY KEY,
      latitude      REAL,
      longitude     REAL,
      precisao_m    REAL,
      fonte         TEXT,
      capturado_em  TEXT
    );

    -- =========================
    -- INF_OCO (OCORRÊNCIAS)
    -- =========================
    CREATE TABLE IF NOT EXISTS inf_oco (
      id_oco          INTEGER PRIMARY KEY,
      solicitante     INTEGER,
      tipo_oco_id     INTEGER,
      tipo_viti_id    INTEGER,
      local_oco       INTEGER,
      id_guarnicao    INTEGER,
      origem          TEXT,
      is_treinamento  INTEGER NOT NULL DEFAULT 0,
      descricao_extra TEXT,
      data_ocorrencia TEXT,
      created_at      TEXT,
      updated_at      TEXT,
      status          TEXT DEFAULT 'guarnicao_disponivel',
      synced          INTEGER DEFAULT 0,
      operation       TEXT DEFAULT 'create'
    );

    -- =========================
    -- HISTÓRICO DE STATUS DA OCORRÊNCIA
    -- =========================
    CREATE TABLE IF NOT EXISTS inf_oco_status_log (
      id_log      INTEGER PRIMARY KEY,
      id_oco      INTEGER NOT NULL,
      status      TEXT NOT NULL,
      observacao  TEXT,
      autor_id    INTEGER,
      changed_at  TEXT
    );

    -- =========================
    -- MÍDIA DAS OCORRÊNCIAS
    -- =========================
    CREATE TABLE IF NOT EXISTS inf_oco_midia (
      id_midia_oco INTEGER PRIMARY KEY,
      id_oco       INTEGER NOT NULL,
      url          TEXT NOT NULL,
      descricao    TEXT,
      created_at   TEXT
    );

    -- =========================
    -- MÍDIA – biblioteca (para tutoriais)
    -- (COM local_path PARA CACHE OFFLINE)
    -- =========================
    CREATE TABLE IF NOT EXISTS midia (
      id_midia    INTEGER PRIMARY KEY,
      url         TEXT NOT NULL,
      descricao   TEXT,
      created_at  TEXT,
      local_path  TEXT
    );

    -- =========================
    -- TUTORIAIS (cabeçalho)
    -- =========================
    CREATE TABLE IF NOT EXISTS tutoriais (
      id_tutorial INTEGER PRIMARY KEY,
      titulo      TEXT NOT NULL,
      descricao   TEXT,
      ativo       INTEGER NOT NULL DEFAULT 1,
      tipo_oco_id INTEGER NOT NULL
    );

    -- =========================
    -- TUTORIAL_STEPS (schema NOVO)
    -- - midia INTEGER (FK para midia.id_midia)
    -- =========================
    CREATE TABLE IF NOT EXISTS tutorial_steps (
      id_step        INTEGER PRIMARY KEY,
      id_tutorial    INTEGER NOT NULL,
      ordem          INTEGER NOT NULL,
      texto          TEXT NOT NULL,
      id_tipo_vitim  INTEGER,
      midia          INTEGER,
      UNIQUE (id_tutorial, ordem, id_tipo_vitim)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_tutorial_steps_unique
      ON tutorial_steps (id_tutorial, ordem, id_tipo_vitim);

    CREATE INDEX IF NOT EXISTS idx_tutorial_steps_tutorial
      ON tutorial_steps (id_tutorial);

    PRAGMA foreign_keys = ON;
  `);

  // Garantias idempotentes (para bancos existentes)
  await ensureMidiaLocalPathColumn();
  await ensureTutorialStepsSchema();

  console.log('[SQLite] Schema offline inicializado/validado');
}
