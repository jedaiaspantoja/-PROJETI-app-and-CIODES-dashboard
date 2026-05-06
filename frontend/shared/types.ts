export interface Caso {
  id: string;
  titulo: string;
  descricao?: string | null;
  atualizado_em: number;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  token?: string;
}
