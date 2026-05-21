import { Section, TriageInfo } from './relatorioTypes';

export const colors = {
  background: '#0F172A',
  text: '#F9FAFB',
  card: '#111827',
  border: '#1F2937',
  placeholder: '#9CA3AF',
  primary: '#2563EB',
  danger: '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',
};

export const manchesterProtocols: TriageInfo[] = [
  { id: 'red', label: 'Emergencia', color: '#DC2626', description: 'Risco imediato a vida', tempo: 'Atendimento imediato' },
  { id: 'orange', label: 'Muito urgente', color: '#EA580C', description: 'Pode evoluir para risco', tempo: 'Atendimento em ate 10 min' },
  { id: 'yellow', label: 'Urgente', color: '#F59E0B', description: 'Condicao aguda, mas estavel', tempo: 'Atendimento em ate 30 min' },
  { id: 'green', label: 'Pouco urgente', color: '#10B981', description: 'Sintomas leves ou cronicos', tempo: 'Atendimento em ate 120 min' },
];

export const symptomOptions = [
  'Dor de cabeca',
  'Desmaio',
  'Sangramento',
  'Fratura exposta',
  'Queimadura',
  'Falta de ar',
  'Dor toracica',
  'Alergia',
  'Convulsao',
  'Trauma multiplo',
];

export const abcdeOptions = {
  airway: ['Via aerea pervia', 'Obstrucao', 'Corpo estranho', 'Vomito/secrecao'],
  breathing: ['Respiracao espontanea', 'Dispneia', 'Cianose', 'Ruidos respiratorios'],
  circulation: ['Pulso presente', 'Hemorragia ativa', 'Pele fria/palida', 'Perfusao reduzida'],
  disability: ['Alerta', 'Resposta verbal', 'Resposta a dor', 'Inconsciente'],
  exposure: ['Lesoes aparentes', 'Queimadura', 'Deformidade', 'Hipotermia/hipertermia'],
};

export const conductOptions = [
  'Controle de sangramento',
  'Curativo',
  'Imobilizacao',
  'Oxigenio',
  'RCP',
  'DEA utilizado',
  'Monitorizacao',
  'Transporte/remocao',
  'Acionamento de apoio',
  'Orientacao ao solicitante',
];

export const sections: Section[] = ['triagem', 'vitima', 'vitais', 'avaliacao', 'conduta', 'preview'];
