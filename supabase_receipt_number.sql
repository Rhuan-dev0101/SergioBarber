-- =======================================================
-- SQL SCRIPT: AUTOMATIC RECEIPT NUMBER ASSIGNMENT
-- OSANCHEZ BARBEARIA - RECEIPT SEQUENCE & TRIGGER SETUP
-- =======================================================

-- 1. Create receipt_number sequence starting at 1000 if not exists
CREATE SEQUENCE IF NOT EXISTS public.payment_receipt_seq START WITH 1000;

-- 2. Add receipt_number column to public.payments if it doesn't exist
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS receipt_number BIGINT UNIQUE;

-- 3. Create or replace trigger function for locking in receipt_number
CREATE OR REPLACE FUNCTION public.assign_payment_receipt_number()
RETURNS TRIGGER AS $$
BEGIN
  -- GUARANTEE 1: Only assign if status is being set to 'paid' or 'confirmed_manually'
  -- AND receipt_number IS CURRENTLY NULL.
  -- If receipt_number already has a value, it is NEVER overwritten.
  IF (NEW.status IN ('paid', 'confirmed_manually')) AND (NEW.receipt_number IS NULL) THEN
    NEW.receipt_number := nextval('public.payment_receipt_seq');
  END IF;

  -- GUARANTEE 2: Reversals / Refunds / Cancellations.
  -- If status changes to 'refunded', 'cancelled', etc., OLD.receipt_number is preserved.
  IF OLD IS NOT NULL AND OLD.receipt_number IS NOT NULL THEN
    NEW.receipt_number := OLD.receipt_number;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Drop trigger if already exists and recreate
DROP TRIGGER IF EXISTS trg_assign_receipt_number ON public.payments;

CREATE TRIGGER trg_assign_receipt_number
BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.assign_payment_receipt_number();
