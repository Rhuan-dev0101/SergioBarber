import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Create the Supabase client in the middleware to update the token
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

  // Get the authenticated user.
  // Note: getUser() is secure and does a roundtrip validation.
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Gating Customer Area
  if (pathname.startsWith('/cliente')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/entrar'
      url.searchParams.set('redirectTo', pathname + request.nextUrl.search)
      return NextResponse.redirect(url)
    }
  }

  // Gating Admin Dashboard
  if (pathname.startsWith('/painel')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/entrar'
      url.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(url)
    }

    // Read the profile role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'barber')) {
      // Redirect to customer panel if role is not staff/admin
      const url = request.nextUrl.clone()
      url.pathname = '/cliente'
      return NextResponse.redirect(url)
    }
  }

  // CORS Policy (non-wildcard reflection)
  const origin = request.headers.get('origin')
  const allowedOrigins = ['http://localhost:3000', 'https://osanchez-barbearia.vercel.app']
  if (origin) {
    if (allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin)
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      response.headers.set('Access-Control-Allow-Credentials', 'true')
    } else {
      // Explicitly reject if not allowed, or set to null
      response.headers.set('Access-Control-Allow-Origin', 'null')
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - all images/assets (.png, .jpg, .webp, .svg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
