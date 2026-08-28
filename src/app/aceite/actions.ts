'use server'

import { headers } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase'

export type AcceptanceResponse = {
  success: boolean
  message: string
}

/**
 * Registra o aceite real dos Termos de Uso e da Política de Privacidade.
 * Só é chamada a partir da tela /aceite, após o usuário marcar as duas caixas
 * — diferente do fluxo antigo, que gravava o aceite automaticamente no
 * callback do OAuth, sem nenhuma ação do titular.
 */
export async function recordLegalAcceptanceAction(): Promise<AcceptanceResponse> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, message: 'Sessão expirada. Faça login novamente.' }
    }

    // Idempotência: se já existe aceite registrado, não duplica.
    const { data: existing } = await supabase
      .from('legal_acceptances')
      .select('id')
      .eq('profile_id', user.id)
      .limit(1)

    if (existing && existing.length > 0) {
      return { success: true, message: 'Aceite já registrado.' }
    }

    const headerList = await headers()
    const ip = headerList.get('x-forwarded-for') || '127.0.0.1'

    const { error } = await supabase.from('legal_acceptances').insert([
      { profile_id: user.id, document_type: 'terms_of_use', version: '1.0', ip_address: ip },
      { profile_id: user.id, document_type: 'privacy_policy', version: '1.0', ip_address: ip },
    ])

    if (error) {
      console.error('Error recording legal acceptance:', error.message)
      return { success: false, message: 'Erro ao registrar aceite. Tente novamente.' }
    }

    return { success: true, message: 'Aceite registrado com sucesso.' }
  } catch (err) {
    console.error('Error inside recordLegalAcceptanceAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}
