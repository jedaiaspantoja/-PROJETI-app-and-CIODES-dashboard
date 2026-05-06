// backend/sqlliteOffline/sqlSearch.ts
import { executeSelect } from '../connectors/sqllite';
import {
  handleSupabase,
  CatUser,
  TipoOco,
  TipoVitim,
  Midia,
  User,
  InfOco,
  Tutorial,
} from '../connectors/postgre';

/**
 * NOVO formato do step no OFFLINE:
 * - tutorial_steps.midia é INTEGER (FK) -> midia.id_midia
 * - aqui já trazemos a mídia resolvida via JOIN (url/local_path/descricao)
 */
export type TutorialStepRow = {
  id_step: number;
  id_tutorial: number;
  ordem: number;
  texto: string;
  id_tipo_vitim: number | null;

  // FK no SQLite (novo)
  midia: number | null;

  // mídia resolvida (para UI)
  midia_obj: {
    id_midia: number;
    url: string;
    descricao: string | null;
    created_at: string | null;
    local_path?: string | null; // opcional (se você adicionou no SQLite)
  } | null;
};

// --------------------------------------------------------------
// CAT_USER (offline - SQLite)
// --------------------------------------------------------------
export async function getAllCatUser() {
  try {
    const rows = await executeSelect<CatUser>('SELECT id_cat, nome FROM cat_user');
    return handleSupabase<CatUser[]>(rows, null);
  } catch (error: any) {
    return handleSupabase<CatUser[] | null>(null, error);
  }
}

// --------------------------------------------------------------
// TIPO_VITIM (offline - SQLite)
// --------------------------------------------------------------
export async function getAllTipoVitim() {
  try {
    const rows = await executeSelect<TipoVitim>(
      'SELECT id_tipo_vitim, tipo, descricao FROM tipo_vitim'
    );
    return handleSupabase<TipoVitim[]>(rows, null);
  } catch (error: any) {
    return handleSupabase<TipoVitim[] | null>(null, error);
  }
}

// --------------------------------------------------------------
// TIPO_OCO (offline - SQLite)
// --------------------------------------------------------------
export async function getAllTipoOco() {
  try {
    const rows = await executeSelect<TipoOco>(
      'SELECT id_tipo_oco, nome_oco, descricao, severidade, ativo FROM tipo_oco'
    );
    return handleSupabase<TipoOco[]>(rows, null);
  } catch (error: any) {
    return handleSupabase<TipoOco[] | null>(null, error);
  }
}

// --------------------------------------------------------------
// MIDIA (offline - SQLite)
// - tenta trazer local_path se existir (não quebra se não existir)
// --------------------------------------------------------------
export async function getAllMidia() {
  try {
    // Se você já criou a coluna local_path, esse SELECT funciona.
    // Se ainda não criou, o catch abaixo pega e faz fallback sem local_path.
    const rows = await executeSelect<any>(
      'SELECT id_midia, url, descricao, created_at, local_path FROM midia'
    );
    return handleSupabase<Midia[]>(rows as Midia[], null);
  } catch {
    try {
      const rows = await executeSelect<Midia>(
        'SELECT id_midia, url, descricao, created_at FROM midia'
      );
      return handleSupabase<Midia[]>(rows, null);
    } catch (error: any) {
      return handleSupabase<Midia[] | null>(null, error);
    }
  }
}

// --------------------------------------------------------------
// TUTORIAIS (offline - SQLite)
// --------------------------------------------------------------
export async function getAllTutoriais() {
  try {
    const rows = await executeSelect<Tutorial>(
      'SELECT id_tutorial, titulo, descricao, ativo, tipo_oco_id FROM tutoriais'
    );
    return handleSupabase<Tutorial[]>(rows, null);
  } catch (error: any) {
    return handleSupabase<Tutorial[] | null>(null, error);
  }
}

// --------------------------------------------------------------
// TUTORIAL STEPS (1 tutorial específico - offline)
// - já resolve mídia via LEFT JOIN
// --------------------------------------------------------------
export async function getTutorialSteps(id_tutorial: number) {
  try {
    // Observação:
    // - tutorial_steps.midia deve existir no SQLite (INTEGER)
    // - midia.local_path é opcional (se não existir, o SELECT pode falhar -> fallback)
    const rows = await executeSelect<any>(
      `
      SELECT
        ts.id_step,
        ts.id_tutorial,
        ts.ordem,
        ts.texto,
        ts.id_tipo_vitim,
        ts.midia,

        m.id_midia            AS m_id_midia,
        m.url                 AS m_url,
        m.descricao           AS m_descricao,
        m.created_at          AS m_created_at,
        m.local_path          AS m_local_path
      FROM tutorial_steps ts
      LEFT JOIN midia m
        ON m.id_midia = ts.midia
      WHERE ts.id_tutorial = ?
      ORDER BY ts.ordem ASC, ts.id_step ASC
      `,
      [id_tutorial]
    );

    const mapped: TutorialStepRow[] = rows.map((r: any) => ({
      id_step: r.id_step,
      id_tutorial: r.id_tutorial,
      ordem: r.ordem,
      texto: r.texto,
      id_tipo_vitim: r.id_tipo_vitim ?? null,
      midia: r.midia ?? null,
      midia_obj: r.m_id_midia
        ? {
            id_midia: r.m_id_midia,
            url: r.m_url,
            descricao: r.m_descricao ?? null,
            created_at: r.m_created_at ?? null,
            local_path: r.m_local_path ?? null,
          }
        : null,
    }));

    return handleSupabase<TutorialStepRow[]>(mapped, null);
  } catch (errJoin: any) {
    // Fallback: caso você AINDA não tenha local_path no SQLite
    // ou ainda não tenha coluna midia na tutorial_steps.
    try {
      const rows = await executeSelect<any>(
        `
        SELECT
          ts.id_step,
          ts.id_tutorial,
          ts.ordem,
          ts.texto,
          ts.id_tipo_vitim,
          ts.midia,

          m.id_midia   AS m_id_midia,
          m.url        AS m_url,
          m.descricao  AS m_descricao,
          m.created_at AS m_created_at
        FROM tutorial_steps ts
        LEFT JOIN midia m
          ON m.id_midia = ts.midia
        WHERE ts.id_tutorial = ?
        ORDER BY ts.ordem ASC, ts.id_step ASC
        `,
        [id_tutorial]
      );

      const mapped: TutorialStepRow[] = rows.map((r: any) => ({
        id_step: r.id_step,
        id_tutorial: r.id_tutorial,
        ordem: r.ordem,
        texto: r.texto,
        id_tipo_vitim: r.id_tipo_vitim ?? null,
        midia: r.midia ?? null,
        midia_obj: r.m_id_midia
          ? {
              id_midia: r.m_id_midia,
              url: r.m_url,
              descricao: r.m_descricao ?? null,
              created_at: r.m_created_at ?? null,
              local_path: null,
            }
          : null,
      }));

      return handleSupabase<TutorialStepRow[]>(mapped, null);
    } catch (error: any) {
      console.error('[sqlSearch] Erro em getTutorialSteps (offline):', errJoin, error);
      return handleSupabase<TutorialStepRow[] | null>(null, error);
    }
  }
}

