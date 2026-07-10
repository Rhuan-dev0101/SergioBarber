'use server'

import { createServerSupabaseClient } from '@/lib/supabase'

export type ServiceActionResponse = {
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
 * Create a new service
 */
export async function createServiceAction(
  name: string,
  description: string,
  duration: number,
  price: number
): Promise<ServiceActionResponse> {
  const isAdmin = await verifyAdminSession()
  if (!isAdmin) return { success: false, message: 'Acesso restrito a administradores.' }

  if (!name || !duration || !price) {
    return { success: false, message: 'Nome, duração e preço são obrigatórios.' }
  }

  try {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('services')
      .insert({
        name,
        description: description || null,
        duration,
        price,
        is_active: true
      })

    if (error) {
      console.error('Error inserting service:', error)
      return { success: false, message: 'Erro ao criar serviço no banco de dados.' }
    }

    return { success: true, message: 'Serviço criado com sucesso!' }
  } catch (err) {
    console.error('Error inside createServiceAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}

/**
 * Update an existing service
 */
export async function updateServiceAction(
  serviceId: string,
  name: string,
  description: string,
  duration: number,
  price: number
): Promise<ServiceActionResponse> {
  const isAdmin = await verifyAdminSession()
  if (!isAdmin) return { success: false, message: 'Acesso restrito a administradores.' }

  if (!serviceId || !name || !duration || !price) {
    return { success: false, message: 'Todos os campos obrigatórios devem ser preenchidos.' }
  }

  try {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('services')
      .update({
        name,
        description: description || null,
        duration,
        price
      })
      .eq('id', serviceId)

    if (error) {
      console.error('Error updating service:', error)
      return { success: false, message: 'Erro ao atualizar dados do serviço.' }
    }

    return { success: true, message: 'Serviço atualizado com sucesso!' }
  } catch (err) {
    console.error('Error inside updateServiceAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}

/**
 * Toggle service active status
 */
export async function toggleServiceStatusAction(
  serviceId: string,
  isActive: boolean
): Promise<ServiceActionResponse> {
  const isAdmin = await verifyAdminSession()
  if (!isAdmin) return { success: false, message: 'Acesso restrito a administradores.' }

  try {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('services')
      .update({ is_active: isActive })
      .eq('id', serviceId)

    if (error) {
      console.error('Error toggling service status:', error)
      return { success: false, message: 'Erro ao alterar atividade do serviço.' }
    }

    return { success: true, message: 'Status do serviço atualizado!' }
  } catch (err) {
    console.error('Error inside toggleServiceStatusAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}
