-- =======================================================
-- OSANCHEZ BARBEARIA - HARDENING DAS POLICIES DE STORAGE
-- Rodar no Supabase SQL Editor (uma vez). Idempotente.
-- =======================================================
--
-- PROBLEMA CORRIGIDO
--   As policies de storage.objects para os buckets 'barber-photos' e
--   'gallery-photos' (criadas em supabase_update.sql e supabase_gallery.sql)
--   liberam INSERT/UPDATE/DELETE para QUALQUER usuario autenticado, sem
--   checar o role. Na pratica, um cliente logado (papel mais comum e mais
--   facil de obter no sistema, via login social) consegue apagar ou
--   substituir a foto de um barbeiro ou qualquer imagem da galeria.
--
-- ESCOPO
--   Este script mexe SOMENTE em 'barber-photos' e 'gallery-photos', porque
--   sao os dois buckets cujas policies estao versionadas neste repositorio
--   e cujo uso no codigo foi conferido:
--     - barber-photos: escrito em /painel/perfil-barbeiro, gate de role
--       'admin' OU 'barber' (cada barbeiro edita a propria foto).
--     - gallery-photos: escrito em /painel/galeria, gate de role 'admin'
--       apenas (confirmado em painel/galeria/page.tsx e actions.ts).
--   O bucket 'review-photos' (usado em ReviewModal.tsx) NAO e mexido aqui:
--   suas policies de storage nao estao em nenhum .sql deste repositorio,
--   entao alterar sem visibilidade de como foram configuradas arrisca
--   quebrar o envio de fotos em avaliacoes.
-- =======================================================

BEGIN;

-- -------------------------------------------------------
-- 1. barber-photos: admin OU barber, nao qualquer authenticated
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated upload/manage access to barber photos" ON storage.objects;

CREATE POLICY "Allow staff to manage barber photos"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'barber-photos'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'barber')
  )
)
WITH CHECK (
  bucket_id = 'barber-photos'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'barber')
  )
);

-- Leitura publica de barber-photos permanece como esta (nao mexida):
--   "Allow public read access to barber photos" (supabase_update.sql)

-- -------------------------------------------------------
-- 2. gallery-photos: admin apenas
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Allow admins to manage gallery photos" ON storage.objects;

CREATE POLICY "Allow admins to manage gallery photos"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'gallery-photos'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'gallery-photos'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'admin'
  )
);

-- Leitura publica de gallery-photos permanece como esta (nao mexida):
--   "Allow public read access to gallery photos" (supabase_gallery.sql)

COMMIT;

-- =======================================================
-- VERIFICACAO (rode depois do COMMIT, como cliente comum ou anonimo)
-- =======================================================
-- Um usuario autenticado SEM role admin/barber tentando escrever deve
-- receber "new row violates row-level security policy":
--
--   INSERT INTO storage.objects (bucket_id, name) VALUES ('barber-photos', 'teste.jpg');
--   INSERT INTO storage.objects (bucket_id, name) VALUES ('gallery-photos', 'teste.jpg');
--
-- Policies ativas nos dois buckets:
--   SELECT policyname, roles, cmd
--   FROM pg_policies
--   WHERE schemaname = 'storage' AND tablename = 'objects'
--     AND policyname IN ('Allow staff to manage barber photos', 'Allow admins to manage gallery photos');
-- =======================================================
