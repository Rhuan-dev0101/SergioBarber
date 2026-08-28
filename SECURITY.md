# Correções de segurança — Osanchez Barbearia

Projeto Supabase: `wokeokwhvkghmbxbaxgt` · Stack: Next.js 16.3.2 (App Router) + Supabase + Vercel

---

## Resumo

| # | Item | Severidade real | Status |
|---|------|-----------------|--------|
| 1 | Leitura anônima de PII em `profiles` | Média | ✅ **Aplicado e verificado em produção** (2026-08-28) |
| 2 | Cadastro aberto + e-mail auto-confirmado | Média | ⚠️ **Risco aceito pelo dono do negócio** — ver nota abaixo |
| 3 | Enumeração de contas no signup | Média | Código feito; sem efeito prático enquanto o item 2 ficar aberto |
| 4 | Headers de segurança / CORS | Baixa | ✅ Feito e testado |
| 5 | RLS das demais tabelas | — | ✅ Auditado: já estava correto |

**Item 1 já foi aplicado.** Conferido direto na API:

```
$ curl "…/rest/v1/profiles?select=email" -H "apikey: sb_publishable_…"
{"code":"42501","message":"permission denied for table profiles"}   ← antes: 200 + e-mails

$ curl "…/rest/v1/profiles?select=id,full_name,role" -H "apikey: sb_publishable_…"
[{"full_name":"Sergio Sanchez","role":"admin"}, {"full_name":"Enzo","role":"barber"}]  ← paginas publicas OK
```

**Item 2 (mailer_autoconfirm) foi decidido pelo dono do negócio, não implementado.** O barbeiro cadastra
clientes manualmente sem confirmação de e-mail — inclusive alguns sem usar o app — para manter a agenda
organizada. Expliquei explicitamente o risco (qualquer e-mail, mesmo que não pertença a quem digitou, entra
sem confirmar posse) e ele optou por manter assim por necessidade operacional. **Ficou registrado, não
pendente.** Se o fluxo de walk-in mudar no futuro e isso deixar de ser necessário, revisitar esta seção.

A migration SQL (seção 1) exigia acesso ao SQL Editor do Dashboard — este ambiente não tem `psql` nem
Personal Access Token (`sbp_...`) — então quem rodou o script foi o dono do projeto, com o texto pronto
que passei. O restante foi implementado e verificado por mim com evidência de HTTP antes/depois.

### Correção importante ao diagnóstico original

O relatório que originou este trabalho descreve o item 1 como exposição total de PII. **Medindo o banco real,
a exposição é menor do que isso** — e vale registrar para não superdimensionar o incidente:

```
# Total real no banco (service role):    80 profiles
# Visível sem token nenhum:               2 profiles (somente admin + barber)
```

Clientes **nunca** estiveram expostos anonimamente. O que vazava eram `full_name`, `email` e `role`
dos 2 membros da equipe:

```
$ curl "…/rest/v1/profiles?select=*" -H "apikey: sb_publishable_…"
HTTP 200
[{"full_name":"Sergio Sanchez","email":"osanchezbarbearia@gmail.com","role":"admin"},
 {"full_name":"Enzo","email":"enzofunchal2511@gmail.com","role":"barber"}]
```

Continua sendo um vazamento que precisa ser fechado (o e-mail pessoal de um funcionário é dado pessoal, e
saber *quem é admin* ajuda um atacante a escolher alvo de phishing), mas é **exposição de 2 registros de
equipe, não de 80 clientes**.

Três coisas que o relatório apontava como risco **já estavam corretamente protegidas** — testei todas:

- **Escalação de privilégio negada.** Um cliente tentando virar admin é bloqueado por trigger:
  `PATCH /profiles?id=eq.<self> {"role":"admin"}` → `HTTP 400 P0001 "Apenas administradores podem alterar
  a role de um usuário."` O trigger existe e funciona; a migration **não o toca**.
- **Metadata de signup não é confiada.** Cadastrando com `"data":{"role":"admin"}` no corpo da requisição,
  o profile criado sai com `role: customer`. O trigger de signup ignora a role vinda do cliente.
