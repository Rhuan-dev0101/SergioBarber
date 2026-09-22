'use server'

import { headers } from 'next/headers'
import { createAdminSupabaseClient } from '@/lib/supabase'

export type CookieConsentInput = {
  visitorId: string
  essential: boolean
  analytics: boolean
  marketing: boolean
}

/**
 * Grava a preferência de cookies com o IP real do visitante.
 *
 * Roda como server action (não como insert direto do cliente) porque o
 * navegador não tem como saber seu próprio IP público — a versão anterior
 * gravava a string literal 'client-side' nesse campo. Usa o client de
 * serviço porque o visitante é sempre anônimo aqui (RLS de escrita anônima
 * em cookie_consents não está no escopo desta correção).
 */
export async function saveCookieConsentAction(input: CookieConsentInput): Promise<{ success: boolean }> {
  // Server Action e' um endpoint HTTP normal, acessivel sem passar pelo
  // CookieBanner -- e grava com o client de servico (bypassa RLS). Sem
  // validar tipo/tamanho, um visitorId gigante ou de tipo errado passaria
  // direto para o banco.
  if (
    typeof input?.visitorId !== 'string' ||
    input.visitorId.length === 0 ||
    input.visitorId.length > 100 ||
    typeof input.essential !== 'boolean' ||
    typeof input.analytics !== 'boolean' ||
    typeof input.marketing !== 'boolean'
  ) {
    return { success: false }
  }

  try {
    const headerList = await headers()
    const ip = headerList.get('x-forwarded-for') || '127.0.0.1'

    const supabase = await createAdminSupabaseClient()
    const { error } = await supabase.from('cookie_consents').insert({
      visitor_id: input.visitorId,
      consented_categories: {
        essential: input.essential,
        analytics: input.analytics,
        marketing: input.marketing,
      },
      ip_address: ip,
    })

    if (error) {
      console.error('Error saving cookie consent:', error.message)
      return { success: false }
    }

    return { success: true }
  } catch (err) {
    console.error('Error inside saveCookieConsentAction:', err)
    return { success: false }
  }
}
