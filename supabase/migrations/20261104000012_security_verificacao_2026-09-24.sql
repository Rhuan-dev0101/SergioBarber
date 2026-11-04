-- =======================================================
-- OSANCHEZ BARBEARIA - VERIFICACAO (SOMENTE LEITURA)
-- Confere se as 3 migrations propostas pelo agente de seguranca ja
-- foram aplicadas em producao. Nao faz nenhum INSERT/UPDATE/DELETE/
-- ALTER/CREATE/DROP -- seguro para rodar a qualquer momento.
--
-- Migrations verificadas:
--   supabase_security_profiles_rls.sql
--   supabase_security_storage_policies.sql
--   supabase_security_no_overlap_appointments.sql
--
-- Rode inteiro no SQL Editor do Supabase e leia a coluna "status" de
-- cada linha do resultado.
-- =======================================================

SELECT
  '1. profiles - policies novas de SELECT aplicadas' AS item,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'profiles'
        AND policyname IN ('profiles_select_public_staff', 'profiles_select_own_or_staff')
    ) THEN 'APLICADA'
    ELSE 'NAO ENCONTRADA'
  END AS status,
  (
    SELECT COALESCE(string_agg(policyname, ', '), '(nenhuma)')
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd = 'SELECT'
  ) AS detalhe_policies_select_atuais

UNION ALL

SELECT
  '2. profiles - policy antiga permissiva (USING true p/ public) ainda existe?',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'profiles'
        AND policyname = 'Allow public read access to profiles'
    ) THEN 'AINDA PRESENTE -- RISCO'
    ELSE 'REMOVIDA/OK'
  END,
  NULL

UNION ALL

SELECT
  '3. profiles - colunas liberadas para o role anon',
  (
    SELECT COALESCE(string_agg(column_name, ', ' ORDER BY column_name), 'NENHUMA')
    FROM information_schema.column_privileges
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND grantee = 'anon' AND privilege_type = 'SELECT'
  ),
  'Esperado apos o fix: id, full_name, role -- NUNCA email/phone'

UNION ALL

SELECT
  '4. storage - barber-photos restrito a admin/barber',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
        AND policyname = 'Allow staff to manage barber photos'
    ) THEN 'APLICADA'
    ELSE 'NAO ENCONTRADA'
  END,
  NULL

UNION ALL

SELECT
  '5. storage - barber-photos policy antiga (qualquer authenticated) ainda existe?',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
        AND policyname = 'Allow authenticated upload/manage access to barber photos'
    ) THEN 'AINDA PRESENTE -- RISCO'
    ELSE 'REMOVIDA/OK'
  END,
  NULL

UNION ALL

SELECT
  '6. storage - gallery-photos restrito a admin (checar coluna de detalhe)',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
        AND policyname = 'Allow admins to manage gallery photos'
        AND qual ILIKE '%profiles%' AND qual ILIKE '%role%'
    ) THEN 'PARECE APLICADA'
    ELSE 'INSPECIONAR MANUALMENTE (ver detalhe)'
  END,
  (
    SELECT qual FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Allow admins to manage gallery photos'
  )

UNION ALL

SELECT
  '7. appointments - constraint anti-overbooking (appointments_no_overlap_per_barber)',
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_no_overlap_per_barber')
    THEN 'APLICADA'
    ELSE 'NAO APLICADA'
  END,
  (
    SELECT pg_get_constraintdef(oid) FROM pg_constraint
    WHERE conname = 'appointments_no_overlap_per_barber'
  )

UNION ALL

SELECT
  '8. extensao btree_gist instalada (pre-requisito do item 7)',
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist')
    THEN 'INSTALADA'
    ELSE 'NAO INSTALADA'
  END,
  NULL

ORDER BY 1;
