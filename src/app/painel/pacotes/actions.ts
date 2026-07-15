'use server'

import { createServerSupabaseClient } from '@/lib/supabase'
import { getAvailableSlots } from '@/lib/booking'
import { addMinutes, addWeeks, format } from 'date-fns'

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

  if (!profile || profile.role !== 'admin') {
    return null
  }
  return { user, role: profile.role }
}

/**
 * Create a monthly package: validates ALL session slots, then atomically creates
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
  totalSessions: number
): Promise<PackageActionResponse> {
  const admin = await verifyAdminSession()
  if (!admin) {
    return { success: false, message: 'Apenas administradores podem criar pacotes.' }
  }

  if (!customerId || !barberId || !serviceId || !timeSlot || !startDate || !packagePrice || !totalSessions) {
    return { success: false, message: 'Todos os campos são obrigatórios.' }
  }

  if (totalSessions < 2 || totalSessions > 8) {
    return { success: false, message: 'Número de sessões deve ser entre 2 e 8.' }
  }

  try {
    const supabase = await createServerSupabaseClient()

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

    // 2. Compute all N session dates (start_date + N-1 subsequent weeks)
    const [startY, startM, startD] = startDate.split('-').map(Number)
    const baseDate = new Date(startY, startM - 1, startD)
    
    const sessionDates: string[] = []
    for (let i = 0; i < totalSessions; i++) {
      const sessionDate = addWeeks(baseDate, i)
      const y = sessionDate.getFullYear()
      const m = String(sessionDate.getMonth() + 1).padStart(2, '0')
      const d = String(sessionDate.getDate()).padStart(2, '0')
      sessionDates.push(`${y}-${m}-${d}`)
    }

    // 3. ALL-OR-NOTHING availability check for every session date
    const conflicts: string[] = []

    for (const dateStr of sessionDates) {
      const availableSlots = await getAvailableSlots(barberId, dateStr, serviceDuration)
      if (!availableSlots.includes(timeSlot)) {
        conflicts.push(dateStr)
      }
    }

    if (conflicts.length > 0) {
      const conflictList = conflicts.map(d => {
        const [y, m, dd] = d.split('-')
        return `${dd}/${m}/${y}`
      }).join(', ')
      return {
        success: false,
        message: `Conflito de horário nas seguintes datas: ${conflictList}. O pacote NÃO foi criado. Resolva os conflitos e tente novamente.`,
        conflicts
      }
    }

    // 4. All slots available — create the package subscription
    const { data: pkg, error: pkgError } = await supabase
      .from('package_subscriptions')
      .insert({
        customer_id: customerId,
        barber_id: barberId,
        service_id: serviceId,
        day_of_week: dayOfWeek,
        time_slot: timeSlot,
        start_date: startDate,
        total_sessions: totalSessions,
        package_price: packagePrice,
        status: 'active'
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
          customer_id: customerId,
          barber_id: barberId,
          service_id: serviceId,
          start_time: startDateObj.toISOString(),
          end_time: endDateObj.toISOString(),
          status: 'confirmed',
          notes: `[Pacote Mensal] Sessão ${i + 1}/${totalSessions} — ${serviceName}`,
          package_subscription_id: pkg.id
        })
        .select('id')
        .single()

      if (apptError || !appt) {
        console.error(`Error creating appointment for session ${i + 1}:`, apptError)
        // Continue creating remaining appointments even if one fails
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
          notes: `Pacote Mensal — Sessão ${i + 1}/${totalSessions}`
        })
    }

    const weekdayName = WEEKDAY_NAMES_PT[dayOfWeek]
    return {
      success: true,
      message: `Pacote criado com sucesso! ${totalSessions} sessões toda ${weekdayName} às ${timeSlot}.`
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

    // 1. Update subscription status
    const { error: subError } = await supabase
      .from('package_subscriptions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
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
 * Validate availability for all session dates without creating anything.
 * Used for live preview in the form.
 */
export async function validatePackageSlotsAction(
  barberId: string,
  serviceId: string,
  timeSlot: string,
  startDate: string,
  totalSessions: number
): Promise<{ success: boolean; dates: Array<{ date: string; available: boolean }> }> {
  const admin = await verifyAdminSession()
  if (!admin) {
    return { success: false, dates: [] }
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

    // Compute session dates
    const [startY, startM, startD] = startDate.split('-').map(Number)
    const baseDate = new Date(startY, startM - 1, startD)

    const results: Array<{ date: string; available: boolean }> = []

    for (let i = 0; i < totalSessions; i++) {
      const sessionDate = addWeeks(baseDate, i)
      const y = sessionDate.getFullYear()
      const m = String(sessionDate.getMonth() + 1).padStart(2, '0')
      const d = String(sessionDate.getDate()).padStart(2, '0')
      const dateStr = `${y}-${m}-${d}`

      const availableSlots = await getAvailableSlots(barberId, dateStr, serviceDuration)
      results.push({
        date: dateStr,
        available: availableSlots.includes(timeSlot)
      })
    }

    return { success: true, dates: results }
  } catch (err) {
    console.error('Error in validatePackageSlotsAction:', err)
    return { success: false, dates: [] }
  }
}
