# Auditoria do Projeto — Osanchez Barbearia

**Data:** 2026-07-18
**Stack:** Next.js 16 (App Router) + React 19 + Supabase (Postgres/Auth/Storage) + Tailwind 4
**Escopo:** revisão de segurança, correção funcional, integridade de dados e qualidade de código, com base em leitura de código-fonte, `git log`/`git ls-tree`, `npm audit` e `eslint`.

---

## Resumo executivo

O projeto está estruturalmente bem encaminhado: as Server Actions do painel administrativo verificam papel (`admin`/`barber`) no servidor antes de qualquer operação sensível, a `SUPABASE_SERVICE_ROLE_KEY` só é usada em código server-side, o middleware protege `/painel` e `/cliente`, e existem políticas de RLS nos scripts SQL. Os problemas encontrados são pontuais, mas alguns têm impacto real em produção — principalmente uma política de CORS excessivamente permissiva, uma condição de corrida no agendamento, dados de demonstração vazando para o fluxo transacional, e uma referência de submódulo Git quebrada.

| Severidade | Qtde | Itens |
|---|---|---|
| 🔴 Alta | 3 | CORS confia em qualquer `*.vercel.app`; race condition no agendamento; dados mock no fluxo real de agendamento |
| 🟡 Média | 3 | Submódulo Git quebrado; ausência de schema/migrations consolidado; rate limit em memória não sobrevive a múltiplas instâncias |
| ⚪ Baixa/Info | 4 | Componente morto vazando senha no console; 116 usos de `any`; 152 erros / 93 avisos de ESLint; vulnerabilidade moderada transitiva (postcss via Next) |

---

## 🔴 Achados de alta severidade

### 1. CORS confia em qualquer subdomínio `*.vercel.app` com credenciais habilitadas
**Arquivo:** `src/middleware.ts:76-88`

```ts
const allowedOrigins = ['http://localhost:3000', 'https://osanchez-barbearia.vercel.app']
const isAllowed = origin && (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app'))
...
response.headers.set('Access-Control-Allow-Origin', origin)
response.headers.set('Access-Control-Allow-Credentials', 'true')
```

`vercel.app` é um domínio **compartilhado e público** — qualquer pessoa pode publicar um app em `qualquer-coisa.vercel.app`. A checagem `origin.endsWith('.vercel.app')` permite que **qualquer deployment de terceiros na Vercel** seja tratado como origem confiável, com `Access-Control-Allow-Credentials: true`. Isso permite que um site atacante hospedado em `attacker-abc123.vercel.app` faça requisições autenticadas (com cookies de sessão) para as rotas da API/Server Actions do projeto.

**Recomendação:** restringir a uma lista fixa de origens conhecidas (produção + preview URLs específicas do próprio projeto, que seguem um padrão previsível como `osanchez-barbearia-*.vercel.app` do mesmo time/projeto), nunca todo o domínio compartilhado `.vercel.app`.

### 2. Condição de corrida (TOCTOU) na criação de agendamentos
**Arquivo:** `src/app/cliente/agendar/actions.ts:68-96`

O fluxo é: (1) consulta `getAvailableSlots` para ver se o horário está livre, (2) só então insere em `appointments`. Não há trava (lock), transação atômica, nem constraint de exclusão no banco (`EXCLUDE`/`UNIQUE`) impedindo dois clientes de reservar o mesmo `barber_id` + horário simultaneamente — apenas foi encontrada a checagem em nível de aplicação. Duas requisições concorrentes (dois cliques quase simultâneos, ou um usuário com duas abas) podem os dois passar na checagem de disponibilidade e ambos inserirem o mesmo horário.

**Recomendação:** adicionar uma constraint de exclusão no Postgres sobre `(barber_id, tsrange(start_time, end_time))` (extensão `btree_gist`), ou no mínimo uma `UNIQUE` composta que rejeite sobreposição exata, e tratar o erro de violação como "horário indisponível".

