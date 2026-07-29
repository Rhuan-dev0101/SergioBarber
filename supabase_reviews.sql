-- =======================================================
-- SQL SCRIPT FOR SUPABASE SQL EDITOR
-- OSANCHEZ BARBEARIA - REVIEWS & RATINGS SYSTEM
-- =======================================================

-- 1. Create reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reviews_status ON public.reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_barber_status ON public.reviews(barber_id, status);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to avoid conflicts when re-running
DROP POLICY IF EXISTS "Allow public read access to approved reviews" ON public.reviews;
DROP POLICY IF EXISTS "Allow customers to view their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Allow customers to insert their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Allow admins full access to reviews" ON public.reviews;

-- Policy A: Public read access for approved reviews ONLY
CREATE POLICY "Allow public read access to approved reviews"
ON public.reviews
FOR SELECT
TO public
USING (status = 'approved');

-- Policy B: Customers can view their own reviews (pending/approved/rejected)
CREATE POLICY "Allow customers to view their own reviews"
ON public.reviews
FOR SELECT
TO authenticated
USING (customer_id = auth.uid());

-- Policy C: Customers can insert their own reviews
CREATE POLICY "Allow customers to insert their own reviews"
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (
  customer_id = auth.uid()
);

-- Policy D: Admins have FULL access (SELECT, INSERT, UPDATE, DELETE)
-- Checking explicitly that profiles.role = 'admin' inside USING and WITH CHECK
CREATE POLICY "Allow admins full access to reviews"
ON public.reviews
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
