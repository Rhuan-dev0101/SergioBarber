# Plano de Implementação — Correções da Auditoria

**Referência:** `AUDITORIA.md` (2026-07-18)
**Objetivo:** eliminar os 3 achados de alta severidade, resolver os 3 de média e reduzir o débito técnico de baixa severidade, na ordem que minimiza risco de regressão em produção.

---

## Ordem de execução e dependências

```
Fase 0 (housekeeping, sem risco)
  └─ 0.1 Corrigir submódulo Git quebrado
Fase 1 (correções críticas, deploy isolado e rápido)
  ├─ 1.1 CORS: restringir *.vercel.app
  └─ 1.2 Remover ramo mock da Server Action de agendamento
Fase 2 (integridade de dados — depende de acesso ao Supabase)
  ├─ 2.1 Constraint de exclusão anti-double-booking
  └─ 2.2 Consolidar schema/migrations
Fase 3 (infraestrutura)
  └─ 3.1 Rate limit persistente (fora da memória do processo)
Fase 4 (qualidade de código, incremental, sem prazo rígido)
  ├─ 4.1 Remover componente morto com console.log de senha
  ├─ 4.2 Zerar erros do ESLint (152 erros / 93 avisos)
  └─ 4.3 Reduzir uso de `any` (116 ocorrências)
```

Fases 0 e 1 podem ser feitas no mesmo PR (baixo risco, alto valor). Fase 2.1 precisa de uma migration no banco e deve ser testada em ambiente de homologação antes de produção, pois altera uma tabela em uso. Fase 4 não bloqueia nada e pode virar trabalho contínuo.

---

## Fase 0 — Housekeeping

### 0.1 Corrigir referência quebrada do submódulo `SanchezBarbearia`
**Risco:** nenhum (não afeta a aplicação em runtime).
**Decisão necessária do usuário:** o conteúdo de `SanchezBarbearia` deveria existir como submódulo real (linkado a um repositório remoto) ou é lixo a remover?

- **Se for lixo:**
  ```bash
  git rm --cached SanchezBarbearia
  rm -rf SanchezBarbearia
  git commit -m "Remove referência órfã de submódulo SanchezBarbearia"
  ```
- **Se for um submódulo válido:** criar `.gitmodules` apontando para a URL remota correta e rodar `git submodule sync`.

**Critério de aceite:** `git submodule status` não retorna erro; `git clone` limpo do repositório não deixa pasta vazia/inconsistente.

---

## Fase 1 — Correções críticas

### 1.1 CORS: parar de confiar em qualquer `*.vercel.app`
**Arquivo:** `src/middleware.ts:76-88`

Substituir a checagem por uma allowlist fechada, com as URLs de preview do próprio projeto vindas de env var (a Vercel expõe `VERCEL_URL` no ambiente do servidor para o deployment atual):

```ts
const allowedOrigins = [
  'http://localhost:3000',
  'https://osanchez-barbearia.vercel.app',
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
]
const isAllowed = origin ? allowedOrigins.includes(origin) : false
```

Remover completamente o `origin.endsWith('.vercel.app')`.

**Testes:**
- Requisição com `Origin: https://osanchez-barbearia.vercel.app` → cabeçalhos CORS presentes.
- Requisição com `Origin: https://attacker-abc123.vercel.app` → `Access-Control-Allow-Origin: null` (rejeitada).
- Fluxo normal do próprio front-end (same-origin, sem header `Origin` explícito de terceiro) continua funcionando.

**Critério de aceite:** nenhuma origem fora da allowlist recebe `Access-Control-Allow-Credentials: true`.

### 1.2 Remover dados mock do fluxo transacional de agendamento
**Arquivos:** `src/app/cliente/agendar/actions.ts:36-45`, `src/app/cliente/agendar/page.tsx:29-30,185`, `src/app/page.tsx`, `src/app/barbeiros/page.tsx`

