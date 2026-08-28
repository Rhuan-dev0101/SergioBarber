-- =======================================================
-- OSANCHEZ BARBEARIA - HARDENING DE LEITURA DA TABELA profiles
-- Rodar no Supabase SQL Editor (uma vez). Idempotente.
-- =======================================================
--
-- PROBLEMA CORRIGIDO
--   A policy "Allow public read access to profiles" (criada em
--   supabase_update.sql, secao 6) permitia SELECT para o role `public`.
--   Na pratica, qualquer pessoa com a chave publishable conseguia ler
--   full_name + email + role da equipe:
--
--     curl "$URL/rest/v1/profiles?select=*" -H "apikey: <publishable>"
--     -> 200 [{"email":"osanchezbarbearia@gmail.com",...},
--             {"email":"enzofunchal2511@gmail.com",...}]
--
-- ESTRATEGIA
--   RLS sozinho e' row-level: nao consegue dizer "mostre a linha do
--   barbeiro, mas esconda o email dela". As paginas publicas (/, /barbeiros,
--   /servicos) precisam do nome do barbeiro, e a tabela `barbers` NAO tem
--   coluna de nome - o nome so existe em profiles.full_name.
--
--   Por isso combinamos duas camadas:
--     (1) RLS  -> QUAIS LINHAS cada um enxerga;
--     (2) GRANT de coluna -> QUAIS COLUNAS o role `anon` pode ler.
--
--   O GRANT de coluna e' o controle decisivo: mesmo que alguma policy
--   permissiva sobre e sobreviva, `anon` deixa de ter privilegio sobre a
--   coluna email/phone e o PostgREST responde 42501 (permission denied).
--
-- O QUE ESTE SCRIPT **NAO** MEXE (ja validado como correto em producao):
--   - o trigger que impede o usuario de alterar a propria `role`
--     (testado: PATCH role=admin -> P0001 "Apenas administradores podem
--     alterar a role de um usuario.");
--   - as policies de INSERT/UPDATE/DELETE de profiles (UPDATE de terceiros
--     ja retorna 0 linhas afetadas);
--   - o trigger de criacao de profile no signup (handle_new_user), que ja
--     ignora a `role` vinda do metadata do cliente e grava 'customer'.
--   Somente policies de SELECT sao recriadas.
-- =======================================================

BEGIN;

-- -------------------------------------------------------
-- 1. Helper SECURITY DEFINER para evitar recursao infinita
-- -------------------------------------------------------
-- Uma policy sobre `profiles` que faz "SELECT ... FROM profiles" dentro do
-- USING entra em recursao infinita (erro 42P17). SECURITY DEFINER executa
-- como o dono da funcao (postgres), que ignora RLS, quebrando o ciclo.
-- search_path fixo evita sequestro de resolucao de nomes.
CREATE OR REPLACE FUNCTION public.is_staff_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'barber')
  );
$$;

REVOKE ALL ON FUNCTION public.is_staff_member() FROM public;
GRANT EXECUTE ON FUNCTION public.is_staff_member() TO anon, authenticated;

COMMENT ON FUNCTION public.is_staff_member() IS
  'True se o usuario autenticado for admin ou barber. SECURITY DEFINER para uso dentro de policies de profiles sem recursao.';

-- -------------------------------------------------------
-- 2. Remover TODAS as policies de SELECT existentes em profiles
-- -------------------------------------------------------
-- Os nomes historicos variam entre os scripts ja aplicados, entao
-- removemos por introspecao. Policies de INSERT/UPDATE/DELETE e policies
-- cmd='ALL' (acesso total de admin) sao preservadas de proposito.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND cmd        = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.profiles', pol.policyname);
    RAISE NOTICE 'Policy de SELECT removida: %', pol.policyname;
  END LOOP;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------
-- 3. Policies de SELECT (camada 1: quais linhas)
-- -------------------------------------------------------

-- 3a. Visitante anonimo: SOMENTE as linhas da equipe (admin/barber).
--     Nenhuma linha de cliente jamais aparece para quem nao esta logado.
--     As colunas visiveis sao restringidas no passo 4 (id/full_name/role).
CREATE POLICY "profiles_select_public_staff"
ON public.profiles
FOR SELECT
TO anon
USING (role IN ('admin', 'barber'));

-- 3b. Usuario autenticado: a propria linha, as linhas da equipe (o nome do
--     barbeiro e' necessario no fluxo de agendamento) e, para admin/barber,
--     todas as linhas (painel de clientes, financeiro, lembretes).
CREATE POLICY "profiles_select_own_or_staff"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = (SELECT auth.uid())
  OR role IN ('admin', 'barber')
  OR public.is_staff_member()
);

-- -------------------------------------------------------
-- 4. GRANTs de coluna (camada 2: quais colunas) -- O CONTROLE PRINCIPAL
-- -------------------------------------------------------
-- Por padrao o Supabase concede SELECT em TODAS as colunas para anon.
-- Revogamos e devolvemos apenas o minimo que as paginas publicas usam.
-- Conferido em todo o código: as consultas anonimas pedem exatamente
-- `id, full_name` e o embed `profiles(full_name, role)` -- nunca email/phone.
REVOKE ALL ON TABLE public.profiles FROM anon;
GRANT SELECT (id, full_name, role) ON TABLE public.profiles TO anon;

-- `authenticated` permanece com os grants originais (todas as colunas):
-- a propria pagina /cliente/perfil faz `select('*')` na propria linha e o
-- painel /painel/funcionarios precisa de profiles.email. Quem limita o
-- alcance aqui e' a policy 3b + o trigger de protecao de role.

COMMIT;

-- =======================================================
-- VERIFICACAO (rode depois do COMMIT)
-- =======================================================
-- Policies de SELECT ativas:
--   SELECT policyname, roles, cmd, qual
--   FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'SELECT';
--
-- Privilegios de coluna do role anon (deve listar SOMENTE id/full_name/role):
--   SELECT column_name, privilege_type
--   FROM information_schema.column_privileges
--   WHERE table_name = 'profiles' AND grantee = 'anon'
--   ORDER BY column_name;
-- =======================================================
