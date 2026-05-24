-- Adiciona dados reais da vitima e endereco textual na ocorrencia.
-- Necessario para o relatorio de APH nao depender apenas do tipo da vitima e do GPS.

ALTER TABLE public.ocorrencias
  ADD COLUMN IF NOT EXISTS vitima_nome TEXT,
  ADD COLUMN IF NOT EXISTS vitima_idade_anos INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ocorrencias_vitima_idade_anos_check'
  ) THEN
    ALTER TABLE public.ocorrencias
      ADD CONSTRAINT ocorrencias_vitima_idade_anos_check
      CHECK (vitima_idade_anos IS NULL OR (vitima_idade_anos >= 0 AND vitima_idade_anos <= 130));
  END IF;
END $$;
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS data_nascimento DATE;

ALTER TABLE public.ocorrencias
  ADD COLUMN IF NOT EXISTS vitima_data_nascimento DATE;
DROP FUNCTION IF EXISTS public.lookup_usuario_login(TEXT);

CREATE OR REPLACE FUNCTION public.lookup_usuario_login(documento_input TEXT)
RETURNS TABLE (
  id UUID,
  auth_user_id UUID,
  nome TEXT,
  email TEXT,
  cpf_matricula TEXT,
  telefone TEXT,
  data_nascimento DATE,
  papel TEXT,
  ativo BOOLEAN
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    u.auth_user_id,
    u.nome,
    u.email,
    u.cpf_matricula,
    u.telefone,
    u.data_nascimento,
    u.papel,
    u.ativo
  FROM public.usuarios u
  WHERE u.cpf_matricula = regexp_replace(coalesce(documento_input, ''), '\D', '', 'g')
    AND u.ativo = TRUE
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_usuario_login(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_usuario_login(TEXT) TO anon, authenticated;
