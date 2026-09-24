# Relatório de Segurança — Osanchez Barbearia (Sergio Barber)

**Branch:** `agent/seguranca-2026-09-21`
**Sessão:** 2026-09-24 (continuação de sessões anteriores na mesma branch)
**Stack:** Next.js 16 (App Router, `src/proxy.ts` substitui o antigo `middleware.ts`) + React 19 + Supabase (Postgres/Auth/Storage) + Tailwind 4 + Vercel. Pagamento via Pix (`qrcode-pix`), sem Stripe.

---

## 1. Resumo executivo

Nota de risco geral: **Médio-baixo**, em queda desde a auditoria de 2026-07-18. Não há segredo real vazado (git log e árvore de trabalho verificados). Os achados de alta severidade já mapeados foram corrigidos ou têm migration proposta pronta para revisão; o item novo desta sessão foi um IDOR real corrigido e testado.

**3 achados mais graves (histórico da branch):**
1. **`no-show.ts` publicamente invocável via HTTP** (Crítico, já corrigido) — `'use server'` indevido expunha `markNoShowFeeCharged`/`getOutstandingNoShowFee` como Server Actions públicas, sem checar sessão nem ownership.
2. **CORS aceitava qualquer `*.vercel.app`** (Alto, já corrigido) — qualquer deploy de terceiro na Vercel podia fazer requisições autenticadas com cookies de sessão.
3. **IDOR em `meus-servicos/actions.ts`** (Alto, corrigido nesta sessão) — um barbeiro autenticado conseguia vincular, editar ou apagar serviços do catálogo de **outro** barbeiro só trocando o `barberId`/`id` no payload da server action.

---

## 2. Achados

