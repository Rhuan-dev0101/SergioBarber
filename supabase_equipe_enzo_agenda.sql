-- Fecha agenda do Sergio (23, 24, 30, 31/12/2026) e desativa o Enzo sem apagar historico.
-- Identifica barbeiros por profiles.full_name (ILIKE). Confira o BEFORE: cada um deve retornar 1 linha.
-- days_off nao tem unique em (barber_id,date) nos .sql do repo; usa NOT EXISTS para nao duplicar.

-- ===== CONFERENCIA ANTES (rodar sozinho primeiro, fora da transacao) =====
SELECT b.id, p.full_name, b.is_active
FROM public.barbers b JOIN public.profiles p ON p.id = b.id
WHERE p.full_name ILIKE '%sergio%' OR p.full_name ILIKE '%enzo%';

SELECT d.* FROM public.days_off d JOIN public.profiles p ON p.id = d.barber_id
WHERE p.full_name ILIKE '%sergio%' AND d.date IN ('2026-12-23','2026-12-24','2026-12-30','2026-12-31');

SELECT count(*) AS vinculos_enzo FROM public.barber_services bs
JOIN public.profiles p ON p.id = bs.barber_id WHERE p.full_name ILIKE '%enzo%';

SELECT u.id, u.email, u.banned_until FROM auth.users u
JOIN public.profiles p ON p.id = u.id WHERE p.full_name ILIKE '%enzo%';

-- ===== MUDANCAS =====
BEGIN;

-- Aborta se nome nao resolver para exatamente 1 barbeiro cada.
DO $$
BEGIN
  IF (SELECT count(*) FROM public.barbers b JOIN public.profiles p ON p.id = b.id WHERE p.full_name ILIKE '%sergio%') <> 1
  OR (SELECT count(*) FROM public.barbers b JOIN public.profiles p ON p.id = b.id WHERE p.full_name ILIKE '%enzo%') <> 1 THEN
    RAISE EXCEPTION 'Nome Sergio/Enzo nao resolve para exatamente 1 barbeiro; abortando.';
  END IF;
END $$;

-- 1. Agenda do Sergio fechada
INSERT INTO public.days_off (barber_id, date, reason)
SELECT b.id, d::date, 'Fechado - fim de ano'
FROM public.barbers b
JOIN public.profiles p ON p.id = b.id AND p.full_name ILIKE '%sergio%'
CROSS JOIN (VALUES ('2026-12-23'),('2026-12-24'),('2026-12-30'),('2026-12-31')) AS v(d)
WHERE NOT EXISTS (
  SELECT 1 FROM public.days_off x WHERE x.barber_id = b.id AND x.date = v.d::date
);

-- 2. Enzo: desativa, remove vinculos de servico, bane login (historico em appointments/payments intacto)
UPDATE public.barbers SET is_active = false
WHERE id IN (SELECT id FROM public.profiles WHERE full_name ILIKE '%enzo%');

DELETE FROM public.barber_services
WHERE barber_id IN (SELECT id FROM public.profiles WHERE full_name ILIKE '%enzo%');

UPDATE auth.users SET banned_until = 'infinity'
WHERE id IN (SELECT id FROM public.profiles WHERE full_name ILIKE '%enzo%');

COMMIT;

-- ===== CONFERENCIA DEPOIS =====
SELECT b.id, p.full_name, b.is_active
FROM public.barbers b JOIN public.profiles p ON p.id = b.id
WHERE p.full_name ILIKE '%sergio%' OR p.full_name ILIKE '%enzo%';   -- Enzo: false

SELECT d.barber_id, d.date, d.reason FROM public.days_off d JOIN public.profiles p ON p.id = d.barber_id
WHERE p.full_name ILIKE '%sergio%' AND d.date IN ('2026-12-23','2026-12-24','2026-12-30','2026-12-31')
ORDER BY d.date;                                                     -- 4 linhas

SELECT count(*) AS vinculos_enzo FROM public.barber_services bs
JOIN public.profiles p ON p.id = bs.barber_id WHERE p.full_name ILIKE '%enzo%';  -- 0

SELECT u.id, u.email, u.banned_until FROM auth.users u
JOIN public.profiles p ON p.id = u.id WHERE p.full_name ILIKE '%enzo%';          -- infinity
