-- =======================================================
-- SQL SCRIPT FOR SUPABASE SQL EDITOR
-- OSANCHEZ BARBEARIA - ATENDIMENTO EXTRA COLUMN
-- =======================================================
-- Adds an `is_extra` boolean column to the appointments table.
-- This marks appointments created through the "Atendimento Extra" flow
-- (off-schedule / exception appointments that bypass availability validation).
-- Existing appointments default to FALSE.

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS is_extra BOOLEAN DEFAULT FALSE;

-- Optional: Add a comment for documentation
COMMENT ON COLUMN public.appointments.is_extra IS 'True for off-schedule exception appointments created via Atendimento Extra flow (bypasses working hours/lunch validation)';
