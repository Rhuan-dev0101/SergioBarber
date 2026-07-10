'use server'

import { createServerSupabaseClient } from '@/lib/supabase'

export type ConfigActionResponse = {
  success: boolean
  message: string
}

async function verifyAdminSession() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile && profile.role === 'admin'
}

/**
 * Save business settings configurations (Pix key, WhatsApp, Address, etc.)
 */
export async function updateBusinessSettingsAction(
  key: string,
  value: Record<string, any>
): Promise<ConfigActionResponse> {
  const isAdmin = await verifyAdminSession()
  if (!isAdmin) return { success: false, message: 'Acesso restrito a administradores.' }

  if (!key || !value) {
    return { success: false, message: 'Parâmetros inválidos.' }
  }

  try {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('business_settings')
      .upsert({
        key,
        value,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      })

    if (error) {
      console.error('Error saving config settings:', error)
      return { success: false, message: 'Erro ao salvar configurações no banco de dados.' }
    }

    return { success: true, message: 'Configurações atualizadas com sucesso!' }
  } catch (err) {
    console.error('Error inside updateBusinessSettingsAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}