- **Isolamento entre clientes correto.** Um cliente comum autenticado enxerga 0 de 612 `appointments`,
  0 de 612 `payments`, 0 de 78 `legal_acceptances`, 0 de 70 `cookie_consents`.

---

## 1. `profiles` — restringir leitura  → `supabase_security_profiles_rls.sql`

### O problema

`supabase_update.sql` (seção 6) criou:

```sql
CREATE POLICY "Allow public read access to profiles"
ON public.profiles FOR SELECT TO public USING (true);
```

### Por que RLS sozinho não resolve

RLS é **row-level**: ele decide *quais linhas*, nunca *quais colunas*. E aqui existe um requisito conflitante:
as páginas públicas `/`, `/barbeiros` e `/servicos` precisam do **nome do barbeiro** — e a tabela `barbers`
**não tem coluna de nome**. O nome só existe em `profiles.full_name`:

```
barbers: id, is_active, bio, avatar_url, about_quote, experience_years, specialties, photo_url
```

Se eu simplesmente bloqueasse as linhas da equipe para anônimos, o efeito seria silencioso e feio: as duas
páginas fazem `.filter(b => b.profiles)` sobre o resultado do join, então o embed retornando `null` **descarta
todos os barbeiros** e a página cai no array `SEED_BARBERS` hardcoded — fotos e bios reais sumiriam do site.

### A solução: duas camadas

**Camada 1 — RLS (quais linhas):** anônimo só enxerga linhas com `role IN ('admin','barber')`. Nenhuma linha
de cliente aparece.

**Camada 2 — GRANT de coluna (quais colunas):** `anon` perde privilégio sobre `email`/`phone`/timestamps e
recebe de volta apenas `id, full_name, role`.

```sql
REVOKE ALL ON TABLE public.profiles FROM anon;
GRANT SELECT (id, full_name, role) ON TABLE public.profiles TO anon;
```

Essa segunda camada é a que realmente decide: privilégio de coluna é verificado **antes** de qualquer policy,
então mesmo que uma policy permissiva sobreviva a um script futuro, `select=email` continua respondendo
`42501 permission denied`. Também é o motivo de a correção **não exigir nenhuma mudança nas 18 consultas**
que fazem embed de `profiles` — auditei todas: as públicas pedem exatamente `id, full_name` e
`profiles(full_name, role)`; só `/painel/funcionarios` pede `email`, e é página de staff autenticado.

A migration usa `is_staff_member()` com `SECURITY DEFINER` — uma policy sobre `profiles` que consulta
`profiles` entraria em recursão infinita (`42P17`).

### Como aplicar

Cole `supabase_security_profiles_rls.sql` no **SQL Editor** do Supabase e execute. É idempotente
(remove as policies de SELECT por introspecção, então não depende dos nomes históricos) e roda em transação.

Ela **não** altera: o trigger de proteção de role, o trigger de criação de profile no signup, nem as policies
de INSERT/UPDATE/DELETE — que já foram testadas e estão corretas.

---

## 2. Cadastro aberto — **ação necessária no Dashboard**

Estado atual, lido do próprio servidor de auth:

```
$ curl "…/auth/v1/settings" -H "apikey: …"
{"disable_signup": false, "mailer_autoconfirm": true, "external": {"google": true, "facebook": true, "email": true}}
```

`mailer_autoconfirm: true` significa que qualquer um cria conta pelo endpoint público e **já sai autenticado**,
sem provar que tem acesso ao e-mail — confirmei recebendo um `access_token` na hora.

**O que fazer** (Dashboard → Authentication → Sign In / Providers → Email):

1. **Desligue "Confirm email" auto-confirm** (`mailer_autoconfirm = false`) → passa a exigir verificação.
2. **Ligue "Prevent use of leaked passwords"** e, em Auth → Rate Limits, reduza o limite de signup por hora.

