'use server'

import { createServerSupabaseClient } from '@/lib/supabase'
import { getAvailableSlots } from '@/lib/booking'
import { getSessionDatesForDuration } from '@/lib/package-utils'
import { addMinutes, format } from 'date-fns'

export type PackageActionResponse = {
  success: boolean
  message: string
  conflicts?: string[] // dates that conflict (YYYY-MM-DD)
}

const WEEKDAY_NAMES_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

async function verifyAdminSession() {
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
 * Create a package by duration (1, 4, or 6 months): validates ALL session slots, then atomically creates
 * 1 package_subscriptions row + N appointment rows.
 * ALL-OR-NOTHING: if any slot is unavailable, nothing is created.
 */
export async function createPackageAction(
  customerId: string,
  barberId: string,
  serviceId: string,
  dayOfWeek: number,
  timeSlot: string,
  startDate: string, // YYYY-MM-DD
  packagePrice: number,
  durationMonths: number, // 1, 4, or 6
  selectedDates?: string[],
  customCustomerName?: string
): Promise<PackageActionResponse> {
  const admin = await verifyAdminSession()
  if (!admin) {
    return { success: false, message: 'Apenas administradores podem criar pacotes.' }
  }

  if ((!customerId && !customCustomerName?.trim()) || !barberId || !serviceId || !timeSlot || !startDate || !packagePrice || !durationMonths) {
    return { success: false, message: 'Todos os campos são obrigatórios.' }
  }

  if (![1, 4, 6].includes(durationMonths)) {
    return { success: false, message: 'A duração do pacote deve ser 1, 4 ou 6 meses.' }
  }

  try {
    const supabase = await createServerSupabaseClient()
    let finalCustomerId = customerId

    // If no customerId provided but customCustomerName was typed, create a guest profile on the fly
    if (!finalCustomerId && customCustomerName?.trim()) {
      const newGuestId = crypto.randomUUID()
      const { createClient: createBaseClient } = await import('@supabase/supabase-js')
      const supabaseAdmin = createBaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )

      const guestEmail = `cliente_${Date.now()}_${Math.floor(Math.random() * 1000)}@barbearia.local`

      const { data: newProfile, error: profileErr } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: newGuestId,
          full_name: customCustomerName.trim(),
          email: guestEmail,
          role: 'customer'
        })
        .select('id')
        .single()

      if (profileErr || !newProfile) {
        console.error('Error creating guest customer profile:', profileErr)
        return { success: false, message: 'Erro ao cadastrar novo cliente sem conta.' }
      }

      finalCustomerId = newProfile.id
    }

    // 1. Fetch service details (duration needed for slot checking)
    const { data: barberService } = await supabase
      .from('barber_services')
      .select('price, duration, is_active, services(name)')
      .eq('barber_id', barberId)
      .eq('service_id', serviceId)
      .single()

    let serviceDuration: number
    let serviceName: string

    if (barberService && barberService.is_active) {
      serviceDuration = Number(barberService.duration)
      serviceName = (barberService.services as any)?.name || 'Serviço'
    } else {
      // Fallback: try the services table directly
      const { data: baseService } = await supabase
        .from('services')
        .select('name, duration')
        .eq('id', serviceId)
        .single()

      if (!baseService) {
        return { success: false, message: 'Serviço não encontrado.' }
      }
      serviceDuration = Number(baseService.duration)
      serviceName = baseService.name
    }

    // 2. Compute or use passed selected session dates
    const sessionDates = (selectedDates && selectedDates.length > 0)
      ? selectedDates
      : getSessionDatesForDuration(startDate, durationMonths)
    const totalSessions = sessionDates.length

    if (totalSessions === 0) {
      return { success: false, message: 'Impossível calcular datas do pacote para a duração selecionada.' }
    }

    // 3. ALL-OR-NOTHING availability check for every selected session date using parallel execution
    const slotChecks = await Promise.all(
      sessionDates.map(async (dateStr) => {
        const availableSlots = await getAvailableSlots(barberId, dateStr, serviceDuration)
        return {
          date: dateStr,
          available: availableSlots.includes(timeSlot)
        }
      })
    )

    const conflicts = slotChecks.filter(s => !s.available).map(s => s.date)

    if (conflicts.length > 0) {
      const conflictList = conflicts.map(d => {
        const [y, m, dd] = d.split('-')
        return `${dd}/${m}/${y}`
      }).join(', ')
      return {
        success: false,
        message: `Conflito de horário em ${conflicts.length} data(s): ${conflictList}. O pacote NÃO foi criado. Resolva os conflitos e tente novamente.`,
        conflicts
      }
    }

    // 4. All slots available — create the package subscription
    const { data: pkg, error: pkgError } = await supabase
      .from('package_subscriptions')
      .insert({
        customer_id: finalCustomerId,
        barber_id: barberId,
        service_id: serviceId,
        day_of_week: dayOfWeek,
        time_slot: timeSlot,
        start_date: startDate,
        total_sessions: totalSessions,
        package_price: packagePrice,
        status: 'active',
        created_by: admin.user.id,
        payment_status: 'pending'
      })
      .select('id')
      .single()

    if (pkgError || !pkg) {
      console.error('Error creating package subscription:', pkgError)
      return { success: false, message: 'Erro ao criar o pacote no banco de dados.' }
    }

    // 5. Create N appointment rows linked to the package
    const pricePerSession = Math.round((packagePrice / totalSessions) * 100) / 100

    for (let i = 0; i < sessionDates.length; i++) {
      const dateStr = sessionDates[i]
      const startTimeStr = `${dateStr}T${timeSlot}:00-03:00`
      const startDateObj = new Date(startTimeStr)
      const endDateObj = addMinutes(startDateObj, serviceDuration)

      const { data: appt, error: apptError } = await supabase
        .from('appointments')
        .insert({
          customer_id: finalCustomerId,
          barber_id: barberId,
          service_id: serviceId,
          start_time: startDateObj.toISOString(),
          end_time: endDateObj.toISOString(),
          status: 'confirmed',
          notes: `[Pacote ${durationMonths} Mês/Meses] Sessão ${i + 1}/${totalSessions} — ${serviceName}`,
          package_subscription_id: pkg.id
        })
        .select('id')
        .single()

      if (apptError || !appt) {
        console.error(`Error creating appointment for session ${i + 1}:`, apptError)
        continue
      }

      // Create a payment record for this appointment
      await supabase
        .from('payments')
        .insert({
          appointment_id: appt.id,
          total_amount: pricePerSession,
          deposit_amount: 0,
          status: 'confirmed_manually',
          method: 'package',
          notes: `Pacote (${durationMonths}m) — Sessão ${i + 1}/${totalSessions}`
        })
    }

    const weekdayName = WEEKDAY_NAMES_PT[dayOfWeek]
    return {
      success: true,
      message: `Pacote de ${durationMonths} ${durationMonths === 1 ? 'mês' : 'meses'} (${totalSessions} sessões) criado com sucesso! Toda ${weekdayName} às ${timeSlot}.`
    }
  } catch (err) {
    console.error('Error in createPackageAction:', err)
    return { success: false, message: 'Erro interno no servidor ao criar pacote.' }
  }
}

