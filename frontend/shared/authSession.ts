// frontend/shared/authSession.ts

export type SessionUser = {
  id: string;
  nome: string | null;
  email: string | null;
  cpf_matricula?: string | null;
  telefone?: string | null;
  data_nascimento?: string | null;
  papel: 'solicitante' | 'socorrista' | 'ciodes' | 'admin';
  ativo?: boolean;
};

let currentUser: SessionUser | null = null;

export function setCurrentUser(user: SessionUser | null) {
  currentUser = user;
}

export function getCurrentUser(): SessionUser | null {
  return currentUser;
}