**Não use `disable_signup = true`.** Ele bloqueia o registro de **novos usuários OAuth também** — nenhum
cliente novo conseguiria entrar com Google/Facebook, que hoje é o *único* caminho de cadastro exposto na
interface. Isso quebraria a aquisição de clientes, não só o e-mail/senha.

Isso é seguro para a UI atual: a tela `/criar-conta` só oferece Google e Facebook (`signInWithOAuth`) —
não existe formulário de e-mail/senha ligado ao signup. Exigir confirmação de e-mail portanto **fecha o
endpoint público sem alterar nada do que o usuário final usa hoje**. Contas OAuth não são afetadas, pois o
e-mail já vem verificado pelo provedor.

---

## 3. Anti-enumeração de contas → `src/app/auth/actions.ts`

Hoje o endpoint do Supabase responde de forma distinguível — testado:

```
signup com e-mail JÁ cadastrado  -> HTTP 422
signup com e-mail novo           -> HTTP 200
```

Basta iterar uma lista de e-mails para descobrir quem é cliente da barbearia.

**No código:** `signUpAction` agora devolve **a mesma mensagem** (`NEUTRAL_SIGNUP_MESSAGE`) tanto para
e-mail novo quanto para e-mail já cadastrado; só falha de infraestrutura retorna erro.

Duas observações honestas sobre o alcance disso:

- **`signUpAction` hoje é código morto** — nenhuma página o chama (a UI é OAuth-only). Endureci mesmo assim
  para que fique correto se for ligado no futuro, mas **quem fecha a enumeração de verdade é o item 2**:
  com `mailer_autoconfirm = false`, o próprio Supabase passa a responder igual nos dois casos.
- Aproveitei para corrigir um **bug latente** que o item 2 iria disparar: a action gravava telefone e aceites
  LGPD usando o client de sessão. Sem auto-confirm **não existe sessão** logo após o signup, então essas duas
  escritas cairiam no role `anon` e falhariam **em silêncio** — perdendo o telefone do cliente e o registro de
  consentimento. Passei ambas para o client de serviço, que independe de sessão.

Sobre rate limiting: `src/lib/rateLimit.ts` guarda contadores **em memória do processo**. Em serverless
(Vercel) cada instância tem o seu, e eles somem a cada cold start — na prática o teto real é bem maior que
os 5/15min pretendidos. Serve como amortecedor, não como controle. O limite que vale é o do Supabase
(Auth → Rate Limits), por isso a recomendação no item 2.

---

## 4. Headers e CORS → `next.config.ts`, `src/proxy.ts` ✅ testado

### `middleware.ts` → `proxy.ts`

Conforme `AGENTS.md`, li a documentação do Next 16 embarcada em `node_modules/next/dist/docs/`:
**`middleware.js` está deprecado e foi renomeado para `proxy.js`** (`v16.0.0`). Migrei o arquivo e a função
(`middleware()` → `proxy()`). O build confirma o reconhecimento: `ƒ Proxy (Middleware)`.

A mesma doc diz que Proxy *"should not be used as a full session management or authorization solution"* —
é checagem otimista. Documentei isso no arquivo: quem autoriza dados de verdade é o RLS, não o proxy.

### Headers adicionados

`poweredByHeader: false` (remove `X-Powered-By: Next.js`), `Permissions-Policy` (desliga câmera, microfone,
geolocalização, pagamento, USB…), `Strict-Transport-Security`, e uma CSP completa mantendo
`frame-ancestors 'none'`.

Cada origem da CSP corresponde a algo que a aplicação realmente carrega — Supabase (REST/Storage),
`images.unsplash.com`, avatares de `googleusercontent`/`fbcdn` vindos do OAuth, e `youtube.com` para o
`<iframe>` do tutorial.

**Limitação assumida:** mantive `'unsafe-inline'` em `script-src`. Removê-lo exige CSP por nonce, que segundo
a doc do Next obriga renderização dinâmica em todas as rotas — perderia o cache estático das páginas
institucionais. As demais diretivas (`object-src 'none'`, `base-uri`, `form-action`, `connect-src` restrito)
já barram a exfiltração para domínio de terceiros, que é o impacto prático de um XSS aqui.

