import { create } from 'zustand';
import type { Usuario } from './types';

interface AppState {
  usuario: Usuario | null;
  setUsuario: (u: Usuario | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  usuario: null,
  setUsuario: (u) => set({ usuario: u }),
}));
