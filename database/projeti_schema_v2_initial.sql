-- PROJETI schema v2 inicial
-- Foco: app solicitante + app socorrista, com base para sensores e formulario.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  email TEXT UNIQUE,
  cpf_matricula TEXT UNIQUE,
  telefone TEXT,
  senha_hash TEXT,
  papel TEXT NOT NULL CHECK (papel IN ('solicitante', 'socorrista', 'ciodes', 'admin')),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tipos_vitima (
  id SMALLSERIAL PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS tipos_ocorrencia (
  id SMALLSERIAL PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  icone TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tutoriais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_ocorrencia_id SMALLINT REFERENCES tipos_ocorrencia(id),
  titulo TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tutorial_passos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorial_id UUID NOT NULL REFERENCES tutoriais(id) ON DELETE CASCADE,
  tipo_vitima_id SMALLINT REFERENCES tipos_vitima(id),
  ordem INTEGER NOT NULL,
  texto TEXT NOT NULL,
  midia_url TEXT,
  midia_tipo TEXT CHECK (midia_tipo IN ('lottie', 'imagem', 'video')),
  midia_local_path TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tutorial_id, tipo_vitima_id, ordem)
);

CREATE TABLE IF NOT EXISTS guarnicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo_viatura TEXT,
  prefixo TEXT UNIQUE,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS guarnicao_membros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guarnicao_id UUID NOT NULL REFERENCES guarnicoes(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  funcao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guarnicao_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS ocorrencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo TEXT NOT NULL UNIQUE DEFAULT ('PROJ-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 8))),
  solicitante_id UUID REFERENCES usuarios(id),
  tipo_ocorrencia_id SMALLINT NOT NULL REFERENCES tipos_ocorrencia(id),
  tipo_vitima_id SMALLINT REFERENCES tipos_vitima(id),
  latitude DOUBLE PRECISION CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  longitude DOUBLE PRECISION CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
  precisao_m DOUBLE PRECISION,
  endereco_texto TEXT,
  descricao TEXT,
  origem TEXT NOT NULL DEFAULT 'app_solicitante' CHECK (origem IN ('app_solicitante', 'ciodes', 'treinamento')),
  is_treinamento BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'registrada'
    CHECK (status IN ('registrada', 'recebida_ciodes', 'guarnicao_empenhada', 'em_deslocamento', 'em_atendimento', 'finalizada', 'cancelada')),
  criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalizada_em TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ocorrencia_status_historico (
  id BIGSERIAL PRIMARY KEY,
  ocorrencia_id UUID NOT NULL REFERENCES ocorrencias(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  observacao TEXT,
  alterado_por UUID REFERENCES usuarios(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ocorrencia_empenhos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ocorrencia_id UUID NOT NULL REFERENCES ocorrencias(id) ON DELETE CASCADE,
  guarnicao_id UUID NOT NULL REFERENCES guarnicoes(id),
  empenhado_por UUID REFERENCES usuarios(id),
  status TEXT NOT NULL DEFAULT 'empenhada'
    CHECK (status IN ('empenhada', 'aceita', 'em_deslocamento', 'em_atendimento', 'finalizada', 'cancelada')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ocorrencia_id, guarnicao_id)
);

CREATE TABLE IF NOT EXISTS relatos_socorrista (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ocorrencia_id UUID NOT NULL REFERENCES ocorrencias(id) ON DELETE CASCADE,
  socorrista_id UUID NOT NULL REFERENCES usuarios(id),
  texto TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS midias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ocorrencia_id UUID NOT NULL REFERENCES ocorrencias(id) ON DELETE CASCADE,
  enviado_por UUID REFERENCES usuarios(id),
  url TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('foto', 'video', 'audio', 'documento')),
  tamanho_bytes INTEGER,
  mime_type TEXT,
  legenda TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dispositivos_monitoramento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ocorrencia_dispositivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ocorrencia_id UUID NOT NULL REFERENCES ocorrencias(id) ON DELETE CASCADE,
  dispositivo_id UUID NOT NULL REFERENCES dispositivos_monitoramento(id),
  vinculado_por UUID REFERENCES usuarios(id),
  vinculado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  desvinculado_em TIMESTAMPTZ,
  UNIQUE (ocorrencia_id, dispositivo_id)
);

CREATE TABLE IF NOT EXISTS leituras_sinais_vitais (
  id BIGSERIAL PRIMARY KEY,
  ocorrencia_id UUID NOT NULL REFERENCES ocorrencias(id) ON DELETE CASCADE,
  dispositivo_id UUID REFERENCES dispositivos_monitoramento(id),
  frequencia_cardiaca_bpm INTEGER,
  saturacao_spo2 NUMERIC(5,2),
  temperatura_c NUMERIC(5,2),
  coletado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload_json JSONB
);

CREATE TABLE IF NOT EXISTS alertas_sinais_vitais (
  id BIGSERIAL PRIMARY KEY,
  ocorrencia_id UUID NOT NULL REFERENCES ocorrencias(id) ON DELETE CASCADE,
  leitura_id BIGINT REFERENCES leituras_sinais_vitais(id) ON DELETE SET NULL,
  nivel TEXT NOT NULL CHECK (nivel IN ('baixo', 'medio', 'alto', 'critico')),
  tipo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  instrucao TEXT,
  resolvido BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolvido_em TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS formularios_ocorrencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ocorrencia_id UUID NOT NULL UNIQUE REFERENCES ocorrencias(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'gerado', 'assinado', 'enviado')),
  dados_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  arquivo_url TEXT,
  gerado_por UUID REFERENCES usuarios(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sincronizacao_offline (
  id BIGSERIAL PRIMARY KEY,
  dispositivo_cliente_id TEXT,
  tabela_nome TEXT NOT NULL,
  registro_id TEXT NOT NULL,
  operacao TEXT NOT NULL CHECK (operacao IN ('INSERT', 'UPDATE', 'DELETE')),
  payload_json JSONB,
  sincronizado BOOLEAN NOT NULL DEFAULT FALSE,
  tentativa INTEGER NOT NULL DEFAULT 0 CHECK (tentativa >= 0 AND tentativa <= 5),
  proxima_tentativa TIMESTAMPTZ,
  erro TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ocorrencias_status_criada
  ON ocorrencias (status, criada_em DESC);

CREATE INDEX IF NOT EXISTS idx_ocorrencias_solicitante
  ON ocorrencias (solicitante_id, criada_em DESC);

CREATE INDEX IF NOT EXISTS idx_empenhos_guarnicao_status
  ON ocorrencia_empenhos (guarnicao_id, status, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_relato_ocorrencia
  ON relatos_socorrista (ocorrencia_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_leituras_ocorrencia_tempo
  ON leituras_sinais_vitais (ocorrencia_id, coletado_em DESC);

CREATE INDEX IF NOT EXISTS idx_sync_pendentes
  ON sincronizacao_offline (criado_em ASC)
  WHERE sincronizado = FALSE AND tentativa < 5;

INSERT INTO tipos_vitima (codigo, nome, descricao, ordem)
VALUES
  ('adulto', 'Adulto', 'Maior de 8 anos, estrutura corporal adulta.', 1),
  ('crianca', 'Criança', 'Entre 1 e 8 anos de idade.', 2),
  ('recem_nascido', 'Recém-nascido', 'Até 28 dias de vida.', 3)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO tipos_ocorrencia (codigo, nome, descricao, icone, ordem)
VALUES
  ('engasgo', 'Engasgo', 'Obstrução de vias aéreas por corpo estranho.', 'lungs', 1),
  ('rcp', 'Parada cardiorrespiratória / RCP', 'Atendimento inicial para ausência de respiração ou pulso.', 'heart-pulse', 2),
  ('afogamento', 'Afogamento', 'Atendimento inicial em vítima retirada da água.', 'waves', 3),
  ('convulsao', 'Convulsão', 'Atendimento inicial em crise convulsiva.', 'activity', 4),
  ('trauma', 'Trauma', 'Queda, colisão, corte ou outro mecanismo traumático.', 'bandage', 5)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO tutoriais (tipo_ocorrencia_id, titulo, descricao)
SELECT id, nome, descricao
FROM tipos_ocorrencia
ON CONFLICT DO NOTHING;
