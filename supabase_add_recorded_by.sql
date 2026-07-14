-- =======================================================
-- SQL SCRIPT FOR SUPABASE SQL EDITOR
-- ADD AUDIT COLUMN AND UPDATE RLS POLICIES FOR LEGAL_ACCEPTANCES TABLE
-- =======================================================

-- 1. Add 'recorded_by' column referencing public.profiles(id)
-- This column tracks which staff member registered the legal acceptances on behalf of the customer.
ALTER TABLE public.legal_acceptances 
ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES public.profiles(id);

-- Add description comment to the column for documentation
COMMENT ON COLUMN public.legal_acceptances.recorded_by 
IS 'Tracks the staff member (admin/barber) who recorded/confirmed the acceptance on behalf of the user.';

-- 2. Update RLS policies for INSERT on legal_acceptances
-- Enable RLS just in case it is not enabled
ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;

-- Drop standard/expected policies if they exist to prevent conflicts
DROP POLICY IF EXISTS "Allow users to insert their own acceptances" ON public.legal_acceptances;
DROP POLICY IF EXISTS "Users can insert their own acceptances" ON public.legal_acceptances;
DROP POLICY IF EXISTS "Allow individual insert" ON public.legal_acceptances;
DROP POLICY IF EXISTS "Allow insert of legal acceptances" ON public.legal_acceptances;

-- Create a flexible insert policy:
-- Allows a user to insert their own acceptances OR staff (admin/barber) to insert on behalf of any customer.
CREATE POLICY "Allow insert of legal acceptances" 
ON public.legal_acceptances 
FOR INSERT 
TO authenticated 
WITH CHECK (
  profile_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'barber')
  )
);

