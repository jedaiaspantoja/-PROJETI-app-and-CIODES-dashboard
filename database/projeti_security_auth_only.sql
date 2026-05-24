-- PROJETI - limpeza e protecao de credenciais
-- Rode no SQL Editor do Supabase quando quiser remover usuarios de teste
-- e impedir que senha/hash continue existindo em public.usuarios.
--
-- IMPORTANTE:
-- 1. Isso apaga usuarios do app e tambem contas correspondentes em auth.users.
-- 2. Tambem apaga ocorrencias e dados operacionais ligados a esses usuarios,
--    porque as FKs bloqueiam a remocao direta.
-- 3. Faca backup se houver dados reais.

BEGIN;

DELETE FROM public.formularios_ocorrencia;
DELETE FROM public.alertas_sinais_vitais;
DELETE FROM public.leituras_sinais_vitais;
DELETE FROM public.ocorrencia_dispositivos;
DELETE FROM public.midias;
DELETE FROM public.relatos_socorrista;
DELETE FROM public.ocorrencia_empenhos;
DELETE FROM public.ocorrencia_status_historico;
DELETE FROM public.ocorrencias;
DELETE FROM public.guarnicao_membros;

DELETE FROM auth.users
WHERE id IN (
  SELECT auth_user_id
  FROM public.usuarios
  WHERE auth_user_id IS NOT NULL
);

DELETE FROM public.usuarios;

-- Remove qualquer coluna legada que possa armazenar senha/hash fora do Supabase Auth.
ALTER TABLE public.usuarios DROP COLUMN IF EXISTS senha;
ALTER TABLE public.usuarios DROP COLUMN IF EXISTS senha_hash;

-- Lookup minimo para login por CPF/matricula sem expor SELECT direto na tabela.
CREATE OR REPLACE FUNCTION public.lookup_usuario_login(documento_input TEXT)
RETURNS TABLE (
  id UUID,
  auth_user_id UUID,
  nome TEXT,
  email TEXT,
  cpf_matricula TEXT,
  telefone TEXT,
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
    u.papel,
    u.ativo
  FROM public.usuarios u
  WHERE u.cpf_matricula = regexp_replace(coalesce(documento_input, ''), '\D', '', 'g')
    AND u.ativo = TRUE
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_usuario_login(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_usuario_login(TEXT) TO anon, authenticated;

-- RLS basico: o app usa a RPC acima antes do login e SELECT direto so apos autenticar.
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios_select_own_profile" ON public.usuarios;
CREATE POLICY "usuarios_select_own_profile"
ON public.usuarios
FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "usuarios_update_own_basic_profile" ON public.usuarios;
CREATE POLICY "usuarios_update_own_basic_profile"
ON public.usuarios
FOR UPDATE
TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "usuarios_insert_own_profile" ON public.usuarios;
CREATE POLICY "usuarios_insert_own_profile"
ON public.usuarios
FOR INSERT
TO authenticated
WITH CHECK (auth_user_id = auth.uid());

COMMIT;