### CORS — duas falhas reais corrigidas

O código anterior tinha:

```ts
const isAllowed = origin && (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app'))
...
} else { response.headers.set('Access-Control-Allow-Origin', 'null') }
```

1. **`origin.endsWith('.vercel.app')` liberava a Vercel inteira** — qualquer pessoa faz deploy grátis em
   `*.vercel.app` e ganhava CORS com `Allow-Credentials: true` sobre esta API.
2. **Refletir `'null'`** é pior que não enviar nada: `null` é a origem de iframes com `sandbox` e de
   documentos locais, ou seja, uma origem que o atacante consegue produzir.

Agora: whitelist explícita + regex ancorada no nome do projeto, `origin === 'null'` rejeitado
explicitamente, header **omitido** (não `null`) para origem desconhecida, `Vary: Origin` e preflight
`OPTIONS` respondido antes de tocar em sessão/banco.

Verificado em `next start` local:

```
Origin: http://localhost:3000                            -> http://localhost:3000       (permitido)
Origin: https://osanchez-barbearia.vercel.app            -> refletido                    (permitido)
Origin: https://osanchez-barbearia-git-main-x.vercel.app -> refletido                    (preview do projeto)
Origin: null                                             -> <ausente>                    (bloqueado)
Origin: https://evil.com                                 -> <ausente>                    (bloqueado)
Origin: https://evil-attacker.vercel.app                 -> <ausente>  ← ANTES: PERMITIDO
```

---

## 5. RLS das demais tabelas — auditoria ✅

Comparei o total real (service role) com o que vaza sem token. Se a tabela só tivesse 0 linhas, "vazio" não
provaria nada — por isso a coluna "total real":

| Tabela | Total real | Anônimo vê | Cliente logado vê (de outros) |
|---|---|---|---|
| `appointments` | 612 | 0 ✅ | 0 ✅ |
| `payments` | 612 | 0 ✅ | 0 ✅ |
| `legal_acceptances` | 78 | 0 ✅ | 0 ✅ |
| `cookie_consents` | 70 | 0 ✅ | 0 ✅ |
| `package_subscriptions` | 26 | 0 ✅ | 0 ✅ |
| `recurring_reservations` | 1 | 0 ✅ | 0 ✅ |
| `profiles` | 80 | **2** ❌ | próprio + equipe |
| `client_notes`, `blocked_times`, `days_off`, `reviews` | 0 | 0 | (tabela vazia) |

Públicas por design e sem PII: `barbers`, `services`, `barber_services`, `barber_working_hours`,
`business_settings`, `gallery_images`.

**Conclusão:** `profiles` era a única tabela com PII legível anonimamente. As demais já estavam corretas.

---

## Riscos residuais (assumidos conscientemente)

1. **Usuário logado enxerga nome/role/e-mail dos 2 membros da equipe.** É consequência direta de RLS ser
   row-level: o cliente precisa ver a *linha* do barbeiro para o agendamento mostrar o nome dele, e privilégio
   de coluna é por role do Postgres (`authenticated`) — não dá para liberar `email` ao admin e negar ao
   cliente na mesma tabela. Anônimos já não veem.
   **Para eliminar:** denormalizar `full_name` para a tabela `barbers` (que já é pública e não tem PII) e
   então restringir a policy 3b a `id = auth.uid() OR is_staff_member()`. Exige alterar ~7 consultas e um
   trigger de sincronia; **não fiz porque exigiria aplicar SQL e código na ordem certa**, e um deploy de código
   antes da migration derrubaria o agendamento em produção.
2. **`'unsafe-inline'` em `script-src`** — ver item 4.
3. **Rate limiting em memória** — ver item 3.
4. **Contas de teste antigas no banco** (`pentest_*@proton.me`, `nao_existe_xyz@example.com`,
   `pentest_rls_*@example.com`) de auditorias anteriores. Não são minhas e não as removi; convém apagar.
   As que **eu** criei para testar escalação e isolamento foram **todas removidas** (confirmado: `[]`).

