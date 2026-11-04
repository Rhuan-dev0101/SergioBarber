-- Rate limit por chave (acessada so via service role).
create table if not exists public.rate_limit_attempts (
  key text primary key,
  count int not null default 1,
  reset_time timestamptz not null
);

alter table public.rate_limit_attempts enable row level security;
-- Sem policies de proposito: anon/authenticated nao acessam.
revoke all on table public.rate_limit_attempts from anon, authenticated;