/**
 * Cancel a package: sets subscription status to 'cancelled' and cancels
 * all future linked appointments. Keeps past/completed ones untouched.
 */
export async function cancelPackageAction(packageId: string): Promise<PackageActionResponse> {
  const admin = await verifyAdminSession()
  if (!admin) {
    return { success: false, message: 'Apenas administradores podem cancelar pacotes.' }
  }

  if (!packageId) {
    return { success: false, message: 'ID do pacote inválido.' }
  }

  try {
    const supabase = await createServerSupabaseClient()

    // 1. Update subscription status and payment status
    const { error: subError } = await supabase
      .from('package_subscriptions')
      .update({ 
        status: 'cancelled', 
        payment_status: 'cancelled',
        updated_at: new Date().toISOString() 
      })
      .eq('id', packageId)

    if (subError) {
      console.error('Error cancelling package subscription:', subError)
      return { success: false, message: 'Erro ao cancelar o pacote.' }
    }

    // 2. Cancel only future appointments linked to this package
    const now = new Date().toISOString()
    const { data: futureAppts } = await supabase
      .from('appointments')
      .select('id')
      .eq('package_subscription_id', packageId)
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .gte('start_time', now)

    if (futureAppts && futureAppts.length > 0) {
      const ids = futureAppts.map(a => a.id)
      await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .in('id', ids)

      // Also update payment records
      await supabase
        .from('payments')
        .update({ status: 'refunded', notes: 'Pacote cancelado pelo administrador.' })
        .in('appointment_id', ids)
    }

    return {
      success: true,
      message: `Pacote cancelado. ${futureAppts?.length || 0} agendamento(s) futuro(s) foram cancelados.`
    }
  } catch (err) {
    console.error('Error in cancelPackageAction:', err)
    return { success: false, message: 'Erro interno no servidor ao cancelar pacote.' }
  }
}

