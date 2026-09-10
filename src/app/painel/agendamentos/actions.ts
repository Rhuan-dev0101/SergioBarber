'use server'

import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase'
import { getAvailableSlots } from '@/lib/booking'
import { addMinutes } from 'date-fns'
import { resolveNoShowFeeForCustomer } from '@/lib/no-show'

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

      // Resolve outstanding no-show fee when appointment is completed
      const { data: completedAppt } = await supabase
        .from('appointments')
        .select('customer_id')
        .eq('id', apptId)
        .single()

      if (completedAppt?.customer_id) {
        await resolveNoShowFeeForCustomer(completedAppt.customer_id)
      }
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
 * Mark an appointment as no-show.
 * Only allowed for cash/card (presencial) payment methods — Pix no-shows
 * already forfeit the deposit so no additional fee is needed.
 */
export async function markNoShowAction(apptId: string): Promise<ActionResponse> {
  const staff = await verifyStaffSession()
  if (!staff) {
    return { success: false, message: 'Não autorizado.' }
  }

  try {
    const supabase = await createServerSupabaseClient()

    // Fetch appointment + payment method
    const { data: appt } = await supabase
      .from('appointments')
      .select('id, barber_id, status, payments (method)')
      .eq('id', apptId)
      .single()

    if (!appt) {
      return { success: false, message: 'Agendamento não encontrado.' }
    }

    // Barber can only mark their own appointments
    if (staff.role === 'barber' && appt.barber_id !== staff.user.id) {
      return { success: false, message: 'Você só pode gerenciar seus próprios agendamentos.' }
    }

    // Check payment method — only cash/card allowed
    const payment = Array.isArray(appt.payments) ? appt.payments[0] : appt.payments
    const payMethod = (payment as any)?.method
    if (payMethod === 'pix') {
      return { success: false, message: 'Agendamentos com Pix já perdem o sinal — não é necessário marcar como no-show.' }
    }

    // Don't allow marking already completed/cancelled/no_show
    if (appt.status === 'completed' || appt.status === 'cancelled' || appt.status === 'no_show') {
      return { success: false, message: 'Este agendamento já foi finalizado e não pode ser marcado como no-show.' }
    }

    // Update appointment
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'no_show', no_show: true })
      .eq('id', apptId)

    if (error) {
      console.error('Error marking no-show:', error)
      return { success: false, message: 'Erro ao marcar como não compareceu.' }
    }

    return { success: true, message: 'Agendamento marcado como não compareceu. Taxa de 50% será aplicada no próximo agendamento do cliente.' }
  } catch (err) {
    console.error('Error inside markNoShowAction:', err)
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
  notes: string,
  paymentMethod: string = 'cash',
  customerId?: string | null
): Promise<ActionResponse> {
  const staff = await verifyStaffSession()
  if (!staff) {
    return { success: false, message: 'Não autorizado.' }
  }

  if (staff.role === 'barber' && barberId !== staff.user.id) {
    return { success: false, message: 'Barbeiros só podem registrar agendamentos para si mesmos.' }
  }

  if (!clientName || !barberId || !serviceId || !dateStr || !timeStr) {
    return { success: false, message: 'Todos os campos são obrigatórios.' }
  }

  try {
    const adminDb = await createAdminSupabaseClient()

    // 1. Fetch service info
    const { data: service } = await adminDb
      .from('services')
      .select('name, duration, price')
      .eq('id', serviceId)
      .single()

    if (!service) {
      return { success: false, message: 'Serviço selecionado inválido.' }
    }

    // 2. Check availability (allow past dates/times for staff logging)
    const duration = service.duration
    const availableSlots = await getAvailableSlots(barberId, dateStr, duration, true)
    if (!availableSlots.includes(timeStr)) {
      return { success: false, message: 'Este horário não está livre para este profissional.' }
    }

    // 3. Construct timestamps
    const startTimeStr = `${dateStr}T${timeStr}:00-03:00`
    const startDate = new Date(startTimeStr)
    const endDate = addMinutes(startDate, duration)

    // 4. Insert appointment directly as 'confirmed'
    const formattedNotes = customerId ? (notes || '') : `[Walk-in] Cliente: ${clientName}. ${notes || ''}`
    
    let appt: { id: string } | null = null
    let apptError: any = null

    const res = await adminDb
      .from('appointments')
      .insert({
        customer_id: customerId || null,
        barber_id: barberId,
        service_id: serviceId,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        status: 'confirmed',
        notes: formattedNotes
      })
      .select('id')
      .single()

    if (res.data?.id) {
      appt = res.data
    } else {
      apptError = res.error
      const { data: fallbackList } = await adminDb
        .from('appointments')
        .select('id')
        .eq('barber_id', barberId)
        .eq('start_time', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)

      if (fallbackList && fallbackList.length > 0) {
        appt = fallbackList[0]
        apptError = null
      }
    }

    if (apptError || !appt) {
      console.error('Walk-in insert error:', apptError)
      return { success: false, message: 'Erro ao registrar agendamento presencial.' }
    }

    // 5. Create payment record for walk-in (no deposit calculated, initial status pending for in-person collection)
    await adminDb
      .from('payments')
      .insert({
        appointment_id: appt.id,
        total_amount: service.price,
        deposit_amount: 0.00,
        status: 'pending',
        method: paymentMethod || 'cash',
        notes: 'Pagamento presencial (Walk-in) registrado no painel'
      })

    return { success: true, message: 'Agendamento presencial registrado com sucesso.' }
  } catch (err) {
    console.error('Error inside createWalkInAppointmentAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}

/**
 * Create an "Atendimento Extra" (off-schedule / exception appointment).
 * This flow COMPLETELY SKIPS availability validation (working hours, lunch break, days off, and past date checks).
 * It is intended for walk-ins accepted outside normal hours OR retroactively logging forgotten past appointments.
 */
export async function createExtraAppointmentAction(
  clientName: string,
  barberId: string,
  serviceId: string,
  dateStr: string,
  timeStr: string,
  notes: string,
  paymentMethod: string = 'cash',
  isPaid: boolean = true,
  price: number | null = null,
  customerId?: string | null
): Promise<ActionResponse> {
  const staff = await verifyStaffSession()
  if (!staff) {
    return { success: false, message: 'Não autorizado.' }
  }

  // Barber role can only create for themselves
  if (staff.role === 'barber' && barberId !== staff.user.id) {
    return { success: false, message: 'Barbeiros só podem registrar atendimentos para si mesmos.' }
  }

  if (!clientName || !barberId || !serviceId || !dateStr || !timeStr) {
    return { success: false, message: 'Todos os campos obrigatórios devem ser preenchidos.' }
  }

  try {
    const adminDb = await createAdminSupabaseClient()

    // 1. Fetch service info (for duration and default price)
    const { data: service } = await adminDb
      .from('services')
      .select('name, duration, price')
      .eq('id', serviceId)
      .single()

    if (!service) {
      return { success: false, message: 'Serviço selecionado inválido.' }
    }

    // 2. NO AVAILABILITY CHECK — this is the key difference from createWalkInAppointmentAction
    // Atendimento Extra explicitly bypasses working hours, lunch breaks, and days off.

    // 3. Construct timestamps
    const startTimeStr = `${dateStr}T${timeStr}:00-03:00`
    const startDate = new Date(startTimeStr)
    const endDate = addMinutes(startDate, service.duration)

    // 4. Determine final price (use override if provided, otherwise service default)
    const finalPrice = (price !== null && price >= 0) ? price : service.price

    // 5. Insert appointment with is_extra = true
    const formattedNotes = customerId
      ? `[Atendimento Extra] ${notes || ''}`
      : `[Atendimento Extra] Cliente: ${clientName}. ${notes || ''}`

    const appointmentStatus = isPaid ? 'completed' : 'confirmed'

    let appt: { id: string } | null = null
    let apptError: any = null

    const insertPayload: any = {
      customer_id: customerId || null,
      barber_id: barberId,
      service_id: serviceId,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      status: appointmentStatus,
      notes: formattedNotes,
      is_extra: true
    }

    // Try inserting with is_extra first
    const res1 = await adminDb
      .from('appointments')
      .insert(insertPayload)
      .select('id')
      .single()

    if (res1.data?.id) {
      appt = res1.data
    } else if (res1.error && (res1.error.code === '42703' || res1.error.message?.includes('is_extra'))) {
      // Column is_extra does not exist in DB schema, retry without it
      delete insertPayload.is_extra
      const res2 = await adminDb
        .from('appointments')
        .insert(insertPayload)
        .select('id')
        .single()
      if (res2.data?.id) {
        appt = res2.data
      } else {
        apptError = res2.error
      }
    } else {
      apptError = res1.error
    }

    // Fallback: If insert completed in DB but .single() was blocked by RLS/PostgREST
    if (!appt) {
      const query = adminDb
        .from('appointments')
        .select('id')
        .eq('barber_id', barberId)
        .eq('start_time', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)

      const { data: fallbackList } = await query
      if (fallbackList && fallbackList.length > 0) {
        appt = fallbackList[0]
        apptError = null
      }
    }

    if (apptError || !appt) {
      console.error('Extra appointment insert error:', apptError)
      return { success: false, message: 'Erro ao registrar atendimento extra.' }
    }

    // 6. Create payment record
    const paymentStatus = isPaid ? 'confirmed_manually' : 'pending'
    await adminDb
      .from('payments')
      .insert({
        appointment_id: appt.id,
        total_amount: finalPrice,
        deposit_amount: 0.00,
        status: paymentStatus,
        method: paymentMethod || 'cash',
        notes: `Atendimento Extra registrado no painel${isPaid ? ' (pago no ato)' : ' (pagamento pendente)'}`
      })

    const statusMsg = isPaid
      ? 'Atendimento Extra registrado e marcado como pago!'
      : 'Atendimento Extra registrado (pagamento pendente — aparecerá no Checkout do Dia).'

    return { success: true, message: statusMsg }
  } catch (err) {
    console.error('Error inside createExtraAppointmentAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}

/**
 * Permanently delete an appointment and its linked payment record.
 * ADMIN ROLE ONLY — barbers are rejected server-side even if the UI is bypassed.
 */
export async function deleteAppointmentAction(apptId: string): Promise<ActionResponse> {
  const staff = await verifyStaffSession()
  if (!staff) {
    return { success: false, message: 'Não autorizado.' }
  }

  // Hard-block: barbers may never delete appointments, even via direct API call
  if (staff.role !== 'admin') {
    return { success: false, message: 'Apenas administradores podem excluir agendamentos permanentemente.' }
  }

  if (!apptId) {
    return { success: false, message: 'ID do agendamento inválido.' }
  }

  try {
    const supabase = await createServerSupabaseClient()

    // Delete payments first (in case ON DELETE CASCADE is not set on the FK)
    await supabase
      .from('payments')
      .delete()
      .eq('appointment_id', apptId)

    // Delete the appointment itself
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', apptId)

    if (error) {
      console.error('Error deleting appointment:', error)
      return { success: false, message: 'Erro ao excluir agendamento.' }
    }

    return { success: true, message: 'Agendamento excluído permanentemente.' }
  } catch (err) {
    console.error('Error inside deleteAppointmentAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}

/**
 * Update the charged amount for a single appointment (e.g. a discount given
 * at the barber's discretion, right there on the agenda).
 *
 * SAFETY: touches ONLY payments.total_amount for that one appointment.
 * Does not change status, method, or anything else.
 */
export async function updateAppointmentPriceAction(
  appointmentId: string,
  newAmount: number
): Promise<ActionResponse> {
  const staff = await verifyStaffSession()
  if (!staff) {
    return { success: false, message: 'Não autorizado.' }
  }

  if (!Number.isFinite(newAmount) || newAmount < 0) {
    return { success: false, message: 'Valor inválido.' }
  }

  const supabase = await createServerSupabaseClient()

  const { data: appt, error: fetchErr } = await supabase
    .from('appointments')
    .select('id, barber_id')
    .eq('id', appointmentId)
    .single()

  if (fetchErr || !appt) {
    return { success: false, message: 'Agendamento não encontrado.' }
  }

  if (staff.role === 'barber' && appt.barber_id !== staff.user.id) {
    return { success: false, message: 'Você só pode alterar seus próprios agendamentos.' }
  }

  const { error } = await supabase
    .from('payments')
    .update({ total_amount: newAmount })
    .eq('appointment_id', appointmentId)

  if (error) {
    console.error('Error updating appointment price:', error)
    return { success: false, message: 'Erro ao atualizar o valor.' }
  }

  return { success: true, message: 'Valor atualizado com sucesso.' }
}

/**
 * Bulk Checkout do Dia — settle multiple unpaid appointments at once.
 *
 * SAFETY:
 * - Processes each appointment INDEPENDENTLY (no bulk SQL).
 * - Only touches `appointments.status` and `payments.{status, method, total_amount}`.
 *   `total_amount` is only touched when the staff explicitly overrides it (e.g. a discount).
 * - Returns per-row success/failure so the UI can report individually.
 * - Never modifies customers, package_subscriptions, other days, etc.
 */
export type BulkCheckoutItem = {
  appointmentId: string
  paymentMethod: string // 'cash' | 'card' | 'pix' | 'other'
  finalAmount?: number // optional manual override of the charged amount (e.g. a discount applied at checkout)
}

export type BulkCheckoutResult = {
  appointmentId: string
  success: boolean
  message: string
}

export async function bulkCheckoutAction(
  items: BulkCheckoutItem[]
): Promise<{ success: boolean; message: string; results: BulkCheckoutResult[] }> {
  const staff = await verifyStaffSession()
  if (!staff) {
    return { success: false, message: 'Não autorizado.', results: [] }
  }

  if (!items || items.length === 0) {
    return { success: false, message: 'Nenhum agendamento selecionado para checkout.', results: [] }
  }

  const supabase = await createServerSupabaseClient()
  const results: BulkCheckoutResult[] = []

  for (const item of items) {
    try {
      // 1. Fetch appointment to validate it exists and belongs to the barber
      const { data: appt, error: fetchErr } = await supabase
        .from('appointments')
        .select('id, barber_id, customer_id, status')
        .eq('id', item.appointmentId)
        .single()

      if (fetchErr || !appt) {
        results.push({
          appointmentId: item.appointmentId,
          success: false,
          message: 'Agendamento não encontrado.'
        })
        continue
      }

      // Barber role can only checkout their own appointments
      if (staff.role === 'barber' && appt.barber_id !== staff.user.id) {
        results.push({
          appointmentId: item.appointmentId,
          success: false,
          message: 'Você só pode gerenciar seus próprios agendamentos.'
        })
        continue
      }

      // Skip already completed/cancelled/no_show
      if (appt.status === 'completed' || appt.status === 'cancelled' || appt.status === 'no_show') {
        results.push({
          appointmentId: item.appointmentId,
          success: false,
          message: `Agendamento já finalizado (${appt.status}).`
        })
        continue
      }

      // 2. Update appointment status to completed
      const { error: apptUpdateErr } = await supabase
        .from('appointments')
        .update({ status: 'completed' })
        .eq('id', item.appointmentId)

      if (apptUpdateErr) {
        console.error('Checkout appt update error:', apptUpdateErr)
        results.push({
          appointmentId: item.appointmentId,
          success: false,
          message: 'Erro ao atualizar status do agendamento.'
        })
        continue
      }

      // 3. Update payment: status → confirmed_manually, method → selected,
      //    total_amount → staff override when provided (e.g. a discount)
      const paymentUpdate: { status: string; method: string; total_amount?: number } = {
        status: 'confirmed_manually',
        method: item.paymentMethod
      }

      if (item.finalAmount !== undefined && item.finalAmount !== null) {
        if (!Number.isFinite(item.finalAmount) || item.finalAmount < 0) {
          results.push({
            appointmentId: item.appointmentId,
            success: false,
            message: 'Valor final informado é inválido.'
          })
          continue
        }
        paymentUpdate.total_amount = item.finalAmount
      }

      const { error: payUpdateErr } = await supabase
        .from('payments')
        .update(paymentUpdate)
        .eq('appointment_id', item.appointmentId)

      if (payUpdateErr) {
        console.error('Checkout payment update error:', payUpdateErr)
        results.push({
          appointmentId: item.appointmentId,
          success: false,
          message: 'Agendamento concluído, mas erro ao atualizar pagamento.'
        })
        continue
      }

      // 4. Resolve outstanding no-show fee if customer has one
      if (appt.customer_id) {
        try {
          await resolveNoShowFeeForCustomer(appt.customer_id)
        } catch (nsFeeErr) {
          // Non-fatal: log but don't fail the checkout for this item
          console.error('No-show fee resolution error (non-fatal):', nsFeeErr)
        }
      }

      results.push({
        appointmentId: item.appointmentId,
        success: true,
        message: 'Pagamento confirmado com sucesso.'
      })
    } catch (err) {
      console.error('Checkout error for', item.appointmentId, ':', err)
      results.push({
        appointmentId: item.appointmentId,
        success: false,
        message: 'Erro interno ao processar este agendamento.'
      })
    }
  }

  const successCount = results.filter(r => r.success).length
  const failCount = results.filter(r => !r.success).length

  let summaryMsg = `${successCount} de ${results.length} agendamento(s) processado(s) com sucesso.`
  if (failCount > 0) {
    summaryMsg += ` ${failCount} falha(s) — verifique os detalhes.`
  }

  return {
    success: failCount === 0,
    message: summaryMsg,
    results
  }
}
