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
  slots: Array<{ start: string; end: string }>,
  lunchBreakStart?: string | null
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
        slots: slots,
        lunch_break_start: lunchBreakStart || null
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
        reason: reason || 'Bloqueio manual'
      })

    if (error) {
      console.error('Error inserting blocked time:', error)
      return { success: false, message: 'Erro ao bloquear horário.' }
    }

    return { success: true, message: 'Horário bloqueado com sucesso!' }
  } catch (err) {
    console.error('Error inside addBlockedTimeAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}

/**
 * Delete Blocked Time
 */
export async function deleteBlockedTimeAction(
  id: string,
  barberId: string
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
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting blocked time:', error)
      return { success: false, message: 'Erro ao remover bloqueio.' }
    }

    return { success: true, message: 'Bloqueio removido com sucesso!' }
  } catch (err) {
    console.error('Error inside deleteBlockedTimeAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}

/**
 * Add a Day Off / Vacation Day
 */
export async function addDayOffAction(
  barberId: string,
  dateStr: string, // YYYY-MM-DD
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
        reason: reason || 'Folga'
      })

    if (error) {
      console.error('Error inserting day off:', error)
      return { success: false, message: 'Erro ao adicionar folga.' }
    }

    return { success: true, message: 'Folga registrada com sucesso!' }
  } catch (err) {
    console.error('Error inside addDayOffAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}

/**
 * Delete Day Off
 */
export async function deleteDayOffAction(
  id: string,
  barberId: string
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
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting day off:', error)
      return { success: false, message: 'Erro ao remover folga.' }
    }

    return { success: true, message: 'Folga removida com sucesso!' }
  } catch (err) {
    console.error('Error inside deleteDayOffAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}

/**
 * Create a new barber auth account and populate their tables (Admin only)
 */
export async function createBarberAction(
  fullName: string,
  email: string,
  password: string
): Promise<StaffActionResponse> {
  const admin = await verifyAdminSession()
  if (!admin) {
    return { success: false, message: 'Acesso não autorizado. Apenas administradores podem cadastrar profissionais.' }
  }

  try {
    const { createClient: createBaseClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createBaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // a. Create user in Supabase Auth via admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    })

    if (authError || !authData.user) {
      console.error('Error creating auth user:', authError)
      return { success: false, message: `Erro ao criar conta de usuário: ${authError?.message}` }
    }

    const barberUserId = authData.user.id

    // b. Insert profile with role='barber'
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: barberUserId,
        full_name: fullName,
        role: 'barber'
      })

    if (profileError) {
      console.error('Error inserting profile:', profileError)
      // Cleanup auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(barberUserId)
      return { success: false, message: 'Erro ao registrar perfil do funcionário.' }
    }

    // c. Insert barber row linked to profile
    const { error: barberError } = await supabaseAdmin
      .from('barbers')
      .insert({
        id: barberUserId,
        is_active: true
      })

    if (barberError) {
      console.error('Error creating barber record:', barberError)
      // Cleanup
      await supabaseAdmin.auth.admin.deleteUser(barberUserId)
      return { success: false, message: 'Erro ao registrar profissional no banco de dados.' }
    }

    // e. Insert default working hours into barber_working_hours
    const defaultWorkingHours = [
      { barber_id: barberUserId, day_of_week: 0, is_closed: true, slots: [], lunch_break_start: null },
      { barber_id: barberUserId, day_of_week: 1, is_closed: true, slots: [], lunch_break_start: null },
      { barber_id: barberUserId, day_of_week: 2, is_closed: false, slots: [{ start: '10:00', end: '20:00' }], lunch_break_start: '13:00' },
      { barber_id: barberUserId, day_of_week: 3, is_closed: false, slots: [{ start: '09:00', end: '22:00' }], lunch_break_start: '13:00' },
      { barber_id: barberUserId, day_of_week: 4, is_closed: false, slots: [{ start: '09:00', end: '22:00' }], lunch_break_start: '13:00' },
      { barber_id: barberUserId, day_of_week: 5, is_closed: false, slots: [{ start: '09:00', end: '22:00' }], lunch_break_start: '13:00' },
      { barber_id: barberUserId, day_of_week: 6, is_closed: false, slots: [{ start: '09:00', end: '17:00' }], lunch_break_start: '13:00' }
    ]

    const { error: hoursError } = await supabaseAdmin
      .from('barber_working_hours')
      .insert(defaultWorkingHours)

    if (hoursError) {
      console.error('Error inserting default working hours:', hoursError)
    }

    return { success: true, message: 'Funcionário cadastrado com sucesso!' }
  } catch (err) {
    console.error('Error inside createBarberAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}

/**
 * Server Action to delete a barber profile and auth account (Admin only)
 */
export async function deleteBarberAction(barberId: string): Promise<StaffActionResponse> {
  if (!barberId) {
    return { success: false, message: 'ID de funcionário inválido.' }
  }

  const isAdmin = await verifyAdminSession()
  if (!isAdmin) {
    return { success: false, message: 'Acesso restrito a administradores. Apenas administradores podem excluir funcionários.' }
  }

  try {
    const { createClient: createBaseClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createBaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Delete the auth user (this will cascade delete everything linked to this user's ID)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(barberId)

    if (deleteError) {
      console.error('Error deleting user via admin API:', deleteError)
      return { success: false, message: `Erro ao deletar usuário: ${deleteError.message}` }
    }

    return { success: true, message: 'Funcionário excluído com sucesso!' }
  } catch (err) {
    console.error('Error inside deleteBarberAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}
