-- =======================================================
-- OSANCHEZ BARBEARIA - IMPEDE DOUBLE-BOOKING NO BANCO
-- NAO EXECUTADO por este agente. Rodar manualmente no SQL Editor do
-- Supabase (idealmente primeiro em um projeto/branch de dev) depois de
-- revisar a secao "ANTES DE RODAR" abaixo.
-- =======================================================
--
-- PROBLEMA
--   O fluxo de agendamento (createAppointmentAction em
--   src/app/cliente/agendar/actions.ts, e createWalkInAppointmentAction em
--   src/app/painel/agendamentos/actions.ts) segue o padrao "verifica
--   disponibilidade, depois insere": chama getAvailableSlots() e, se o
--   horario aparecer livre, faz o INSERT em appointments. Nao ha lock nem
--   constraint no banco entre as duas operacoes. Duas requisicoes
--   concorrentes para o mesmo barbeiro+horario (dois cliques quase
--   simultaneos, ou duas abas) podem ambas passar na checagem e ambas
--   inserirem -- overbooking (TOCTOU). Achado ja registrado em
--   AUDITORIA.md (2026-07-18, item 2) e ainda nao corrigido.
--
-- ESTRATEGIA
--   EXCLUDE constraint com btree_gist: o Postgres rejeita, atomicamente,
--   qualquer INSERT/UPDATE cujo intervalo (start_time, end_time) sobreponha
--   um agendamento existente do MESMO barbeiro. Isso fecha a corrida
--   independente de quantas requisicoes cheguem ao mesmo tempo -- nao
--   depende de lock aplicado a nivel de aplicacao.
--
--   Agendamentos cancelados (status = 'cancelled') sao excluidos da
--   constraint (liberam o horario). "Atendimento Extra" (is_extra = true)
--   TAMBEM e excluido de proposito: o proprio codigo documenta que esse
--   fluxo "COMPLETELY SKIPS availability validation" para cobrir walk-ins
--   fora do horario normal ou lancamentos retroativos -- aplicar a
--   constraint ali quebraria esse caso de uso legitimo de forma que
--   bloquearia trabalho real do staff, o que este agente nao pode decidir
--   sozinho (ver AGENTS deste projeto: "nunca... mudar regra de acesso
--   existente de forma que usuarios percam acesso").
--
-- ANTES DE RODAR (leia e decida, nao sou eu quem decide isso):
--   1. Rodar primeiro em ambiente de dev/staging, nunca direto em produção.
--   2. Existem HOJE agendamentos que já se sobrepõem no banco? Rode a
--      query de verificação no final deste arquivo ANTES do BEGIN. Se
--      houver conflitos reais (não cancelados, não extra), a migration
--      falha ao criar a constraint -- é intencional, mas alguém precisa
--      decidir o que fazer com esses registros primeiro (cancelar um dos
--      dois, remarcar, etc.). Este agente não cancela agendamentos
--      sozinho.
--   3. Confirma que a extensão `btree_gist` pode ser instalada no projeto
--      (disponível por padrão no Supabase, mas exige permissão de
--      superusuário do schema -- normalmente ok via SQL Editor).
-- =======================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Idempotente: caso supabase_extra_appointment.sql ainda não tenha rodado
-- neste ambiente.
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS is_extra BOOLEAN DEFAULT FALSE;

ALTER TABLE public.appointments
DROP CONSTRAINT IF EXISTS appointments_no_overlap_per_barber;

ALTER TABLE public.appointments
ADD CONSTRAINT appointments_no_overlap_per_barber
EXCLUDE USING gist (
  barber_id WITH =,
  tsrange(start_time, end_time) WITH &&
)
WHERE (status <> 'cancelled' AND COALESCE(is_extra, FALSE) = FALSE);

COMMIT;

-- =======================================================
-- VERIFICACAO -- rode ANTES do BEGIN acima, para saber se ja existe
-- conflito que vai impedir a constraint de ser criada:
--
--   SELECT a1.id, a2.id, a1.barber_id, a1.start_time, a1.end_time
--   FROM public.appointments a1
--   JOIN public.appointments a2
--     ON a1.barber_id = a2.barber_id
--    AND a1.id < a2.id
--    AND tsrange(a1.start_time, a1.end_time) && tsrange(a2.start_time, a2.end_time)
--   WHERE a1.status <> 'cancelled' AND COALESCE(a1.is_extra, FALSE) = FALSE
--     AND a2.status <> 'cancelled' AND COALESCE(a2.is_extra, FALSE) = FALSE;
--
-- Depois de aplicada, o app deve tratar o erro do Postgres
-- (23P01 exclusion_violation) no INSERT de appointments como "horario
-- indisponivel" -- hoje o catch generico de createAppointmentAction /
-- createWalkInAppointmentAction ja devolve uma mensagem de erro para
-- qualquer falha de insert, entao o comportamento visivel ao usuario nao
-- quebra, mas vale trocar a mensagem para a mesma de "horario nao
-- disponivel" quando o code for 23P01 (melhoria de UX, nao de seguranca).
-- =======================================================