| ID | Severidade | Local | Descrição | Impacto | Status | Commit |
|---|---|---|---|---|---|---|
| F1 | Alto | `src/proxy.ts` (antigo `middleware.ts`) | CORS confiava em qualquer subdomínio `*.vercel.app` com `Access-Control-Allow-Credentials: true` | Site de terceiro hospedado na Vercel podia fazer requests autenticados às Server Actions | Corrigido | `173f6f9`, refinado em `b24e935` |
| F2 | Alto | `/entrar`, `/aceite`, `/auth/callback` | Open redirect via parâmetro `redirectTo` sem sanitização | Phishing pós-login (redireciona usuário legítimo para site atacante) | Corrigido | `0a5fb22` |
| F3 | Alto | `painel/agendamentos/actions.ts` (`updateAppointmentNotesAction`), `lib/receipt-actions.ts` (`getReceiptDataAction`) | Faltava checagem de ownership/role — barbeiro lia/editava notas de agendamentos de outro barbeiro; qualquer cliente autenticado podia ler recibo (nome, serviço, valor pago) de outro cliente | Vazamento de dados entre usuários e entre barbeiros | Corrigido | `b070a8c` |
| F4 | Crítico | `src/lib/no-show.ts` | `'use server'` no topo do arquivo tornava `markNoShowFeeCharged`/`getOutstandingNoShowFee` Server Actions públicas via HTTP, sem autenticação nem ownership | Qualquer requisição podia zerar taxa de no-show própria ou de terceiros (bypass financeiro) e consultar taxa pendente de qualquer `customerId` | Corrigido | `bdd933f` |
| F5 | Baixo/Médio | `src/app/cookie-consent/actions.ts` (`saveCookieConsentAction`) | Server Action pública (client de serviço, ignora RLS) aceitava `visitorId`/flags de consentimento sem checar tipo/tamanho | Gravação de lixo/abuso na tabela `cookie_consents` | Corrigido | `666e154` |
| F6 | Alto | `src/app/cliente/agendar/actions.ts:68-96` | Condição de corrida (TOCTOU): checagem de disponibilidade e `INSERT` não são atômicos; sem constraint de exclusão no Postgres | Double-booking do mesmo horário/barbeiro | **Proposto** (migration não executada) | `6605ba0` — `supabase_security_no_overlap_appointments.sql` |
| F7 | Alto | Tabela `profiles` (Supabase) | Policy de SELECT original (`supabase_update.sql`) libera `USING (true)` para `public`, expondo email/telefone de toda a equipe via chave anônima | Enumeração de e-mails/telefones da equipe por qualquer visitante | **Proposto** (migration não confirmada como aplicada em produção) | `173f6f9` — `supabase_security_profiles_rls.sql` |
| F8 | Alto | Buckets `barber-photos`/`gallery-photos` (Supabase Storage) | Policies originais liberam INSERT/UPDATE/DELETE para **qualquer** usuário autenticado (não só admin/barber) | Cliente logado podia apagar/substituir foto de barbeiro ou imagem da galeria | **Proposto** (migration não confirmada como aplicada em produção) | `b24e935` — `supabase_security_storage_policies.sql` |
| F9 | Alto | `src/app/painel/meus-servicos/actions.ts` | `addBarberServiceAction`/`createAndAddBarberServiceAction` aceitavam `barberId` do client sem validar contra a sessão; `updateBarberServiceAction`/`deleteBarberServiceAction` não checavam de quem era a linha antes de alterar/apagar | Barbeiro autenticado conseguia gerenciar (criar/editar preço/apagar) o catálogo de **qualquer outro** barbeiro pelo ID | **Corrigido nesta sessão** | `a233232` |
| F10 | Baixo | `src/components/ui/animated-sign-in.tsx` (já removido) | Componente morto (não importado em lugar nenhum) logava email+senha em texto plano no console | Baixo risco real (código morto), mas foi removido por precaução | Corrigido | `b24e935` |
| F11 | Médio | `src/lib/rateLimit.ts` | Rate limit de login/cadastro usa `Map` em memória — não sobrevive a cold start nem é compartilhado entre instâncias serverless da Vercel | Proteção contra força bruta é fraca em produção multi-instância | Pendente (ver Decisões pendentes) | — |
| F12 | Médio | Bucket `review-photos` (Supabase Storage), usado em `src/components/ReviewModal.tsx` | Policies desse bucket não estão versionadas em nenhum `.sql` do repositório — estado real de quem pode ler/escrever é desconhecido a partir do código. Upload é client-side com `upsert: true` e path `reviews/${userId}_${timestamp}.${ext}` (validação de tipo/tamanho já existe no client, `ReviewModal.tsx:38-43`, mas é só best-effort — quem decide de fato é a policy do bucket) | Sem visibilidade, não é possível confirmar se um usuário consegue sobrescrever foto de avaliação de outro | Pendente (ver Decisões pendentes) | — |
| — | Info | `src/app/cliente/agendar/actions.ts` + `page.tsx`, `src/app/page.tsx`, `src/app/barbeiros/page.tsx` | IDs mock (`sergio-uuid`/`enzo-uuid`) usados como fallback de UI ainda são checados dentro da Server Action real de agendamento — bug funcional (erro de tipo no Postgres se o banco estiver vazio no fallback), **não é uma falha de autorização/acesso** | Erro genérico ao usuário em cenário raro (banco vazio/fora do ar) | Fora do escopo deste agente (não é achado de segurança) | — |
| — | Info | Submódulo Git quebrado `SanchezBarbearia` (sem `.gitmodules`) | Resíduo de `git init` — clone novo gera pasta vazia | Nenhum (housekeeping) | Fora do escopo deste agente | — |
| — | Info | `next.config.ts` — CSP com `script-src 'self' 'unsafe-inline'` | Necessário hoje pelos scripts inline de hidratação do Next; `unsafe-eval` só em dev | Reduz um pouco a proteção do CSP contra XSS refletido/DOM, mitigável no futuro com nonce | Aceito, sem ação | — |
| — | OK | `git log -p --all` + árvore de trabalho | Busca por `sk_live_`, `sk_test_`, JWT (`eyJhbGciOi`), `-----BEGIN`, `AKIA...`, valores de `SUPABASE_SERVICE_ROLE_KEY`/`GMAIL_SMTP_APP_PASSWORD` | Nenhum segredo real encontrado no histórico nem no código | — | — |
| — | OK | Projeto inteiro | `npm audit --omit=dev` → **0 vulnerabilidades** | — | — | — |
| — | OK | `src/app/api/cron/appointment-reminders/route.ts` | Bearer token com comparação em tempo constante (`timingSafeEqual`), 401 se `CRON_SECRET` ausente/errado | — | — | — |
| — | OK | `src/`, `.rpc(` e `fetch(` | Nenhum `.rpc()` com SQL dinâmico; nenhum `fetch()` server-side com URL vinda de input do usuário (sem SSRF); único `dangerouslySetInnerHTML` (`spotlight-card.tsx:180`) é CSS estático sem input de usuário | — | — | — |
| — | OK | `src/app/api/**/route.ts` | Nenhuma rota devolve `error.message`/`error.stack` bruto ao cliente | — | — | — |

