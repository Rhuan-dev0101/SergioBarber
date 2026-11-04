'use server'

import { createServerSupabaseClient } from '@/lib/supabase'
import { getAvailableSlots } from '@/lib/booking'

type ActionResponse = {
  success: boolean
  message: string
}

/**
 * Create a new recurring reservation (weekly or biweekly).
 * Validates slot availability on the start_date before creating.
 */
export async function createRecurringReservationAction(
  barberId: string,
  dayOfWeek: number,
  timeSlot: string,
  intervalWeeks: number,
  startDate: string,
  customerId?: string | null,
  customerName?: string | null
): Promise<ActionResponse> {
  if (!barberId || dayOfWeek === undefined || !timeSlot || !intervalWeeks || !startDate) {
    return { success: false, message: 'Todos os campos são obrigatórios.' }
  }

  if (!customerId && !customerName) {
    return { success: false, message: 'Selecione um cliente ou informe o nome.' }
  }

  if (intervalWeeks !== 1 && intervalWeeks !== 2) {
    return { success: false, message: 'Intervalo deve ser semanal (1) ou quinzenal (2).' }
  }

  try {
    const supabase = await createServerSupabaseClient()

    // Auth check — must be admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, message: 'Sessão expirada.' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (!profile || profile.role !== 'admin') {
      return { success: false, message: 'Acesso negado.' }
    }

    // Validate that the start_date day of week matches
    const [year, month, day] = startDate.split('-').map(Number)
    const dateObj = new Date(year, month - 1, day)
    if (dateObj.getDay() !== dayOfWeek) {
      return { success: false, message: 'A data de início não corresponde ao dia da semana selecionado.' }
    }

    // Check slot availability on start date (using 60 min duration)
    const availableSlots = await getAvailableSlots(barberId, startDate, 60)
    if (!availableSlots.includes(timeSlot)) {
      return { success: false, message: `O horário ${timeSlot} não está disponível na data de início ${startDate}. Escolha outro horário ou data.` }
    }

    // Check for duplicate active reservation (same barber, day, time)
    const { data: existing } = await supabase
      .from('recurring_reservations')
      .select('id')
      .eq('barber_id', barberId)
      .eq('day_of_week', dayOfWeek)
      .eq('time_slot', timeSlot)
      .eq('status', 'active')

    if (existing && existing.length > 0) {
      return { success: false, message: 'Já existe uma reserva recorrente ativa para este barbeiro neste dia e horário.' }
    }

    // Insert reservation
    const { error: insertErr } = await supabase
      .from('recurring_reservations')
      .insert({
        customer_id: customerId || null,
        customer_name: customerId ? null : customerName,
        barber_id: barberId,
        day_of_week: dayOfWeek,
        time_slot: timeSlot,
        interval_weeks: intervalWeeks,
        start_date: startDate,
        status: 'active',
        created_by: user.id
      })

    if (insertErr) {
      console.error('Error creating recurring reservation:', insertErr)
      return { success: false, message: 'Erro ao criar reserva recorrente.' }
    }

    return { success: true, message: 'Reserva recorrente criada com sucesso!' }
  } catch (err) {
    console.error('Error in createRecurringReservationAction:', err)
    return { success: false, message: 'Não foi possível concluir a operação. Tente novamente em instantes.' }
  }
}

/**
 * Cancel (soft-delete) a recurring reservation by setting status = 'cancelled'.
 */
export async function cancelRecurringReservationAction(reservationId: string): Promise<ActionResponse> {
  if (!reservationId) return { success: false, message: 'ID da reserva é obrigatório.' }

  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, message: 'Sessão expirada.' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (!profile || profile.role !== 'admin') {
      return { success: false, message: 'Acesso negado.' }
    }

    const { error } = await supabase
      .from('recurring_reservations')
      .update({ status: 'cancelled' })
      .eq('id', reservationId)

    if (error) {
      console.error('Error cancelling recurring reservation:', error)
      return { success: false, message: 'Erro ao cancelar reserva.' }
    }

    return { success: true, message: 'Reserva recorrente cancelada com sucesso.' }
  } catch (err) {
    console.error('Error in cancelRecurringReservationAction:', err)
    return { success: false, message: 'Não foi possível concluir a operação. Tente novamente em instantes.' }
  }
}

/**
 * List all recurring reservations with customer/barber names.
 */
export async function getRecurringReservationsAction(): Promise<{
  success: boolean
  message: string
  reservations: any[]
}> {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, message: 'Sessão expirada.', reservations: [] }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (!profile || profile.role !== 'admin') {
      return { success: false, message: 'Acesso negado.', reservations: [] }
    }

    // Fetch reservations — join barber profile names
    const { data: reservations, error } = await supabase
      .from('recurring_reservations')
      .select(`
        id, customer_id, customer_name, barber_id, day_of_week, 
        time_slot, interval_weeks, start_date, status, created_at
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching recurring reservations:', error)
      return { success: false, message: 'Erro ao buscar reservas.', reservations: [] }
    }

    // Enrich with barber and customer names
    const enriched = []
    for (const res of reservations || []) {
      let barberName = 'Desconhecido'
      let customerDisplayName = res.customer_name || 'Sem nome'

      // Fetch barber name
      const { data: barberProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', res.barber_id)
        .single()
      if (barberProfile) barberName = barberProfile.full_name

      // Fetch customer name (if registered)
      if (res.customer_id) {
        const { data: customerProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', res.customer_id)
          .single()
        if (customerProfile) customerDisplayName = customerProfile.full_name
      }

      enriched.push({
        ...res,
        barber_name: barberName,
        customer_display_name: customerDisplayName
      })
    }

    return { success: true, message: 'Sucesso', reservations: enriched }
  } catch (err) {
    console.error('Error in getRecurringReservationsAction:', err)
    return { success: false, message: 'Não foi possível concluir a operação. Tente novamente em instantes.', reservations: [] }
  }
}
