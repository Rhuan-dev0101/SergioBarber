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
        // O aceite dos Termos/Privacidade NÃO é mais gravado aqui.
        // Se o usuário ainda não tem registro, ele é enviado para /aceite,
        // onde precisa marcar as duas caixas antes de prosseguir — só assim
        // o registro em legal_acceptances corresponde a uma ação real do
        // titular, e não a uma presunção feita no login.
        const { data: existing } = await supabase
          .from('legal_acceptances')
          .select('id')
          .eq('profile_id', user.id)
          .limit(1)

        if (!existing || existing.length === 0) {
          const aceiteUrl = `${origin}/aceite?redirectTo=${encodeURIComponent(redirectTo)}`
          return NextResponse.redirect(aceiteUrl)
        }
      }
      // Direct user back to their original target page (e.g. /cliente/agendar?barberId=...)
      return NextResponse.redirect(`${origin}${redirectTo}`)
    }
  }

  // Fallback to entrar with error info if OAuth failed
  return NextResponse.redirect(`${origin}/entrar?error=OAuthFail`)
}
