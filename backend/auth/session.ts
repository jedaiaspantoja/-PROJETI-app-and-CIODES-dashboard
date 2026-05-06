// backend/auth/session.ts
import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'projeti_user_session_v1';

export type UserSession = {
  userId: number;
  email: string;
  expiresAt: number; // timestamp em ms
};

// salva a sessão por 7 dias a partir de agora
export async function createSession(userId: number, email: string) {
  const now = Date.now();
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

  const session: UserSession = {
    userId,
    email,
    expiresAt: now + oneWeekMs,
  };

  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function getSession(): Promise<UserSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;

    const parsed: UserSession = JSON.parse(raw);
    if (!parsed.expiresAt || Date.now() > parsed.expiresAt) {
      // expirou
      await SecureStore.deleteItemAsync(SESSION_KEY);
      return null;
    }

    return parsed;
  } catch (e) {
    console.log('[session] erro ao ler sessão', e);
    return null;
  }
}

export async function clearSession() {
  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch (e) {
    console.log('[session] erro ao limpar sessão', e);
  }
}