// --------------------------------------------------------------
// TUTORIAL STEPS (TODOS – para debug/sync local, se precisar)
// --------------------------------------------------------------
export async function getAllTutorialSteps() {
  try {
    const rows = await executeSelect<any>(
      `
      SELECT
        ts.id_step,
        ts.id_tutorial,
        ts.ordem,
        ts.texto,
        ts.id_tipo_vitim,
        ts.midia,

        m.id_midia            AS m_id_midia,
        m.url                 AS m_url,
        m.descricao           AS m_descricao,
        m.created_at          AS m_created_at,
        m.local_path          AS m_local_path
      FROM tutorial_steps ts
      LEFT JOIN midia m
        ON m.id_midia = ts.midia
      ORDER BY ts.id_tutorial ASC, ts.ordem ASC, ts.id_step ASC
      `
    );

    const mapped: TutorialStepRow[] = rows.map((r: any) => ({
      id_step: r.id_step,
      id_tutorial: r.id_tutorial,
      ordem: r.ordem,
      texto: r.texto,
      id_tipo_vitim: r.id_tipo_vitim ?? null,
      midia: r.midia ?? null,
      midia_obj: r.m_id_midia
        ? {
            id_midia: r.m_id_midia,
            url: r.m_url,
            descricao: r.m_descricao ?? null,
            created_at: r.m_created_at ?? null,
            local_path: r.m_local_path ?? null,
          }
        : null,
    }));

    return handleSupabase<TutorialStepRow[]>(mapped, null);
  } catch (errJoin: any) {
    // fallback sem local_path
    try {
      const rows = await executeSelect<any>(
        `
        SELECT
          ts.id_step,
          ts.id_tutorial,
          ts.ordem,
          ts.texto,
          ts.id_tipo_vitim,
          ts.midia,

          m.id_midia   AS m_id_midia,
          m.url        AS m_url,
          m.descricao  AS m_descricao,
          m.created_at AS m_created_at
        FROM tutorial_steps ts
        LEFT JOIN midia m
          ON m.id_midia = ts.midia
        ORDER BY ts.id_tutorial ASC, ts.ordem ASC, ts.id_step ASC
        `
      );

      const mapped: TutorialStepRow[] = rows.map((r: any) => ({
        id_step: r.id_step,
        id_tutorial: r.id_tutorial,
        ordem: r.ordem,
        texto: r.texto,
        id_tipo_vitim: r.id_tipo_vitim ?? null,
        midia: r.midia ?? null,
        midia_obj: r.m_id_midia
          ? {
              id_midia: r.m_id_midia,
              url: r.m_url,
              descricao: r.m_descricao ?? null,
              created_at: r.m_created_at ?? null,
              local_path: null,
            }
          : null,
      }));

      return handleSupabase<TutorialStepRow[]>(mapped, null);
    } catch (error: any) {
      console.error('[sqlSearch] Erro em getAllTutorialSteps (offline):', errJoin, error);
      return handleSupabase<TutorialStepRow[] | null>(null, error);
    }
  }
}

// --------------------------------------------------------------
// USERS (offline - buscar por email no SQLite)
// --------------------------------------------------------------
export async function getUserByEmail(email: string) {
  try {
    const rows = await executeSelect<User>(
      'SELECT * FROM users WHERE email_user = ? LIMIT 1',
      [email]
    );
    const user = rows[0] ?? null;
    return handleSupabase<User | null>(user, null);
  } catch (error: any) {
    return handleSupabase<User | null>(null, error);
  }
}

// --------------------------------------------------------------
// INF_OCO (offline - por usuário no SQLite)
// --------------------------------------------------------------
export async function getInfOcoByUser(userId: number) {
  try {
    const rows = await executeSelect<InfOco>(
      'SELECT * FROM inf_oco WHERE solicitante = ? ORDER BY id_oco DESC',
      [userId]
    );
    return handleSupabase<InfOco[]>(rows, null);
  } catch (error: any) {
    return handleSupabase<InfOco[] | null>(null, error);
  }
}