---

## Checklist de teste

Script pronto (roda tudo e compara antes/depois):

```bash
# só banco/auth
bash scripts/verify-security.sh

# incluindo headers e CORS
npx next build && npx next start -p 3111 &
APP_URL=http://localhost:3111 bash scripts/verify-security.sh
```

> O teste de enumeração cria uma conta descartável se o cadastro estiver aberto; o script avisa o e-mail
> gerado para você removê-la.

### Comandos individuais

```bash
URL=https://wokeokwhvkghmbxbaxgt.supabase.co
KEY=sb_publishable_oGUCfkyA5Z4XArKO1z_j6w_sCrVCCrm
```

**1. `profiles` sem token — o teste principal**

```bash
curl -s "$URL/rest/v1/profiles?select=*"     -H "apikey: $KEY"   # esperado: 42501 permission denied
curl -s "$URL/rest/v1/profiles?select=email" -H "apikey: $KEY"   # esperado: 42501 permission denied
curl -s "$URL/rest/v1/profiles?select=id,full_name,role" -H "apikey: $KEY"  # 2 linhas da equipe, sem e-mail
```

| | Antes | Depois de aplicar o SQL |
|---|---|---|
| `select=*` | `200` + e-mails da equipe | `permission denied` |
| `select=email` | `200` + 2 e-mails | `permission denied` |
| `select=id,full_name,role` | 2 linhas | 2 linhas (páginas públicas seguem OK) |

**2. Um usuário comum não vê e-mail de terceiros**

```bash
TOK=$(curl -s -X POST "$URL/auth/v1/token?grant_type=password" -H "apikey: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"<cliente>","password":"<senha>"}' | python -c "import json,sys;print(json.load(sys.stdin)['access_token'])")

curl -s "$URL/rest/v1/profiles?select=id,email,role" -H "apikey: $KEY" -H "Authorization: Bearer $TOK"
# esperado: a própria linha + as 2 da equipe; nenhuma linha de outro cliente
```

**3. Role continua imutável pelo próprio usuário** (deve seguir falhando — não é regressão)

```bash
curl -s -X PATCH "$URL/rest/v1/profiles?id=eq.<seu-id>" -H "apikey: $KEY" \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" -d '{"role":"admin"}'
# esperado: 400 P0001 "Apenas administradores podem alterar a role de um usuário."
```

**4. Headers**

```bash
curl -sI https://osanchez-barbearia.vercel.app/ | grep -iE "x-powered-by|content-security|permissions-policy"
# esperado: sem X-Powered-By; CSP e Permissions-Policy presentes
```

**5. CORS**

```bash
curl -sI https://osanchez-barbearia.vercel.app/ -H "Origin: https://evil-attacker.vercel.app" | grep -i access-control-allow-origin
# esperado: nenhuma saída (antes: a origem era refletida)
```

### Não pode quebrar (regressão)

- [ ] Login Google e Facebook seguem funcionando (`/entrar`, `/criar-conta`)
- [ ] `/barbeiros` e `/` mostram os barbeiros **reais** (Enzo com a bio do banco), não o `SEED_BARBERS`
      — verificado localmente após as mudanças de header/CORS ✅
- [ ] `/cliente/agendar` lista os barbeiros pelo nome
- [ ] `/painel/funcionarios` continua exibindo o e-mail dos barbeiros (staff autenticado)
- [ ] `/cliente/perfil` carrega nome, telefone e e-mail do próprio usuário

---

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase_security_profiles_rls.sql` | **novo** — RLS + GRANT de coluna em `profiles` |
| `scripts/verify-security.sh` | **novo** — verificação automatizada |
| `next.config.ts` | `poweredByHeader: false`, CSP completa, Permissions-Policy, HSTS |
| `src/proxy.ts` | **novo** — era `src/middleware.ts` (renomeado no Next 16) + CORS com whitelist |
| `src/middleware.ts` | **removido** — convenção deprecada |
| `src/app/auth/actions.ts` | resposta neutra anti-enumeração + escritas via client de serviço |
