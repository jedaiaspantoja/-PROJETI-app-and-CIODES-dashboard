-- Indices complementares para chaves estrangeiras do schema v2.

CREATE INDEX IF NOT EXISTS idx_tutoriais_tipo_ocorrencia
  ON tutoriais (tipo_ocorrencia_id);

CREATE INDEX IF NOT EXISTS idx_tutorial_passos_tipo_vitima
  ON tutorial_passos (tipo_vitima_id);

CREATE INDEX IF NOT EXISTS idx_guarnicao_membros_usuario
  ON guarnicao_membros (usuario_id);

CREATE INDEX IF NOT EXISTS idx_ocorrencias_tipo_ocorrencia
  ON ocorrencias (tipo_ocorrencia_id);

CREATE INDEX IF NOT EXISTS idx_ocorrencias_tipo_vitima
  ON ocorrencias (tipo_vitima_id);

CREATE INDEX IF NOT EXISTS idx_status_historico_ocorrencia
  ON ocorrencia_status_historico (ocorrencia_id);

CREATE INDEX IF NOT EXISTS idx_status_historico_alterado_por
  ON ocorrencia_status_historico (alterado_por);

CREATE INDEX IF NOT EXISTS idx_empenhos_empenhado_por
  ON ocorrencia_empenhos (empenhado_por);

CREATE INDEX IF NOT EXISTS idx_relatos_socorrista
  ON relatos_socorrista (socorrista_id);

CREATE INDEX IF NOT EXISTS idx_midias_ocorrencia
  ON midias (ocorrencia_id);

CREATE INDEX IF NOT EXISTS idx_midias_enviado_por
  ON midias (enviado_por);

CREATE INDEX IF NOT EXISTS idx_ocorrencia_dispositivos_dispositivo
  ON ocorrencia_dispositivos (dispositivo_id);

CREATE INDEX IF NOT EXISTS idx_ocorrencia_dispositivos_vinculado_por
  ON ocorrencia_dispositivos (vinculado_por);

CREATE INDEX IF NOT EXISTS idx_leituras_dispositivo
  ON leituras_sinais_vitais (dispositivo_id);

CREATE INDEX IF NOT EXISTS idx_alertas_ocorrencia
  ON alertas_sinais_vitais (ocorrencia_id);

CREATE INDEX IF NOT EXISTS idx_alertas_leitura
  ON alertas_sinais_vitais (leitura_id);

CREATE INDEX IF NOT EXISTS idx_formularios_gerado_por
  ON formularios_ocorrencia (gerado_por);

