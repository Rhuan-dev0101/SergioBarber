-- =======================================================
-- SQL SCRIPT FOR SUPABASE SQL EDITOR
-- OSANCHEZ BARBEARIA - GALLERY COLUMNS, RLS & STORAGE SETUP
-- =======================================================

-- 1. Add title and category columns to gallery_images if they don't exist
ALTER TABLE public.gallery_images ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.gallery_images ADD COLUMN IF NOT EXISTS category text;

-- 2. Enable RLS on gallery_images table
ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow public read access to gallery" ON public.gallery_images;
DROP POLICY IF EXISTS "Allow admins full access to gallery" ON public.gallery_images;

-- 4. Create public SELECT policy
CREATE POLICY "Allow public read access to gallery"
ON public.gallery_images
FOR SELECT
TO public
USING (true);

-- 5. Create full control policy for admin roles
CREATE POLICY "Allow admins full access to gallery"
ON public.gallery_images
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
-- STORAGE BUCKET POLICIES & SIZE LIMIT FOR 'gallery-photos'
-- Make sure bucket 'gallery-photos' is configured with 20MB limit (20971520 bytes)
-- =======================================================

-- Create or update 'gallery-photos' bucket with 20MB max file size
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gallery-photos', 
  'gallery-photos', 
  true, 
  20971520, -- 20MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE 
SET file_size_limit = 20971520;

-- Allow public read access to objects in gallery-photos
CREATE POLICY "Allow public read access to gallery photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'gallery-photos');

-- Allow authenticated admins to upload/manage files in 'gallery-photos'
CREATE POLICY "Allow admins to manage gallery photos"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'gallery-photos')
WITH CHECK (bucket_id = 'gallery-photos');
