# Performance 2026-11-04 (branch agent/performance-2026-11-04)

Metodo: Supabase **fake** local (porta 55321, latencia simulada de 30 ms, conta chamadas por rota) + `next build` com env dummy. Nenhum banco real foi tocado; `.env` nao lido. Mediana de 5 requisicoes. Bundle = `.next/diagnostics/route-bundle-stats.json` (first-load JS, nao comprimido).

## 1. Resumo
Gargalos: (1) supabase-js (208 KB) no bundle inicial de TODA rota via layout; (2) paginas publicas com ~8 round-trips sequenciais ao Supabase; (3) proxy chamando `auth.getUser()` em toda requisicao (publicas e /api).
Ganho: first-load das rotas publicas 753 -> 504 KB (-33%), home 771 -> 522 KB; home 354 -> 125 ms; auth calls do proxy -50% na amostra.

## 2. Resultados
| Otimizacao | Metrica | Antes | Depois | Ganho | Commit |
|---|---|---|---|---|---|
| proxy so valida sessao em /cliente e /painel | chamadas auth/v1/user (25 req) | 30 | 15 | -50% (1 RTT a menos por req publica/API) | 5b4a80b |
| home em Promise.all + 1 lookup de nomes, reviews sem select('*') | `/` mediana | 354 ms | 125 ms | -65% | 62a2c2a |
| servicos/galeria/barbeiros paralelos | mediana | 121 / 118 / 259 ms | 86 / 63 / 106 ms | -29% / -47% / -59% | d24f847 |
| supabase-js fora do layout (settings.ts dinamico, /api/public-settings, Header condicional por cookie, TutorialModal lazy) | first-load JS `/servicos` | 753 KB | 504 KB | -33% | 106d0b6 |
| idem | `/_not-found` e paginas legais | 712 KB | 466 KB | -35% | 106d0b6 |
| ImageCropModal / ReceiptModal via next/dynamic | `/painel/galeria` / `/painel/financeiro` / `/painel/agendamentos` | 800 / 763 / 871 KB | 778 / 756 / 864 KB | -22 / -7 / -7 KB | 6bce44d |
Soma first-load de todas as rotas: 22024 -> 19783 KB. Build: 55 s (aquecido), sem regressao.
Seguranca (pedido QA): S-1 validacao em /api/booking/slots e S-3 `.maybeSingle()` + erro lancado em booking.ts (598f61a).

## 3. Nao aplicado
- Paginas `/painel/*` e `/cliente/*` ainda buscam tudo no useEffect no client (supabase-js necessario; 740-860 KB). Converter para Server Components + Suspense: ganho alto (~150-250 KB e menos waterfall), esforco alto (paginas de 600-1800 linhas).
- `bulkCheckout` (painel/agendamentos/actions.ts:596) faz 3-4 queries por item em loop: N+1; precisa de RPC/transacao. Ganho proporcional ao tamanho do lote.
- Fonte/imagens: `<img>` em 10 pontos (galeria, avatares); next/image exige configurar dominios/tamanhos. Imagens de /public sao pequenas (maior 170 KB).
- `createClient()` no corpo do componente quebra o prerender de /cliente e /painel/financeiro **somente quando as env vars nao existem no build** (reproduzido sem env); com env nao ha falha. Nao alterado para nao mascarar config ausente.
- Layout ainda carrega CookieBanner e FloatingPackageBubbles em todas as paginas (pequenos).
- `getAvailableSlots` resolve 'sergio-uuid'/'enzo-uuid' com query extra a cada chamada.
- Proxy em /painel ainda faz getUser + select profiles.role por navegacao (cache do papel em cookie assinado reduziria 1 RTT; decisao de seguranca).

## 4. Migrations de indice
Nao medidas (sem banco dev com dados/EXPLAIN). Ja existe `supabase_performance_indexes.sql` na raiz, commitado por outro agente em 1f87852 (nao revisado/medido por mim; nada executado).

## 5. Regressoes / testes
Projeto nao tem testes automatizados nem script de typecheck; `next build` (inclui TypeScript) passa. `eslint` falha com `no-explicit-any` ja existente (nao introduzido). Smoke: /api/public-settings 200; slots invalido 400, valido 200; paginas publicas 200.
Comportamento alterado de proposito: Header nao consulta sessao quando nao ha cookie `sb-*-auth-token`; proxy nao renova token em rotas publicas.

## 6. Decisoes pendentes
- Posso converter as paginas /painel e /cliente para Server Components (ganho ~150-250 KB e menos requests por pagina)?
- Posso trocar `<img>` por next/image (ganho LCP, requer configurar remotePatterns)?
- Posso criar RPC para bulkCheckout (remove N+1)?
- Posso cachear o papel do usuario no proxy (-1 RTT por navegacao no painel)?
- Posso aplicar `supabase_performance_indexes.sql` em dev para medir com EXPLAIN ANALYZE?
