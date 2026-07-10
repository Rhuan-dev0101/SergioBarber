'use server'

import { createServerSupabaseClient } from '@/lib/supabase'

export type StaffActionResponse = {
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
 * Toggle barber active status
 */
export async function updateBarberStatusAction(
  barberId: string,
  isActive: boolean
): Promise<StaffActionResponse> {
  const isAdmin = await verifyAdminSession()
  if (!isAdmin) return { success: false, message: 'Acesso restrito a administradores.' }

  try {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('barbers')
      .update({ is_active: isActive })
      .eq('id', barberId)

    if (error) {
      console.error('Error updating barber status:', error)
      return { success: false, message: 'Erro ao alterar status do funcionário.' }
    }

    return { success: true, message: 'Status do profissional atualizado com sucesso.' }
  } catch (err) {
    console.error('Error inside updateBarberStatusAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}

/**
 * Update working hours schedule for a barber and day of week
 */
export async function updateBarberWorkingHoursAction(
  barberId: string,
  dayOfWeek: number,
  isClosed: boolean,
  slots: Array<{ start: string; end: string }>
): Promise<StaffActionResponse> {
  const supabase = await createServerSupabaseClient()
  
  // Authorize: admin can update any, barber can update their own
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Não autenticado.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isSelf = user.id === barberId
  const isAdmin = profile && profile.role === 'admin'

  if (!isAdmin && !isSelf) {
    return { success: false, message: 'Não autorizado.' }
  }

  try {
    const { error } = await supabase
      .from('barber_working_hours')
      .upsert({
        barber_id: barberId,
        day_of_week: dayOfWeek,
        is_closed: isClosed,
        slots: slots
      }, {
        onConflict: 'barber_id,day_of_week'
      })

    if (error) {
      console.error('Error upserting working hours:', error)
      return { success: false, message: 'Erro ao salvar os horários de trabalho.' }
    }

    return { success: true, message: 'Grade de horários atualizada com sucesso.' }
  } catch (err) {
    console.error('Error inside updateBarberWorkingHoursAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}

/**
 * Add Blocked Time (lunch break, custom pause)
 */
export async function addBlockedTimeAction(
  barberId: string,
  startTimeStr: string, // ISO format
  endTimeStr: string, // ISO format
  reason: string
): Promise<StaffActionResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Não autenticado.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isSelf = user.id === barberId
  const isAdmin = profile && profile.role === 'admin'

  if (!isAdmin && !isSelf) {
    return { success: false, message: 'Não autorizado.' }
  }

  try {
    const { error } = await supabase
      .from('blocked_times')
      .insert({
        barber_id: barberId,
        start_time: startTimeStr,
        end_time: endTimeStr,
        reason: reason || null
      })

    if (error) {
      console.error('Error inserting blocked time:', error)
      return { success: false, message: 'Erro ao agendar bloqueio.' }
    }

    return { success: true, message: 'Bloqueio de agenda criado com sucesso.' }
  } catch (err) {
    console.error('Error inside addBlockedTimeAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}

/**
 * Add a Day Off / Vacation Day
 */
export async function addDayOffAction(
  barberId: string,
  dateStr: string, // yyyy-mm-dd
  reason: string
): Promise<StaffActionResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Não autenticado.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isSelf = user.id === barberId
  const isAdmin = profile && profile.role === 'admin'

  if (!isAdmin && !isSelf) {
    return { success: false, message: 'Não autorizado.' }
  }

  try {
    const { error } = await supabase
      .from('days_off')
      .insert({
        barber_id: barberId,
        date: dateStr,
        reason: reason || null
      })

    if (error) {
      console.error('Error inserting day off:', error)
      return { success: false, message: 'Erro ao salvar folga (certifique-se de não haver duplicados para o mesmo dia).' }
    }

    return { success: true, message: 'Folga/Férias registrada com sucesso.' }
  } catch (err) {
    console.error('Error inside addDayOffAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}
