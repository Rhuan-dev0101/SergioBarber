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

/**
 * Create a new barber auth account and populate their tables (Admin only)
 */
export async function createBarberAction(
  fullName: string,
  email: string,
  password: string
): Promise<StaffActionResponse> {
  const isAdmin = await verifyAdminSession()
  if (!isAdmin) return { success: false, message: 'Acesso restrito a administradores.' }

  if (!fullName || !email || !password) {
    return { success: false, message: 'Nome, e-mail e senha são obrigatórios.' }
  }

  if (password.length < 6) {
    return { success: false, message: 'A senha deve conter no mínimo 6 caracteres.' }
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

    // a. Create auth user (auto-confirmed)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (createError || !newUser?.user) {
      console.error('Error creating auth user:', createError)
      return { success: false, message: `Erro ao cadastrar credenciais: ${createError?.message || 'E-mail inválido ou já existe.'}` }
    }

    const barberUserId = newUser.user.id

    // b. update profiles.role to 'barber' and profile.full_name
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        role: 'barber',
        full_name: fullName
      })
      .eq('id', barberUserId)

    if (profileError) {
      console.error('Error updating profile role:', profileError)
      // Attempt cleanup
      await supabaseAdmin.auth.admin.deleteUser(barberUserId)
      return { success: false, message: 'Erro ao configurar perfil de barbeiro.' }
    }

    // d. Insert a row into public.barbers
    const { error: barberError } = await supabaseAdmin
      .from('barbers')
      .insert({
        id: barberUserId,
        is_active: true,
        bio: null
      })

    if (barberError) {
      console.error('Error creating barber record:', barberError)
      // Cleanup
      await supabaseAdmin.auth.admin.deleteUser(barberUserId)
      return { success: false, message: 'Erro ao registrar profissional no banco de dados.' }
    }

    // e. Insert default working hours into barber_working_hours
    const defaultWorkingHours = [
      { barber_id: barberUserId, day_of_week: 0, is_closed: true, slots: [] },
      { barber_id: barberUserId, day_of_week: 1, is_closed: true, slots: [] },
      { barber_id: barberUserId, day_of_week: 2, is_closed: false, slots: [{ start: '10:00', end: '13:00' }, { start: '14:00', end: '20:00' }] },
      { barber_id: barberUserId, day_of_week: 3, is_closed: false, slots: [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '22:00' }] },
      { barber_id: barberUserId, day_of_week: 4, is_closed: false, slots: [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '22:00' }] },
      { barber_id: barberUserId, day_of_week: 5, is_closed: false, slots: [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '22:00' }] },
      { barber_id: barberUserId, day_of_week: 6, is_closed: false, slots: [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '17:00' }] }
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