Passos:
1. Em `createAppointmentAction`, remover o bloco `if (barberId === 'sergio-uuid' || barberId === 'enzo-uuid') { mockServices... }`. A função deve **sempre** buscar o serviço em `barber_services` no banco.
2. Em `cliente/agendar/page.tsx`, quando a lista de barbeiros vier do fallback (ou seja, a consulta ao Supabase falhou/retornou vazio), desabilitar o avanço para a etapa de confirmação e exibir mensagem tipo *"Agendamento temporariamente indisponível, tente novamente em instantes"*. Isso exige que a página propague um flag `isFallback: boolean` junto dos dados de barbeiro, em vez de só os arrays estáticos.
3. Manter `FALLBACK_BARBERS`/`SEED_BARBERS` em `page.tsx` e `barbeiros/page.tsx` **apenas** como conteúdo estático de marketing (não navegável para agendamento) — isso já é o comportamento correto nessas duas páginas; o problema está isolado em `agendar/page.tsx` + `actions.ts`.

**Testes:**
- Com o banco populado normalmente: fluxo de agendamento completo funciona sem alteração de comportamento.
- Simulando banco vazio (ambiente de teste): a tela de agendamento não deixa o usuário chegar ao passo de confirmação com um barbeiro fictício.

**Critério de aceite:** não existe mais nenhuma comparação de string com `'sergio-uuid'`/`'enzo-uuid'` dentro de `actions.ts`.

---

## Fase 2 — Integridade de dados no Supabase

### 2.1 Impedir double-booking no nível do banco
**Onde:** nova migration SQL (ver 2.2 para onde ela deve morar).

```sql
-- Necessário para constraints de exclusão com tipos não-contínuos
create extension if not exists btree_gist;

alter table public.appointments
  add column if not exists time_range tstzrange
  generated always as (tstzrange(start_time, end_time, '[)')) stored;

alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    barber_id with =,
    time_range with &&
  )
  where (status <> 'cancelled');
```

Depois, em `createAppointmentAction` (`src/app/cliente/agendar/actions.ts`), tratar o código de erro do Postgres para exclusion constraint (`error.code === '23P01'`) e devolver a mesma mensagem amigável já usada para conflito de horário ("Desculpe, este horário não está mais disponível.").

**Testes:**
- Duas chamadas concorrentes (`Promise.all` num script de teste) para o mesmo `barber_id`/horário: exatamente uma tem sucesso, a outra recebe erro tratado (não um erro 500 cru).
- Agendamentos em horários diferentes ou com barbeiros diferentes continuam funcionando normalmente.
- Cancelar um agendamento (`status = 'cancelled'`) libera o horário para nova reserva (a constraint tem `where status <> 'cancelled'`).

**Critério de aceite:** não é mais possível ter duas linhas ativas em `appointments` com o mesmo `barber_id` e intervalos de tempo sobrepostos.

### 2.2 Consolidar schema e migrations
Passos:
1. Rodar `supabase db pull` (ou `supabase db dump`) apontando para o projeto de produção para gerar um baseline fiel do schema atual, incluindo todas as políticas de RLS já aplicadas manualmente pelo dashboard.
2. Criar a pasta `supabase/migrations/` e mover para lá, em ordem cronológica, o conteúdo hoje disperso em `supabase_update.sql`, `supabase_add_recorded_by.sql`, `supabase_gallery.sql`, `supabase_packages.sql`, prefixando cada arquivo com timestamp (`supabase migration new <nome>`).
3. A partir daqui, toda alteração de schema (incluindo a constraint da tarefa 2.1) vira uma nova migration versionada, nunca mais um script solto na raiz do projeto.
4. Apagar os arquivos `supabase_*.sql` da raiz após confirmar que o conteúdo foi replicado nas migrations.

**Critério de aceite:** `supabase db reset` local (ou um projeto novo) reproduz o schema de produção só rodando as migrations do repositório.

---

## Fase 3 — Infraestrutura

### 3.1 Rate limiting persistente
**Arquivo:** `src/lib/rateLimit.ts`

Recomendação: já que o projeto já usa Supabase, criar uma tabela simples em vez de introduzir um novo serviço (Redis/Upstash) só para isso:

```sql
create table public.rate_limit_attempts (
  key text primary key,          -- ip ou email normalizado
  count int not null default 1,
  reset_time timestamptz not null
);
```

Reescrever `checkRateLimit` para fazer `upsert` nessa tabela via `createServerSupabaseClient` (ou um client com a service role, já que é escrita de sistema, não de usuário), preservando a mesma assinatura de função (`checkRateLimit(ip, email)`) para não precisar tocar em `auth/actions.ts`.

