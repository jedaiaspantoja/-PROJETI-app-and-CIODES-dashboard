import * as Location from 'expo-location';
import { manchesterProtocols } from './relatorioConstants';
import { FormularioStatus, RelatorioData } from './relatorioTypes';

export function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function getTriageInfo(triagem: string) {
  return manchesterProtocols.find((item) => item.id === triagem) || manchesterProtocols[2];
}

export function formatReverseAddress(address: Location.LocationGeocodedAddress) {
  const streetLine = [address.street, address.streetNumber].filter(Boolean).join(', ');
  const cityLine = [address.district, address.city || address.subregion, address.region].filter(Boolean).join(' - ');
  return [streetLine, cityLine, address.postalCode].filter(Boolean).join(', ');
}

export function createInitialRelatorioData(ocorrencia: any): RelatorioData {
  return {
    triagem: '',
    nomeVitima: ocorrencia?.tipo_vitima?.nome || '',
    idadeVitima: '',
    sexoVitima: '',
    documentoVitima: '',
    contatoEmergencia: ocorrencia?.solicitante?.telefone || '',
    queixaPrincipal: ocorrencia?.descricao || '',
    alergias: '',
    medicamentos: '',
    historicoClinico: '',
    pa: '',
    fc: '',
    fr: '',
    spo2: '',
    temperatura: '',
    glicemia: '',
    dor: '',
    consciencia: '',
    horarioSinais: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    sintomas: [],
    abcde: [],
    condutas: [],
    conduta: '',
    destino: '',
  };
}

export function validateReport(formData: RelatorioData, ocorrencia: any) {
  if (!formData.triagem) return 'Selecione a classificacao de triagem.';
  if (!formData.conduta.trim() && formData.condutas.length === 0) return 'Registre pelo menos uma conduta adotada.';
  if (!formData.nomeVitima.trim() && !ocorrencia?.tipo_vitima?.nome) return 'Informe pelo menos a identificacao ou tipo da vitima.';
  return null;
}

export function buildReportPayload(params: {
  status: FormularioStatus;
  formData: RelatorioData;
  ocorrencia: any;
  relatos: any[];
  resolvedAddress: string | null;
}) {
  const { status, formData, ocorrencia, relatos, resolvedAddress } = params;
  return {
    version: 1,
    status,
    formData,
    ocorrenciaSnapshot: {
      id: ocorrencia?.id || null,
      protocolo: ocorrencia?.protocolo || null,
      status: ocorrencia?.status || null,
      criada_em: ocorrencia?.criada_em || null,
      endereco_texto: ocorrencia?.endereco_texto || resolvedAddress || null,
      latitude: ocorrencia?.latitude || null,
      longitude: ocorrencia?.longitude || null,
      descricao: ocorrencia?.descricao || null,
      solicitante: ocorrencia?.solicitante || null,
      tipo_ocorrencia: ocorrencia?.tipo_ocorrencia || null,
      tipo_vitima: ocorrencia?.tipo_vitima || null,
    },
    relatosSnapshot: relatos,
    salvo_em: new Date().toISOString(),
  };
}

export function getAddressText(ocorrencia: any, resolvedAddress: string | null, resolvingAddress: boolean) {
  return ocorrencia?.endereco_texto || resolvedAddress || (resolvingAddress ? 'Convertendo coordenadas em endereco...' : 'Nao informado');
}

export function getGpsText(ocorrencia: any) {
  return ocorrencia?.latitude && ocorrencia?.longitude ? `${ocorrencia.latitude}, ${ocorrencia.longitude}` : 'Nao registrado';
}

export function getProfissionalName(socorrista: any) {
  return socorrista?.nome || socorrista?.email || 'Profissional nao identificado';
}