### 3. IDs de barbeiro mock (`sergio-uuid`/`enzo-uuid`) alcançáveis pelo fluxo real de agendamento
**Arquivos:** `src/app/cliente/agendar/actions.ts:36-45`, `src/app/cliente/agendar/page.tsx:29-30,185`, `src/app/page.tsx:22-25`, `src/app/barbeiros/page.tsx:12-29`

Os dados `FALLBACK_BARBERS`/`SEED_BARBERS` (usados como fallback visual quando o banco está vazio/indisponível) usam os ids literais `'sergio-uuid'` e `'enzo-uuid'` — que não são UUIDs válidos. Esses mesmos ids são checados explicitamente dentro da **Server Action de agendamento** (`createAppointmentAction`), que é o caminho transacional real. Se o banco estiver vazio/fora do ar no momento em que a página é renderizada (daí o fallback aparecer), qualquer cliente que tentar agendar com esses barbeiros "de mentira" vai gerar uma tentativa de `INSERT` em `appointments.barber_id` com um valor que não é UUID — isso falha com erro de tipo no Postgres (coluna `uuid`), e o cliente recebe uma mensagem genérica de erro sem entender por quê.

**Recomendação:** o fallback de UI deve ser puramente cosmético — quando os dados vierem do fallback, o formulário de agendamento não deveria permitir avançar para a etapa de confirmação (ou deveria exibir uma mensagem clara de "agendamento temporariamente indisponível"). O ramo `if (barberId === 'sergio-uuid' ...)` dentro da Server Action deveria ser removido — ele mistura dado de demonstração com lógica de produção.

---

## 🟡 Achados de média severidade

### 4. Submódulo Git quebrado: `SanchezBarbearia`
```
$ git ls-tree HEAD | grep -i sanchez
160000 commit a18f3e07b40319d30603b135554bf9604b2e8402  SanchezBarbearia
$ git submodule status
fatal: no submodule mapping found in .gitmodules for path 'SanchezBarbearia'
```
Existe uma referência de submódulo (`gitlink`, modo `160000`) apontando para um commit, mas **não há `.gitmodules`** registrando esse submódulo. Isso significa que qualquer `git clone` novo desse repositório vai criar uma pasta `SanchezBarbearia` **vazia** (sem os arquivos reais, já que git não sabe de onde buscá-los), e comandos como `git submodule update` falham. Aparenta ser resíduo de um `git init` feito por engano dentro da pasta do projeto.

**Recomendação:** decidir se `SanchezBarbearia` deveria ser um submódulo de verdade (criar `.gitmodules` com a URL remota) ou remover a referência (`git rm --cached SanchezBarbearia` e apagar a pasta/seu `.git` interno) se for lixo.

### 5. Ausência de schema/migrations consolidado do banco
Os únicos artefatos SQL versionados são patches incrementais (`supabase_update.sql`, `supabase_add_recorded_by.sql`, `supabase_gallery.sql`, `supabase_packages.sql`). Não existe um schema base nem uma pasta de migrations com ordem/numeração — não é possível recriar o banco do zero a partir do repositório, nem auditar de forma completa quais tabelas têm RLS habilitada e quais políticas existem hoje.

**Recomendação:** adotar `supabase/migrations/` com a CLI do Supabase (`supabase db diff`/`migration new`), e commitar um dump do schema atual como baseline.

### 6. Rate limiting em memória não é confiável em produção serverless
**Arquivo:** `src/lib/rateLimit.ts`

O rate limit de login/cadastro usa `Map` em memória (`ipStore`, `emailStore`). Em ambientes serverless (Vercel), cada instância/região tem sua própria memória e pode ser reciclada a qualquer momento — o contador zera a cada cold start e não é compartilhado entre instâncias concorrentes. Na prática, isso oferece pouca proteção real contra força bruta em produção, embora funcione bem localmente/single-instance.

**Recomendação:** mover o contador para algo compartilhado (tabela no Supabase, Upstash Redis, Vercel KV, etc.) se a proteção contra força bruta for um requisito real.

---

## ⚪ Achados de baixa severidade / informativos

