import axios from 'axios';
import { ENV } from './config';
import type { Caso } from './types';

const api = axios.create({
  baseURL: ENV.API_URL,
  timeout: 5000,
});

export async function fetchCasos(since?: number): Promise<Caso[]> {
  const { data } = await api.get('/sync/casos', {
    params: since ? { since } : undefined,
  });
  return data.updates ?? [];
}