/**
 * Cancel a single session (appointment) of an existing package.
 * Frees up the slot for other bookings without deleting the package.
 */
export async function cancelPackageSessionAction(appointmentId: string): Promise<PackageActionResponse> {
  const admin = await verifyAdminSession()
  if (!admin) {
    return { success: false, message: 'Apenas administradores podem gerenciar sessões de pacotes.' }
  }

  if (!appointmentId) {
    return { success: false, message: 'ID de agendamento inválido.' }
  }

  try {
    const supabase = await createServerSupabaseClient()

    // Update appointment status to cancelled
    const { error: apptError } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointmentId)

    if (apptError) {
      console.error('Error cancelling package session appointment:', apptError)
      return { success: false, message: 'Erro ao desmarcar a sessão.' }
    }

    // Update associated payment record
    await supabase
      .from('payments')
      .update({ status: 'refunded', notes: 'Sessão do pacote desmarcada pelo administrador.' })
      .eq('appointment_id', appointmentId)

    return { success: true, message: 'Sessão desmarcada com sucesso. O horário está livre para outros clientes.' }
  } catch (err) {
    console.error('Error in cancelPackageSessionAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}

/**
 * Reschedule a single session (appointment) of an existing package to a new date and time slot.
 * Keeps the appointment linked to the package_subscription_id and blocks the new slot.
 */
export async function reschedulePackageSessionAction(
  appointmentId: string,
  newDate: string, // YYYY-MM-DD
  newTimeSlot: string // HH:mm
): Promise<PackageActionResponse> {
  const admin = await verifyAdminSession()
  if (!admin) {
    return { success: false, message: 'Apenas administradores podem reagendar sessões de pacotes.' }
  }

  if (!appointmentId || !newDate || !newTimeSlot) {
    return { success: false, message: 'Todos os campos para remarcação são obrigatórios.' }
  }

  try {
    const supabase = await createServerSupabaseClient()

    // 1. Fetch appointment details
    const { data: appt } = await supabase
      .from('appointments')
      .select('id, barber_id, service_id, package_subscription_id')
      .eq('id', appointmentId)
      .single()

    if (!appt) {
      return { success: false, message: 'Agendamento não encontrado.' }
    }

    // 2. Fetch service duration
    let serviceDuration = 60
    const { data: barberService } = await supabase
      .from('barber_services')
      .select('duration')
      .eq('barber_id', appt.barber_id)
      .eq('service_id', appt.service_id)
      .single()

    if (barberService) {
      serviceDuration = Number(barberService.duration)
    } else {
      const { data: baseService } = await supabase
        .from('services')
        .select('duration')
        .eq('id', appt.service_id)
        .single()
      if (baseService) {
        serviceDuration = Number(baseService.duration)
      }
    }

    // 3. Verify slot availability on newDate for barber
    const availableSlots = await getAvailableSlots(appt.barber_id, newDate, serviceDuration)
    if (!availableSlots.includes(newTimeSlot)) {
      return { success: false, message: `Horário ${newTimeSlot} em ${newDate} está indisponível na agenda.` }
    }

    // 4. Compute new start_time and end_time
    const startTimeStr = `${newDate}T${newTimeSlot}:00-03:00`
    const startDateObj = new Date(startTimeStr)
    const endDateObj = addMinutes(startDateObj, serviceDuration)

    // 5. Update appointment with new timing and status = 'confirmed'
    const { error: updateError } = await supabase
      .from('appointments')
      .update({
        start_time: startDateObj.toISOString(),
        end_time: endDateObj.toISOString(),
        status: 'confirmed'
      })
      .eq('id', appointmentId)

    if (updateError) {
      console.error('Error updating rescheduled appointment:', updateError)
      return { success: false, message: 'Erro ao salvar novo horário no banco de dados.' }
    }

    // 6. Update payment record status
    await supabase
      .from('payments')
      .update({ status: 'confirmed_manually', notes: 'Sessão do pacote reagendada' })
      .eq('appointment_id', appointmentId)

    return {
      success: true,
      message: `Sessão reagendada com sucesso para ${newDate} às ${newTimeSlot}!`
    }
  } catch (err) {
    console.error('Error in reschedulePackageSessionAction:', err)
    return { success: false, message: 'Erro interno no servidor ao reagendar sessão.' }
  }
}

/**
 * Validate availability for all session dates without creating anything.
 * Used for live preview in the form.
 */
export async function validatePackageSlotsAction(
  barberId: string,
  serviceId: string,
  timeSlot: string,
  startDate: string,
  durationMonths: number,
  candidateDates?: string[]
): Promise<{ success: boolean; dates: Array<{ date: string; available: boolean }>; totalSessions: number }> {
  const admin = await verifyAdminSession()
  if (!admin) {
    return { success: false, dates: [], totalSessions: 0 }
  }

  try {
    const supabase = await createServerSupabaseClient()

    // Get service duration
    let serviceDuration = 60 // default fallback

    const { data: barberService } = await supabase
      .from('barber_services')
      .select('duration')
      .eq('barber_id', barberId)
      .eq('service_id', serviceId)
      .single()

    if (barberService) {
      serviceDuration = Number(barberService.duration)
    } else {
      const { data: baseService } = await supabase
        .from('services')
        .select('duration')
        .eq('id', serviceId)
        .single()
      if (baseService) {
        serviceDuration = Number(baseService.duration)
      }
    }

    // Compute or use candidate session dates
    const sessionDates = (candidateDates && candidateDates.length > 0)
      ? candidateDates
      : getSessionDatesForDuration(startDate, durationMonths)

    const results = await Promise.all(
      sessionDates.map(async (dateStr) => {
        const availableSlots = await getAvailableSlots(barberId, dateStr, serviceDuration)
        return {
          date: dateStr,
          available: availableSlots.includes(timeSlot)
        }
      })
    )

    return { success: true, dates: results, totalSessions: sessionDates.length }
  } catch (err) {
    console.error('Error in validatePackageSlotsAction:', err)
    return { success: false, dates: [], totalSessions: 0 }
  }
}

/**
 * Mark a package subscription as paid.
 */
export async function markPackageAsPaidAction(packageId: string): Promise<PackageActionResponse> {
  const admin = await verifyAdminSession()
  if (!admin) {
    return { success: false, message: 'Apenas administradores podem gerenciar pagamentos de pacotes.' }
  }

  if (!packageId) {
    return { success: false, message: 'ID do pacote inválido.' }
  }

  try {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('package_subscriptions')
      .update({ payment_status: 'paid', updated_at: new Date().toISOString() })
      .eq('id', packageId)

    if (error) {
      console.error('Error marking package as paid:', error)
      return { success: false, message: 'Erro ao marcar pacote como pago.' }
    }

    return { success: true, message: 'Pacote marcado como pago com sucesso.' }
  } catch (err) {
    console.error('Error in markPackageAsPaidAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}

/**
 * Permanently delete a package, its appointments, and its payments.
 */
export async function deletePackageAction(packageId: string): Promise<PackageActionResponse> {
  const admin = await verifyAdminSession()
  if (!admin) {
    return { success: false, message: 'Apenas administradores podem excluir pacotes permanentemente.' }
  }

  if (!packageId) {
    return { success: false, message: 'ID do pacote inválido.' }
  }

  try {
    const supabase = await createServerSupabaseClient()

    // 1. Get all appointments linked to this package
    const { data: appts } = await supabase
      .from('appointments')
      .select('id')
      .eq('package_subscription_id', packageId)

    if (appts && appts.length > 0) {
      const apptIds = appts.map(a => a.id)

      // 2. Delete payment records for these appointments
      await supabase
        .from('payments')
        .delete()
        .in('appointment_id', apptIds)

      // 3. Delete appointments
      const { error: apptError } = await supabase
        .from('appointments')
        .delete()
        .in('id', apptIds)

      if (apptError) {
        console.error('Error deleting package appointments:', apptError)
        return { success: false, message: 'Erro ao excluir agendamentos do pacote.' }
      }
    }

    // 4. Delete the package subscription itself
    const { error: pkgError } = await supabase
      .from('package_subscriptions')
      .delete()
      .eq('id', packageId)

    if (pkgError) {
      console.error('Error deleting package subscription:', pkgError)
      return { success: false, message: 'Erro ao excluir o pacote.' }
    }

    return { success: true, message: 'Pacote e todos os seus agendamentos foram excluídos permanentemente.' }
  } catch (err) {
    console.error('Error in deletePackageAction:', err)
    return { success: false, message: 'Erro interno no servidor ao excluir pacote.' }
  }
}