### 7. Componente morto registra e-mail e senha no console
**Arquivo:** `src/components/ui/animated-sign-in.tsx:67`
```ts
console.log("Form submitted:", { email, password, rememberMe });
```
Esse componente **não é importado em nenhum lugar** do app (confirmado via busca). É código morto, mas se algum dia for reaproveitado, loga credenciais em texto puro no console do navegador. Recomenda-se remover o arquivo ou, se for mantido como referência de design, apagar o `console.log`.

### 8. 116 usos de `any` apesar de `strict: true` no `tsconfig.json`
`@typescript-eslint/no-explicit-any` é a regra mais violada (116 ocorrências). Isso reduz boa parte do valor do modo estrito do TypeScript — erros de tipo em campos vindos do Supabase (ex.: `(barberService.services as any)?.name`) não são pegos em tempo de compilação.

### 9. `npx eslint .` reporta 152 erros e 93 avisos
Resumo por regra:
| Regra | Ocorrências |
|---|---|
| `@typescript-eslint/no-explicit-any` | 116 |
| `@typescript-eslint/no-unused-vars` | 77 |
| `react-hooks/set-state-in-effect` | 23 |
| `react-hooks/exhaustive-deps` | 13 |
| `react/no-unescaped-entities` | 11 |
| `@next/next/no-img-element` | 3 |
| `@typescript-eslint/ban-ts-comment` | 1 |
| `react-hooks/immutability` | 1 |

Destaque para `react-hooks/set-state-in-effect` (23 ocorrências, ex.: `ThemeProvider.tsx:20`, `Footer.tsx:21`) — chamar `setState` de forma síncrona dentro de `useEffect` é um anti-padrão que o novo linter do React 19 já sinaliza como erro (não apenas aviso), e pode causar renders em cascata. `react-hooks/exhaustive-deps` (13 ocorrências) merece atenção pontual pois pode esconder bugs de closures obsoletas (stale state) em código de agendamento.

### 10. Vulnerabilidade moderada transitiva (postcss via Next)
`npm audit` acusa uma vulnerabilidade moderada de XSS em `postcss < 8.5.10`, **empacotada dentro do próprio `next`** (`node_modules/next/node_modules/postcss`). O fix automático exigiria fazer downgrade do Next para uma versão canário antiga — não é acionável agora; monitorar por um patch oficial do Next.

---

## Pontos positivos observados
- Autorização (`role === 'admin' | 'barber'`) é verificada **no servidor**, dentro de cada Server Action, e não apenas confiando no middleware ou na UI.
- `SUPABASE_SERVICE_ROLE_KEY` nunca é referenciada fora de arquivos `'use server'`, e apenas quando a sessão já foi validada como admin.
- Mensagens de erro de login/cadastro são genéricas (mitigação de user enumeration).
- `.env*` está corretamente no `.gitignore` e nenhuma chave está versionada no histórico do Git.
- Cabeçalhos de segurança (`X-Frame-Options: DENY`, CSP `frame-ancestors 'none'`, `X-Content-Type-Options`, `Referrer-Policy`) configurados em `next.config.ts`.
- Existem políticas de RLS (`CREATE POLICY`) nos scripts SQL versionados.
- Preço e duração do serviço são recalculados a partir do banco no momento do agendamento (evita manipulação client-side), exceto no ramo mock (item 3).

---

## Recomendações priorizadas
1. Corrigir a política de CORS (`middleware.ts`) — não confiar em `*.vercel.app`. *(rápido, alto risco)*
2. Adicionar constraint de exclusão no banco para impedir double-booking. *(médio esforço, alto risco)*
3. Remover o ramo de dados mock de `createAppointmentAction` e impedir que a UI ofereça agendamento quando estiver em modo fallback. *(rápido, corrige bug real)*
4. Resolver a referência quebrada do submódulo `SanchezBarbearia`. *(rápido, housekeeping)*
5. Consolidar o schema do banco em migrations versionadas. *(médio esforço, melhora manutenibilidade)*
6. Rodar `npx eslint . --fix` e revisar manualmente os `no-explicit-any` e `set-state-in-effect` restantes. *(incremental)*
