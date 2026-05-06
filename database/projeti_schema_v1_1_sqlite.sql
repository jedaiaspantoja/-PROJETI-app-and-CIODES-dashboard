-- Schema offline SQLite equivalente ao Projeti v1.1.
-- Mantem os mesmos nomes logicos do PostgreSQL, adaptando tipos/defaults.

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  papel TEXT NOT NULL CHECK (papel IN ('operador', 'supervisor', 'admin')),
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tipos_ocorrencia (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  icone TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ocorrencias (
  id INTEGER PRIMARY KEY,
  usuario_id INTEGER NOT NULL,
  tipo_id INTEGER NOT NULL,
  latitude REAL CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  longitude REAL CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'registrado'
    CHECK (status IN ('registrado', 'em_andamento', 'resolvido')),
  resolvido_por INTEGER,
  resolvido_em TEXT,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS midia (
  id INTEGER PRIMARY KEY,
  ocorrencia_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('foto', 'video', 'audio')),
  tamanho_bytes INTEGER,
  mime_type TEXT,
  legenda TEXT,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sincronizacao_offline (
  id INTEGER PRIMARY KEY,
  tabela_nome TEXT NOT NULL,
  registro_id INTEGER NOT NULL,
  operacao TEXT NOT NULL CHECK (operacao IN ('INSERT', 'UPDATE', 'DELETE')),
  payload_json TEXT,
  sincronizado INTEGER NOT NULL DEFAULT 0,
  tentativa INTEGER NOT NULL DEFAULT 0 CHECK (tentativa >= 0 AND tentativa <= 5),
  proxima_tentativa TEXT,
  erro TEXT,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ocorrencias_status_criado
  ON ocorrencias (status, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_sync_pendentes
  ON sincronizacao_offline (criado_em ASC)
  WHERE sincronizado = 0 AND tentativa < 5;

CREATE INDEX IF NOT EXISTS idx_midia_ocorrencia
  ON midia (ocorrencia_id);

