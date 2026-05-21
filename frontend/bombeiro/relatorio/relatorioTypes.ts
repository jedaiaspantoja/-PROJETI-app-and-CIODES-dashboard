export type Section = 'triagem' | 'vitima' | 'vitais' | 'avaliacao' | 'conduta' | 'preview';

export type FormularioStatus = 'rascunho' | 'gerado';

export type RelatorioData = {
  triagem: string;
  nomeVitima: string;
  idadeVitima: string;
  sexoVitima: string;
  documentoVitima: string;
  contatoEmergencia: string;
  queixaPrincipal: string;
  alergias: string;
  medicamentos: string;
  historicoClinico: string;
  pa: string;
  fc: string;
  fr: string;
  spo2: string;
  temperatura: string;
  glicemia: string;
  dor: string;
  consciencia: string;
  horarioSinais: string;
  sintomas: string[];
  abcde: string[];
  condutas: string[];
  conduta: string;
  destino: string;
};

export type TriageInfo = {
  id: string;
  label: string;
  color: string;
  description: string;
  tempo: string;
};

export type RelatorioContext = {
  formData: RelatorioData;
  ocorrencia: any;
  socorrista: any;
  relatos: any[];
  triageInfo: TriageInfo;
  addressText: string;
  gps: string;
  profissional: string;
};
