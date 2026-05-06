-- Seed de desenvolvimento para testar app solicitante e app socorrista.
-- Senhas em texto puro apenas enquanto a autenticacao definitiva nao entra.

WITH solicitante AS (
  INSERT INTO usuarios (nome, email, cpf_matricula, telefone, senha_hash, papel)
  VALUES ('Solicitante Demo', 'solicitante@projeti.local', '52998224725', '85999990000', '123456', 'solicitante')
  ON CONFLICT (cpf_matricula) DO UPDATE
    SET nome = EXCLUDED.nome,
        email = EXCLUDED.email,
        telefone = EXCLUDED.telefone,
        senha_hash = EXCLUDED.senha_hash,
        papel = EXCLUDED.papel,
        ativo = TRUE
  RETURNING id
),
socorrista AS (
  INSERT INTO usuarios (nome, email, cpf_matricula, telefone, senha_hash, papel)
  VALUES ('Socorrista Demo', 'socorrista@projeti.local', '123456', '85999991111', '123456', 'socorrista')
  ON CONFLICT (cpf_matricula) DO UPDATE
    SET nome = EXCLUDED.nome,
        email = EXCLUDED.email,
        telefone = EXCLUDED.telefone,
        senha_hash = EXCLUDED.senha_hash,
        papel = EXCLUDED.papel,
        ativo = TRUE
  RETURNING id
),
guarnicao AS (
  INSERT INTO guarnicoes (nome, tipo_viatura, prefixo, descricao)
  VALUES ('Guarnição Demo', 'UR', 'UR-001', 'Guarnição de teste para desenvolvimento')
  ON CONFLICT (prefixo) DO UPDATE
    SET nome = EXCLUDED.nome,
        tipo_viatura = EXCLUDED.tipo_viatura,
        descricao = EXCLUDED.descricao,
        ativo = TRUE
  RETURNING id
),
membro AS (
  INSERT INTO guarnicao_membros (guarnicao_id, usuario_id, funcao)
  SELECT guarnicao.id, socorrista.id, 'Socorrista'
  FROM guarnicao, socorrista
  ON CONFLICT (guarnicao_id, usuario_id) DO UPDATE
    SET funcao = EXCLUDED.funcao,
        ativo = TRUE
  RETURNING id
),
ocorrencia AS (
  INSERT INTO ocorrencias (
    solicitante_id,
    tipo_ocorrencia_id,
    tipo_vitima_id,
    latitude,
    longitude,
    descricao,
    status
  )
  SELECT
    solicitante.id,
    (SELECT id FROM tipos_ocorrencia WHERE codigo = 'engasgo'),
    (SELECT id FROM tipos_vitima WHERE codigo = 'adulto'),
    -3.7319,
    -38.5267,
    'Ocorrência demo para teste do app do socorrista.',
    'guarnicao_empenhada'
  FROM solicitante
  WHERE NOT EXISTS (
    SELECT 1 FROM ocorrencias WHERE descricao = 'Ocorrência demo para teste do app do socorrista.'
  )
  RETURNING id
),
ocorrencia_existente AS (
  SELECT id FROM ocorrencia
  UNION ALL
  SELECT id FROM ocorrencias
  WHERE descricao = 'Ocorrência demo para teste do app do socorrista.'
  LIMIT 1
)
INSERT INTO ocorrencia_empenhos (ocorrencia_id, guarnicao_id, status)
SELECT ocorrencia_existente.id, guarnicao.id, 'empenhada'
FROM ocorrencia_existente, guarnicao
ON CONFLICT (ocorrencia_id, guarnicao_id) DO UPDATE
  SET status = EXCLUDED.status;

