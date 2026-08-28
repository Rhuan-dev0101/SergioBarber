#!/usr/bin/env bash
# =====================================================================
# Verificacao das correcoes de seguranca - OSANCHEZ BARBEARIA
#
# Uso:
#   bash scripts/verify-security.sh                  # so testes de banco
#   APP_URL=http://localhost:3111 bash scripts/verify-security.sh   # + headers
#
# Rode ANTES e DEPOIS de aplicar supabase_security_profiles_rls.sql
# para comparar os resultados.
# =====================================================================

SUPABASE_URL="${SUPABASE_URL:-https://wokeokwhvkghmbxbaxgt.supabase.co}"
ANON_KEY="${ANON_KEY:-sb_publishable_oGUCfkyA5Z4XArKO1z_j6w_sCrVCCrm}"
APP_URL="${APP_URL:-}"

pass() { printf "  [ OK ]   %s\n" "$1"; }
fail() { printf "  [FALHA]  %s\n" "$1"; FAILED=$((FAILED+1)); }
info() { printf "  [info]   %s\n" "$1"; }
FAILED=0

echo "======================================================"
echo " 1. profiles - leitura anonima de PII"
echo "======================================================"

# 1a. select=* sem token deve ser NEGADO (42501 permission denied)
BODY=$(curl -s "$SUPABASE_URL/rest/v1/profiles?select=*" -H "apikey: $ANON_KEY")
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$SUPABASE_URL/rest/v1/profiles?select=*" -H "apikey: $ANON_KEY")
if echo "$BODY" | grep -q "permission denied"; then
  pass "GET /profiles?select=* (anon) -> HTTP $CODE, permission denied"
else
  fail "GET /profiles?select=* (anon) -> HTTP $CODE, retornou dados: $(echo "$BODY" | head -c 120)"
fi

# 1b. a coluna email nao pode ser lida por anon, em nenhuma hipotese
BODY=$(curl -s "$SUPABASE_URL/rest/v1/profiles?select=email" -H "apikey: $ANON_KEY")
if echo "$BODY" | grep -q "permission denied"; then
  pass "GET /profiles?select=email (anon) -> permission denied"
else
  fail "GET /profiles?select=email (anon) -> VAZOU: $(echo "$BODY" | head -c 160)"
fi

# 1c. phone tambem bloqueado
BODY=$(curl -s "$SUPABASE_URL/rest/v1/profiles?select=phone" -H "apikey: $ANON_KEY")
if echo "$BODY" | grep -q "permission denied"; then
  pass "GET /profiles?select=phone (anon) -> permission denied"
else
  fail "GET /profiles?select=phone (anon) -> VAZOU: $(echo "$BODY" | head -c 160)"
fi

# 1d. nome/role da equipe DEVEM continuar legiveis (paginas publicas dependem)
BODY=$(curl -s "$SUPABASE_URL/rest/v1/profiles?select=id,full_name,role" -H "apikey: $ANON_KEY")
if echo "$BODY" | grep -q "full_name"; then
  N=$(echo "$BODY" | grep -o '"id"' | wc -l)
  pass "GET /profiles?select=id,full_name,role (anon) -> $N linha(s) da equipe (esperado: paginas publicas seguem funcionando)"
  if echo "$BODY" | grep -q "customer"; then
    fail "  ...porem apareceu linha com role=customer (nao deveria)"
  fi
else
  info "GET /profiles?select=id,full_name,role -> $(echo "$BODY" | head -c 160)"
fi

echo
echo "======================================================"
echo " 2. Demais tabelas com PII - leitura anonima"
echo "======================================================"
for t in appointments payments client_notes legal_acceptances cookie_consents package_subscriptions recurring_reservations blocked_times days_off; do
  BODY=$(curl -s "$SUPABASE_URL/rest/v1/$t?select=*&limit=5" -H "apikey: $ANON_KEY")
  if [ "$BODY" = "[]" ]; then
    pass "$t -> [] (nenhuma linha exposta)"
  elif echo "$BODY" | grep -q "permission denied\|PGRST"; then
    pass "$t -> negado"
  else
    fail "$t -> EXPOS DADOS: $(echo "$BODY" | head -c 140)"
  fi
