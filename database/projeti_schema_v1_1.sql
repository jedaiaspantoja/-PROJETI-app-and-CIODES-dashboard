-- Modelo Entidade-Relacionamento — Projeti
-- Schema v1.1 · Sistema de Ocorrencias com suporte offline · PostgreSQL
--
-- Este arquivo representa o novo banco oficial extraido de:
-- C:\Users\Usuário\Downloads\erd_projeti.pdf

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  papel TEXT NOT NULL CHECK (papel IN ('operador', 'supervisor', 'admin')),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tipos_ocorrencia (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  icone TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ocorrencias (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  tipo_id INTEGER NOT NULL REFERENCES tipos_ocorrencia(id),
  latitude REAL CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  longitude REAL CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'registrado'
    CHECK (status IN ('registrado', 'em_andamento', 'resolvido')),
  resolvido_por INTEGER REFERENCES usuarios(id),
  resolvido_em TIMESTAMP,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS midia (
  id SERIAL PRIMARY KEY,
  ocorrencia_id INTEGER NOT NULL REFERENCES ocorrencias(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('foto', 'video', 'audio')),
  tamanho_bytes INTEGER,
  mime_type TEXT,
  legenda TEXT,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sincronizacao_offline (
  id SERIAL PRIMARY KEY,
  tabela_nome TEXT NOT NULL,
  registro_id INTEGER NOT NULL,
  operacao TEXT NOT NULL CHECK (operacao IN ('INSERT', 'UPDATE', 'DELETE')),
  payload_json TEXT,
  sincronizado BOOLEAN NOT NULL DEFAULT FALSE,
  tentativa INTEGER NOT NULL DEFAULT 0 CHECK (tentativa >= 0 AND tentativa <= 5),
  proxima_tentativa TIMESTAMP,
  erro TEXT,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ocorrencias_status_criado
  ON ocorrencias (status, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_sync_pendentes
  ON sincronizacao_offline (criado_em ASC)
  WHERE sincronizado = FALSE AND tentativa < 5;

CREATE INDEX IF NOT EXISTS idx_midia_ocorrencia
  ON midia (ocorrencia_id);

