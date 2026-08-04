import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const redirectTo = searchParams.get('redirectTo') || '/cliente'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    )
    
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const ip = request.headers.get('x-forwarded-for') || '127.0.0.1'
        const { data: existing } = await supabase
          .from('legal_acceptances')
          .select('id')
          .eq('profile_id', user.id)

        if (!existing || existing.length === 0) {
          await supabase.from('legal_acceptances').insert([
            {
              profile_id: user.id,
              document_type: 'terms_of_use',
              version: '1.0',
              ip_address: ip
            },
            {
              profile_id: user.id,
              document_type: 'privacy_policy',
              version: '1.0',
              ip_address: ip
            }
          ])
        }
      }
      // Direct user back to their original target page (e.g. /cliente/agendar?barberId=...)
      return NextResponse.redirect(`${origin}${redirectTo}`)
    }
  }

  // Fallback to entrar with error info if OAuth failed
  return NextResponse.redirect(`${origin}/entrar?error=OAuthFail`)
}
