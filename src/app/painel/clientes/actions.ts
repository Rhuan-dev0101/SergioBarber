'use server'

import { createServerSupabaseClient } from '@/lib/supabase'

export type ClientActionResponse = {
  success: boolean
  message: string
}

/**
 * Server Action to update private notes of a customer profile.
 */
export async function updateCustomerPrivateNotesAction(
  customerId: string,
  notes: string
): Promise<ClientActionResponse> {
  if (!customerId) {
    return { success: false, message: 'ID de cliente inválido.' }
  }

  try {
    const supabase = await createServerSupabaseClient()
    
    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, message: 'Sessão expirada. Faça login novamente.' }
    }

    // 2. Authorize (admin or barber role check)
    const { data: staffProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!staffProfile || (staffProfile.role !== 'admin' && staffProfile.role !== 'barber')) {
      return { success: false, message: 'Não autorizado.' }
    }

    // 3. Insert private note
    const { error } = await supabase
      .from('client_notes')
      .insert({
        profile_id: customerId,
        note: notes || '',
        created_by: user.id
      })

    if (error) {
      console.error('Error updating customer notes:', error)
      return { 
        success: false, 
        message: 'Erro ao salvar anotações na tabela client_notes.' 
      }
    }

    return { success: true, message: 'Anotações salvas com sucesso!' }
  } catch (err) {
    console.error('Error inside updateCustomerPrivateNotesAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}
