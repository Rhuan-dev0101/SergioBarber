'use server'

import { createServerSupabaseClient } from '@/lib/supabase'

export type ServiceActionResponse = {
  success: boolean
  message: string
}

async function verifySession() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'barber')) return null
  return profile
}

/**
 * Link an existing catalog service to a barber's profile
 */
export async function addBarberServiceAction(
  barberId: string,
  serviceId: string,
  price: number,
  duration: number
): Promise<ServiceActionResponse> {
  const session = await verifySession()
  if (!session) return { success: false, message: 'Acesso negado.' }

  const targetBarberId = session.role === 'admin' ? barberId : session.id

  if (!targetBarberId || !serviceId || price === undefined || duration === undefined) {
    return { success: false, message: 'Parâmetros inválidos.' }
  }

  try {
    const supabase = await createServerSupabaseClient()
    
    // Check if relationship already exists
    const { data: existing } = await supabase
      .from('barber_services')
      .select('id')
      .eq('barber_id', targetBarberId)
      .eq('service_id', serviceId)
      .single()

    if (existing) {
      return { success: false, message: 'Você já possui esse serviço cadastrado.' }
    }

    const { error } = await supabase
      .from('barber_services')
      .insert({
        barber_id: targetBarberId,
        service_id: serviceId,
        price,
        duration,
        is_active: true
      })

    if (error) {
      console.error('Error inserting barber service:', error)
      return { success: false, message: 'Erro ao vincular serviço.' }
    }

    return { success: true, message: 'Serviço vinculado com sucesso!' }
  } catch (err) {
    console.error('Error inside addBarberServiceAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}

/**
 * Create a new service catalog row and link it to the barber
 */
export async function createAndAddBarberServiceAction(
  barberId: string,
  name: string,
  description: string,
  price: number,
  duration: number
): Promise<ServiceActionResponse> {
  const session = await verifySession()
  if (!session) return { success: false, message: 'Acesso negado.' }

  const targetBarberId = session.role === 'admin' ? barberId : session.id

  if (!targetBarberId || !name || price === undefined || duration === undefined) {
    return { success: false, message: 'Campos obrigatórios ausentes.' }
  }

  try {
    const supabase = await createServerSupabaseClient()

    // Check if service with same name exists (case-insensitive)
    const { data: existingService } = await supabase
      .from('services')
      .select('id, name')
      .ilike('name', name)
      .limit(1)

    let serviceId: string

    if (existingService && existingService.length > 0) {
      serviceId = existingService[0].id
    } else {
      // Create new service row
      const { data: newService, error: serviceError } = await supabase
        .from('services')
        .insert({
          name,
          description: description || null,
          duration,
          price,
          is_active: true
        })
        .select('id')
        .single()

      if (serviceError || !newService) {
        console.error('Error creating catalog service:', serviceError)
        return { success: false, message: 'Erro ao criar serviço no catálogo.' }
      }

      serviceId = newService.id
    }

    // Now insert into barber_services
    const { data: existingRelation } = await supabase
      .from('barber_services')
      .select('id')
      .eq('barber_id', targetBarberId)
      .eq('service_id', serviceId)
      .single()

    if (existingRelation) {
      return { success: false, message: 'Você já possui esse serviço associado ao seu perfil.' }
    }

    const { error: relationError } = await supabase
      .from('barber_services')
      .insert({
        barber_id: targetBarberId,
        service_id: serviceId,
        price,
        duration,
        is_active: true
      })

    if (relationError) {
      console.error('Error creating barber service relationship:', relationError)
      return { success: false, message: 'Erro ao vincular serviço.' }
    }

    return { success: true, message: 'Serviço adicionado com sucesso!' }
  } catch (err) {
    console.error('Error inside createAndAddBarberServiceAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}

/**
 * Update pricing and duration of a barber's service
 */
export async function updateBarberServiceAction(
  id: string,
  price: number,
  duration: number,
  isActive: boolean,
  description?: string | null
): Promise<ServiceActionResponse> {
  const session = await verifySession()
  if (!session) return { success: false, message: 'Acesso negado.' }

  if (!id || price === undefined || duration === undefined) {
    return { success: false, message: 'Campos obrigatórios ausentes.' }
  }

  try {
    const supabase = await createServerSupabaseClient()

    if (session.role === 'barber') {
      const { data: bs } = await supabase
        .from('barber_services')
        .select('barber_id')
        .eq('id', id)
        .single()

      if (!bs || bs.barber_id !== session.id) {
        return { success: false, message: 'Você não tem permissão para alterar este serviço.' }
      }
    }

    const { error } = await supabase
      .from('barber_services')
      .update({
        price,
        duration,
        is_active: isActive,
        description: description !== undefined ? (description?.trim() || null) : undefined
      })
      .eq('id', id)

    if (error) {
      console.error('Error updating barber service:', error)
      return { success: false, message: 'Erro ao atualizar serviço.' }
    }

    return { success: true, message: 'Serviço atualizado com sucesso!' }
  } catch (err) {
    console.error('Error inside updateBarberServiceAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}

/**
 * Remove a service link from a barber's profile
 */
export async function deleteBarberServiceAction(
  id: string
): Promise<ServiceActionResponse> {
  const session = await verifySession()
  if (!session) return { success: false, message: 'Acesso negado.' }

  if (!id) return { success: false, message: 'ID inválido.' }

  try {
    const supabase = await createServerSupabaseClient()

    if (session.role === 'barber') {
      const { data: bs } = await supabase
        .from('barber_services')
        .select('barber_id')
        .eq('id', id)
        .single()

      if (!bs || bs.barber_id !== session.id) {
        return { success: false, message: 'Você não tem permissão para remover este serviço.' }
      }
    }

    const { error } = await supabase
      .from('barber_services')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting barber service:', error)
      return { success: false, message: 'Erro ao remover serviço.' }
    }

    return { success: true, message: 'Serviço removido com sucesso!' }
  } catch (err) {
    console.error('Error inside deleteBarberServiceAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}