---

## 3. O que foi corrigido (com commits)

Todos os commits abaixo estão na branch `agent/seguranca-2026-09-21`, nenhum na `main`:

- `a233232` — **(nesta sessão)** fix(authz): fecha IDOR em `meus-servicos/actions.ts` para `role=barber`. Validado com `tsc --noEmit`, `eslint` e `next build` limpos antes do commit.
- `666e154` — fix(validation): valida tipo/tamanho do input em `saveCookieConsentAction`.
- `bdd933f` — fix(authz): remove `'use server'` indevido de `src/lib/no-show.ts`.
- `b070a8c` — fix(authz): fecha 2 gaps de checagem de ownership/role em server actions.
- `0a5fb22` — fix(auth): bloqueia open redirect via parâmetro `redirectTo`.
- `173f6f9` / `b24e935` — hardening de CORS, headers e propostas de RLS/storage.

---

## 4. Migrations propostas (arquivos SQL, **não executados** — precisam ser rodados manualmente no SQL Editor do Supabase após revisão)

- `supabase_security_no_overlap_appointments.sql` — `EXCLUDE` constraint (`btree_gist`) para impedir double-booking (F6).
- `supabase_security_profiles_rls.sql` — restringe SELECT público em `profiles` a colunas `id/full_name/role` da equipe (F7).
- `supabase_security_storage_policies.sql` — restringe escrita em `barber-photos`/`gallery-photos` a admin/barber (F8).

Nenhuma dessas foi aplicada por este agente (regra de operação: apenas criar arquivo de migration, nunca rodar contra produção). **Não há como confirmar pelo código se já foram aplicadas manualmente** — ver Decisões pendentes.

---

## 5. Decisões pendentes

1. **Confirmar se as 3 migrations propostas acima (F6, F7, F8) já foram rodadas em produção.** Se não, `profiles` e os buckets `barber-photos`/`gallery-photos` seguem com as policies antigas mais permissivas hoje. Risco de cada uma: F7 (vazamento de email/telefone da equipe) e F8 (cliente comum apagando fotos) são Alto; F6 (double-booking) é Alto mas de menor probabilidade.
2. **Bucket `review-photos` (F12): posso inspecionar/corrigir as policies de storage desse bucket?** Não estão versionadas no repositório, então não tenho visibilidade do estado atual sem acessar o dashboard do Supabase — e regras de operação me impedem de ler/alterar produção diretamente. Preciso que alguém exporte as policies atuais (ou rode `select * from pg_policies where tablename='objects'` filtrado por esse bucket) para eu avaliar.
3. **Rate limiting em memória (F11): posso trocar para um contador compartilhado (tabela no Supabase ou Vercel KV/Upstash)?** É uma mudança de infraestrutura (nova dependência ou tabela), não uma correção pontual — prefiro alinhamento antes de implementar, já que pode exigir uma env var/serviço novo.
4. IDs mock de barbeiro alcançáveis pela Server Action de agendamento (`sergio-uuid`/`enzo-uuid`) e o submódulo Git quebrado (`SanchezBarbearia`) **não são achados de segurança** (não permitem acesso indevido) — deixados de fora deste relatório por estarem fora do escopo do agente de AppSec; seguem documentados em `AUDITORIA.md` para quem cuidar de bugs funcionais/housekeeping.
5. Notei alterações **não commitadas** em `package.json`/`package-lock.json` (bump de `next` para `^16.3.5`) na árvore de trabalho compartilhada — não mexi nelas por não serem deste agente (parecem ser de um agente de Dependências rodando em paralelo na mesma pasta). Sinalizando para não gerar confusão: não fazem parte de nenhum commit listado acima.

---

*Relatório gerado por agente de AppSec autônomo. Nenhuma ação destrutiva, deploy, merge ou push foi executada.*
