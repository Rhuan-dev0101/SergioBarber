import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Origens explicitamente permitidas para requisicoes cross-origin.
// A versao anterior aceitava qualquer `*.vercel.app`, o que liberava
// qualquer deploy de terceiros na Vercel a falar com esta API.
const STATIC_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://sergio-barber.vercel.app',
  process.env.NEXT_PUBLIC_SITE_URL,
].filter((o): o is string => Boolean(o))

// Deploys de preview DESTE projeto (ex.: sergio-barber-git-main-x.vercel.app).
// Ancorado no nome do projeto para nao aceitar *.vercel.app de outra conta.
// Nota: 'osanchez-barbearia' era o nome anterior do projeto na Vercel; hoje
// esse subdominio nao pertence a este deploy (responde 404), entao foi
// removido daqui para nao deixar uma allowlist credenciada apontando para
// um dominio que qualquer pessoa pode reivindicar no futuro.
const PREVIEW_ORIGIN = /^https:\/\/sergio-barber[a-z0-9-]*\.vercel\.app$/

function isAllowedOrigin(origin: string | null): origin is string {
  // `origin === 'null'` (iframe sandbox, arquivo local, redirect cross-site)
  // nunca pode ser refletido: qualquer pagina consegue se apresentar assim.
  if (!origin || origin === 'null') return false
  return STATIC_ALLOWED_ORIGINS.includes(origin) || PREVIEW_ORIGIN.test(origin)
}

function applyCors(response: NextResponse, origin: string | null) {
  // Vary: Origin evita que um cache sirva a resposta de uma origem para outra.
  response.headers.set('Vary', 'Origin')

  if (!isAllowedOrigin(origin)) {
    // Origem desconhecida: simplesmente NAO enviamos os headers de CORS.
    // Omitir e' o que faz o browser bloquear; enviar 'null' era pior que
    // nao enviar nada, pois 'null' e' uma origem que o atacante controla.
    return response
  }

  response.headers.set('Access-Control-Allow-Origin', origin)
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  response.headers.set('Access-Control-Max-Age', '86400')
  return response
}

export async function proxy(request: NextRequest) {
  const origin = request.headers.get('origin')

  // Preflight: responde antes de qualquer trabalho de sessao/banco.
  if (request.method === 'OPTIONS') {
    return applyCors(new NextResponse(null, { status: 204 }), origin)
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Cria o client Supabase aqui para renovar o token de sessao.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() valida o token no servidor de auth (nao confia no cookie).
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Area do cliente
  if (pathname.startsWith('/cliente')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/entrar'
      url.searchParams.set('redirectTo', pathname + request.nextUrl.search)
      return applyCors(NextResponse.redirect(url), origin)
    }
  }

  // Painel administrativo
  //
  // Esta checagem e' uma barreira "otimista" de UX: ela evita que um cliente
  // caia numa tela vazia do painel. A autorizacao real de dados continua
  // sendo o RLS do Postgres -- ver supabase_security_profiles_rls.sql.
  if (pathname.startsWith('/painel')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/entrar'
      url.searchParams.set('redirectTo', pathname)
      return applyCors(NextResponse.redirect(url), origin)
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'barber')) {
      const url = request.nextUrl.clone()
      url.pathname = '/cliente'
      return applyCors(NextResponse.redirect(url), origin)
    }
  }

  return applyCors(response, origin)
}

export const config = {
  matcher: [
    /*
     * Todas as rotas, exceto:
     * - _next/static (arquivos estaticos)
     * - _next/image (otimizacao de imagens)
     * - favicon.ico
     * - imagens/assets (.png, .jpg, .webp, .svg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
