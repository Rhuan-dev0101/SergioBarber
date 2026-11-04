import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Configuracoes publicas usadas por Footer e FloatingPackageBubbles. Servir daqui
// evita carregar o supabase-js no bundle inicial de todas as rotas e permite cache.
export const revalidate = 300

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const { data } = await supabase
    .from('business_settings')
    .select('value')
    .eq('key', 'general_settings')
    .maybeSingle()

  const v = (data?.value ?? {}) as Record<string, unknown>
  // Somente campos publicos (o registro tambem guarda dados de Pix).
  const pick = (k: string) => (typeof v[k] === 'string' ? (v[k] as string) : undefined)

  return NextResponse.json(
    {
      whatsapp: pick('whatsapp'),
      address: pick('address'),
      instagram: pick('instagram'),
      tutorial_video_desktop_url: pick('tutorial_video_desktop_url'),
      tutorial_video_mobile_url: pick('tutorial_video_mobile_url'),
    },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
  )
}
