-- Indices de performance (idempotente). Derivados das queries em src/.
-- Rodar no SQL Editor do Supabase. Sem CONCURRENTLY (precisa de transacao fora do editor);
-- tabelas pequenas, lock e breve. Em tabela grande, rode cada linha separada com CONCURRENTLY.

-- appointments: agenda por barbeiro/periodo, checagem de disponibilidade (booking.ts, agendar/actions.ts)
CREATE INDEX IF NOT EXISTS idx_appointments_barber_start
  ON public.appointments (barber_id, start_time);

-- appointments: "meus agendamentos" do cliente (cliente/page.tsx, painel/clientes)
CREATE INDEX IF NOT EXISTS idx_appointments_customer_start
  ON public.appointments (customer_id, start_time DESC);

-- appointments: filtros por status (neq cancelled/completed, cron de lembretes, no_show)
CREATE INDEX IF NOT EXISTS idx_appointments_status_start
  ON public.appointments (status, start_time);

-- appointments: parcelas de pacote
CREATE INDEX IF NOT EXISTS idx_appointments_package_subscription
  ON public.appointments (package_subscription_id)
  WHERE package_subscription_id IS NOT NULL;

-- payments: lookup por agendamento (.eq/.in appointment_id em ~10 pontos)
CREATE INDEX IF NOT EXISTS idx_payments_appointment_id
  ON public.payments (appointment_id);

CREATE INDEX IF NOT EXISTS idx_payments_status
  ON public.payments (status);

-- barber_services: liga barbeiro<->servico (RLS usa barber_id; telas filtram por service_id)
CREATE INDEX IF NOT EXISTS idx_barber_services_barber
  ON public.barber_services (barber_id);
CREATE INDEX IF NOT EXISTS idx_barber_services_service
  ON public.barber_services (service_id);

-- days_off: .eq(barber_id).eq/gte/lte(date)
CREATE INDEX IF NOT EXISTS idx_days_off_barber_date
  ON public.days_off (barber_id, date);

-- blocked_times: .eq(barber_id) + faixa start_time/end_time
CREATE INDEX IF NOT EXISTS idx_blocked_times_barber_start
  ON public.blocked_times (barber_id, start_time);

-- barber_working_hours: .eq(barber_id).eq(day_of_week)
CREATE INDEX IF NOT EXISTS idx_barber_working_hours_barber_day
  ON public.barber_working_hours (barber_id, day_of_week);

-- package_subscriptions / recurring_reservations
CREATE INDEX IF NOT EXISTS idx_package_subscriptions_barber_status
  ON public.package_subscriptions (barber_id, status);
CREATE INDEX IF NOT EXISTS idx_package_subscriptions_customer
  ON public.package_subscriptions (customer_id);
CREATE INDEX IF NOT EXISTS idx_recurring_reservations_status
  ON public.recurring_reservations (status);

-- Conferencia
SELECT tablename, indexname FROM pg_indexes
WHERE schemaname = 'public' AND indexname LIKE 'idx\_%'
ORDER BY tablename, indexname;
