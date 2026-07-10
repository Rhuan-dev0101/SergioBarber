-- =======================================================
-- SQL SCRIPT FOR SUPABASE SQL EDITOR
-- OSANCHEZ BARBEARIA - BARBERS RLS & STORAGE SETUP
-- =======================================================

-- 1. Enable RLS on the barbers table (just in case)
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing update policies on public.barbers if any, to avoid conflicts
DROP POLICY IF EXISTS "Allow barbers to update their own profile row" ON public.barbers;
DROP POLICY IF EXISTS "Allow admins full access to barbers" ON public.barbers;
DROP POLICY IF EXISTS "Allow public read access to barbers" ON public.barbers;

-- 3. Create public read policy (anyone can view barbers)
CREATE POLICY "Allow public read access to barbers" 
ON public.barbers 
FOR SELECT 
TO public 
USING (true);

-- 4. Create update policy for the barber themselves (id = auth.uid())
CREATE POLICY "Allow barbers to update their own profile row" 
ON public.barbers 
FOR UPDATE 
TO authenticated 
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 5. Create full access policy for admins
CREATE POLICY "Allow admins full access to barbers" 
ON public.barbers 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- =======================================================
-- STORAGE BUCKET POLICIES (Run if storage policies need setup)
-- Make sure to create a public bucket named 'barber-photos' first!
-- =======================================================

-- Allow public read access to objects in barber-photos
CREATE POLICY "Allow public read access to barber photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'barber-photos');

-- Allow authenticated barbers/admins to upload files to 'barber-photos'
CREATE POLICY "Allow authenticated upload/manage access to barber photos"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'barber-photos')
WITH CHECK (bucket_id = 'barber-photos');
