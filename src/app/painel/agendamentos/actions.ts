'use server'

import { createServerSupabaseClient } from '@/lib/supabase'
import { getAvailableSlots } from '@/lib/booking'
import { addMinutes } from 'date-fns'

export type ActionResponse = {
  success: boolean
  message: string
}

async function verifyStaffSession() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'barber')) {
    return null
  }
  return { user, role: profile.role }
}

/**
 * Update appointment status (confirmed, completed, cancelled)
 */
export async function updateAppointmentStatusAction(apptId: string, status: string): Promise<ActionResponse> {
  const staff = await verifyStaffSession()
  if (!staff) {
    return { success: false, message: 'Não autorizado.' }
  }

  try {
    const supabase = await createServerSupabaseClient()

    // If barber role, verify this appointment belongs to them (unless they are admin)
    if (staff.role === 'barber') {
      const { data: appt } = await supabase
        .from('appointments')
        .select('barber_id')
        .eq('id', apptId)
        .single()
      
      if (!appt || appt.barber_id !== staff.user.id) {
        return { success: false, message: 'Você só pode gerenciar seus próprios agendamentos.' }
      }
    }

    const { error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', apptId)

    if (error) {
      console.error('Error updating status:', error)
      return { success: false, message: 'Erro ao atualizar status do agendamento.' }
    }

    // Auto-update payment status on completion
    if (status === 'completed') {
      await supabase
        .from('payments')
        .update({ status: 'confirmed_manually' })
        .eq('appointment_id', apptId)
    } else if (status === 'cancelled') {
      await supabase
        .from('payments')
        .update({ status: 'refunded' })
        .eq('appointment_id', apptId)
    }

    return { success: true, message: 'Status atualizado com sucesso.' }
  } catch (err) {
    console.error('Error inside updateAppointmentStatusAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}

/**
 * Update appointment private notes
 */
export async function updateAppointmentNotesAction(apptId: string, notes: string): Promise<ActionResponse> {
  const staff = await verifyStaffSession()
  if (!staff) {
    return { success: false, message: 'Não autorizado.' }
  }

  try {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('appointments')
      .update({ notes: notes || null })
      .eq('id', apptId)

    if (error) {
      console.error('Error updating notes:', error)
      return { success: false, message: 'Erro ao atualizar anotações.' }
    }

    return { success: true, message: 'Anotações salvas com sucesso.' }
  } catch (err) {
    console.error('Error inside updateAppointmentNotesAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}

/**
 * Create a manual walk-in booking by staff/admin.
 */
export async function createWalkInAppointmentAction(
  clientName: string,
  barberId: string,
  serviceId: string,
  dateStr: string,
  timeStr: string,
  notes: string
): Promise<ActionResponse> {
  const staff = await verifyStaffSession()
  if (!staff) {
    return { success: false, message: 'Não autorizado.' }
  }

  if (!clientName || !barberId || !serviceId || !dateStr || !timeStr) {
    return { success: false, message: 'Todos os campos são obrigatórios.' }
  }

  try {
    const supabase = await createServerSupabaseClient()

    // 1. Fetch service info
    const { data: service } = await supabase
      .from('services')
      .select('name, duration, price')
      .eq('id', serviceId)
      .single()

    if (!service) {
      return { success: false, message: 'Serviço selecionado inválido.' }
    }

    // 2. Check availability
    const duration = service.duration
    const availableSlots = await getAvailableSlots(barberId, dateStr, duration)
    if (!availableSlots.includes(timeStr)) {
      return { success: false, message: 'Este horário não está livre para este profissional.' }
    }

    // 3. Construct timestamps
    const startTimeStr = `${dateStr}T${timeStr}:00-03:00`
    const startDate = new Date(startTimeStr)
    const endDate = addMinutes(startDate, duration)

    // 4. Insert appointment (customer_id is null for anonymous walk-ins)
    const formattedNotes = `[Walk-in] Cliente: ${clientName}. ${notes}`
    const { data: appt, error: apptError } = await supabase
      .from('appointments')
      .insert({
        customer_id: null,
        barber_id: barberId,
        service_id: serviceId,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        status: 'confirmed', // immediately confirmed
        notes: formattedNotes
      })
      .select('id')
      .single()

    if (apptError || !appt) {
      console.error('Walk-in insert error:', apptError)
      return { success: false, message: 'Erro ao registrar agendamento presencial.' }
    }

    // 5. Create paid payment record for walk-in
    await supabase
      .from('payments')
      .insert({
        appointment_id: appt.id,
        total_amount: service.price,
        deposit_amount: 0.00,
        status: 'confirmed_manually',
        method: 'cash',
        notes: 'Pagamento presencial registrado no painel'
      })

    return { success: true, message: 'Agendamento presencial registrado com sucesso.' }
  } catch (err) {
    console.error('Error inside createWalkInAppointmentAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}