done

echo
echo "======================================================"
echo " 3. Config de Auth (cadastro aberto / confirmacao)"
echo "======================================================"
S=$(curl -s "$SUPABASE_URL/auth/v1/settings" -H "apikey: $ANON_KEY")
AUTOCONF=$(echo "$S" | grep -o '"mailer_autoconfirm":[a-z]*' | cut -d: -f2)
DISABLED=$(echo "$S" | grep -o '"disable_signup":[a-z]*' | cut -d: -f2)
if [ "$AUTOCONF" = "false" ]; then
  pass "mailer_autoconfirm = false (e-mail exige confirmacao)"
else
  fail "mailer_autoconfirm = true (cadastro auto-confirmado; ver SECURITY.md item 2)"
fi
info "disable_signup = $DISABLED (deve seguir false para nao quebrar cadastro via Google/Facebook)"

echo
echo "======================================================"
echo " 4. Anti-enumeracao no endpoint de signup"
echo "======================================================"
EXISTING="osanchezbarbearia@gmail.com"
NEW="verify.$RANDOM.$RANDOM@example.com"
R1=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SUPABASE_URL/auth/v1/signup" -H "apikey: $ANON_KEY" \
     -H "Content-Type: application/json" -d "{\"email\":\"$EXISTING\",\"password\":\"Xy9!verify123\"}")
R2=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SUPABASE_URL/auth/v1/signup" -H "apikey: $ANON_KEY" \
     -H "Content-Type: application/json" -d "{\"email\":\"$NEW\",\"password\":\"Xy9!verify123\"}")
if [ "$R1" = "$R2" ]; then
  pass "signup e-mail existente ($R1) == e-mail novo ($R2): indistinguivel"
else
  fail "signup e-mail existente ($R1) != e-mail novo ($R2): permite enumerar contas"
fi
info "ATENCAO: este teste cria a conta $NEW se o cadastro estiver aberto. Remova-a depois."

if [ -n "$APP_URL" ]; then
echo
echo "======================================================"
echo " 5. Headers de seguranca ($APP_URL)"
echo "======================================================"
H=$(curl -sI "$APP_URL/" | tr -d '\r')
echo "$H" | grep -qi "^x-powered-by:" && fail "X-Powered-By ainda presente" || pass "X-Powered-By ausente"
for h in "content-security-policy" "permissions-policy" "x-content-type-options" "referrer-policy" "x-frame-options" "strict-transport-security"; do
  echo "$H" | grep -qi "^$h:" && pass "$h presente" || fail "$h AUSENTE"
done
echo "$H" | grep -qi "frame-ancestors 'none'" && pass "CSP contem frame-ancestors 'none'" || fail "CSP sem frame-ancestors 'none'"

echo
echo " 5b. CORS - whitelist de origens"
for O in "null" "https://evil.com" "https://evil-attacker.vercel.app"; do
  A=$(curl -sI "$APP_URL/" -H "Origin: $O" | tr -d '\r' | grep -i "^access-control-allow-origin:")
  [ -z "$A" ] && pass "Origin $O -> sem ACAO (bloqueado)" || fail "Origin $O -> $A"
done
for O in "http://localhost:3000" "https://osanchez-barbearia.vercel.app"; do
  A=$(curl -sI "$APP_URL/" -H "Origin: $O" | tr -d '\r' | grep -i "^access-control-allow-origin:" | sed 's/.*: //')
  [ "$A" = "$O" ] && pass "Origin $O -> refletido corretamente" || fail "Origin $O -> '$A'"
done
fi

echo
echo "======================================================"
if [ "$FAILED" -eq 0 ]; then
  echo " RESULTADO: todos os testes passaram."
else
  echo " RESULTADO: $FAILED verificacao(oes) falharam."
fi
echo "======================================================"
exit 0