**Alternativa mais rápida (se não quiser tocar no banco agora):** Vercel KV / Upstash Redis com `@upstash/ratelimit` — menos código, mas adiciona uma dependência/serviço externo.

**Testes:**
- 6 tentativas de login com a mesma combinação IP+e-mail em menos de 15 min → a 6ª é bloqueada, mesmo simulando reinício do processo (matando e subindo o dev server de novo) ou usando duas instâncias locais em paralelo.

**Critério de aceite:** o bloqueio de rate limit sobrevive a um restart do servidor.

---

## Fase 4 — Qualidade de código (incremental)

### 4.1 Remover componente morto `animated-sign-in.tsx`
```bash
git rm src/components/ui/animated-sign-in.tsx
```
Confirmar antes que não há nenhum import (`grep -rn "animated-sign-in" src/`) — já verificado na auditoria, está órfão.

### 4.2 Zerar os 152 erros / 93 avisos do ESLint
Ordem sugerida (do mais mecânico ao mais manual):
1. `npx eslint . --fix` — resolve automaticamente boa parte de `no-unused-vars` (imports não usados) e formatação.
2. `react/no-unescaped-entities` (11 ocorrências) — troca mecânica de `'`/`"` por entidades HTML.
3. `react-hooks/set-state-in-effect` (23 ocorrências, ex. `ThemeProvider.tsx:20`, `Footer.tsx:21`) — requer revisão caso a caso: geralmente a correção é inicializar o estado direto (lazy initializer do `useState`) em vez de setar dentro do `useEffect`.
4. `react-hooks/exhaustive-deps` (13 ocorrências) — revisar cada um manualmente; **não** silenciar com `eslint-disable` sem entender se falta uma dependência real (risco de stale closures no fluxo de agendamento).
5. `@next/next/no-img-element` (3 ocorrências) — trocar `<img>` por `next/image`.
6. `@typescript-eslint/ban-ts-comment` (1 ocorrência, `spotlight-card.tsx:104`) — trocar `@ts-ignore` por `@ts-expect-error`.

### 4.3 Reduzir uso de `any` (116 ocorrências)
Fazer por módulo, não tudo de uma vez:
1. Priorizar os `any` em código de negócio crítico (`booking.ts`, `agendar/actions.ts`, `financeiro/actions.ts`) — tipar os retornos de queries do Supabase com os tipos gerados (`supabase gen types typescript`).
2. Gerar `src/lib/database.types.ts` a partir do schema real (`supabase gen types typescript --project-id <id> > src/lib/database.types.ts`) e usar `createClient<Database>(...)` para que o client Supabase já venha tipado, eliminando boa parte dos `as any` em relações (`(barberService.services as any)?.name`).
3. Deixar os `any` de componentes puramente visuais (UI) por último.

**Critério de aceite (fase 4 como um todo):** `npm run lint` passa sem erros (avisos remanescentes documentados/aceitos explicitamente).

---

## Resumo de esforço estimado

| Item | Esforço | Risco de regressão |
|---|---|---|
| 0.1 Submódulo Git | S | Nenhum |
| 1.1 CORS | S | Baixo |
| 1.2 Remover mock do booking | M | Baixo/Médio (mexe na UI de agendamento) |
| 2.1 Constraint anti double-booking | M | Médio (migration em tabela ativa) |
| 2.2 Consolidar migrations | M | Baixo (não muda comportamento) |
| 3.1 Rate limit persistente | M | Baixo |
| 4.1 Remover componente morto | S | Nenhum |
| 4.2 Zerar ESLint | L (incremental) | Baixo, se feito por partes |
| 4.3 Reduzir `any` | L (incremental) | Baixo, se feito por partes |

S = pequeno (< 1h), M = médio (algumas horas), L = grande (dias, mas paralelizável/incremental).

---

## Próximo passo sugerido
Começar pela Fase 0 + Fase 1 (itens 0.1, 1.1, 1.2) em um único PR — são as correções mais baratas e de maior impacto de risco/segurança. Me avise quando quiser que eu implemente algum item específico e eu sigo o plano acima.
