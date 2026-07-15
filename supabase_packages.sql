-- =======================================================
-- SQL SCRIPT FOR SUPABASE SQL EDITOR
-- OSANCHEZ BARBEARIA - PACOTE MENSAL (MONTHLY PACKAGES)
-- =======================================================

-- 1. Create package_subscriptions table
CREATE TABLE IF NOT EXISTS public.package_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id),
  barber_id UUID NOT NULL REFERENCES public.profiles(id),
  service_id UUID NOT NULL REFERENCES public.services(id),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  time_slot TEXT NOT NULL,            -- e.g. '19:00'
  start_date DATE NOT NULL,
  total_sessions INTEGER NOT NULL DEFAULT 4,
  package_price NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add package_subscription_id FK to appointments (nullable)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS package_subscription_id UUID
  REFERENCES public.package_subscriptions(id) ON DELETE SET NULL;

-- =======================================================
-- 3. RLS Policies for package_subscriptions
-- =======================================================
ALTER TABLE public.package_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Admin full access to package_subscriptions" ON public.package_subscriptions;
DROP POLICY IF EXISTS "Customers can view own package_subscriptions" ON public.package_subscriptions;

-- Admin: full CRUD access
CREATE POLICY "Admin full access to package_subscriptions"
ON public.package_subscriptions
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

-- Customer: read-only access to own subscriptions
CREATE POLICY "Customers can view own package_subscriptions"
ON public.package_subscriptions
FOR SELECT
TO authenticated
USING (customer_id = auth.uid());
