'use server'

import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase'
import { getAvailableSlots, isRecurringReservationActiveOnDate } from '@/lib/booking'
import { addMinutes } from 'date-fns'
import { getOutstandingNoShowFee, type NoShowFeeInfo } from '@/lib/no-show'

export type BookingResponse = {
  success: boolean
  message: string
  appointmentId?: string
}

/**
 * Check if the current user has an outstanding no-show fee.
 * Called on the booking page to display the fee banner.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function checkNoShowFeeAction(): Promise<NoShowFeeInfo | null> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    return await getOutstandingNoShowFee(user.id)
  } catch (err) {
    console.error('Error checking no-show fee:', err)
    return null
  }
}

export async function createAppointmentAction(
  barberId: string,
  serviceId: string,
  dateStr: string,
  timeStr: string,
  notes: string,
  paymentMethod: 'pix' | 'cash' | 'card' = 'pix'
): Promise<BookingResponse> {
  if (!barberId || !serviceId || !dateStr || !timeStr) {
    return { success: false, message: 'Todos os campos de agendamento são obrigatórios.' }
  }

  try {
    const supabase = await createServerSupabaseClient()
    const adminDb = await createAdminSupabaseClient()

    // 1. Get authenticated user session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, message: 'Sessão expirada. Por favor, faça login novamente.' }
    }

    // Ids de seed ('sergio-uuid'/'enzo-uuid') nao sao barbeiros reais: agendamento exige UUID.
    if (!UUID_RE.test(barberId)) {
      return { success: false, message: 'Profissional indisponível no momento. Recarregue a página e tente novamente.' }
    }
    const targetBarberId = barberId

    // 2. Fetch service details, availability, and outstanding no-show fee in PARALLEL
    const fetchServicePromise = (async () => {
      const { data: barberService, error: serviceError } = await adminDb
        .from('barber_services')
        .select('price, duration, is_active, services(name)')
        .eq('barber_id', targetBarberId)
        .eq('service_id', serviceId)
        .single()

      if (!serviceError && barberService && barberService.is_active) {
        return {
          name: (barberService.services as any)?.name || 'Serviço',
          duration: Number(barberService.duration),
          price: Number(barberService.price),
          is_active: barberService.is_active
        }
      }

      // Fallback lookup in global services table if barber_services wasn't linked
      const { data: globalService } = await adminDb
        .from('services')
        .select('name, duration, price, is_active')
        .eq('id', serviceId)
        .single()

      if (globalService && globalService.is_active) {
        return {
          name: globalService.name,
          duration: Number(globalService.duration),
          price: Number(globalService.price),
          is_active: globalService.is_active
        }
      }

      return null
    })()

    const noShowFeePromise = getOutstandingNoShowFee(user.id)

    const [service, noShowFee] = await Promise.all([fetchServicePromise, noShowFeePromise])

    if (!service || !service.is_active) {
      return { success: false, message: 'Serviço selecionado inválido ou inativo para este profissional.' }
    }

    // 3. Verify availability (Double-booking prevention rule)
    const duration = service.duration
    const availableSlots = await getAvailableSlots(targetBarberId, dateStr, duration)

    if (!availableSlots.includes(timeStr)) {
      return { success: false, message: 'Desculpe, este horário não está mais disponível. Escolha outro.' }
    }

    // 4. Construct start and end timestamps in Sao Paulo timezone (UTC-3)
    const startTimeStr = `${dateStr}T${timeStr}:00-03:00`
    const startDate = new Date(startTimeStr)
    const endDate = addMinutes(startDate, duration)
    const endTimeStr = endDate.toISOString() // UTC format standard

    const feeAmount = noShowFee?.fee || 0

    // 6. Insert appointment using adminDb
    let appointment: { id: string } | null = null
    let apptError: any = null

    const insertRes = await adminDb
      .from('appointments')
      .insert({
        customer_id: user.id,
        barber_id: targetBarberId,
        service_id: serviceId,
        start_time: startDate.toISOString(),
        end_time: endTimeStr,
        status: 'pending',
        notes: notes || null
      })
      .select('id')
      .single()

    if (insertRes.data?.id) {
      appointment = insertRes.data
    } else {
      apptError = insertRes.error
      // Fallback: Query inserted appointment if .single() failed due to RLS/PostgREST response filtering
      const { data: fallbackList } = await adminDb
        .from('appointments')
        .select('id')
        .eq('customer_id', user.id)
        .eq('start_time', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)

      if (fallbackList && fallbackList.length > 0) {
        appointment = fallbackList[0]
        apptError = null
      }
    }

    if (apptError?.code === '23P01') {
      // exclusion_violation: a constraint anti-overbooking barrou um horario ocupado em corrida.
      return { success: false, message: 'Desculpe, este horário não está mais disponível. Escolha outro.' }
    }

    if (apptError || !appointment) {
      console.error('Error inserting appointment:', apptError)
      return { success: false, message: 'Erro ao registrar agendamento no banco de dados.' }
    }

    // 7. Compute total with fee and insert payment entry
    const servicePrice = Number(service.price)
    const totalAmount = servicePrice + feeAmount
    const depositAmount = totalAmount * 0.5

    const feeNote = feeAmount > 0
      ? ` | Taxa no-show inclusa: R$ ${feeAmount.toFixed(2)}`
      : ''

    const methodNote = paymentMethod === 'pix' 
      ? `Sinal Pix de 50% gerado para o serviço: ${service.name}${feeNote}`
      : `Pagamento presencial (${paymentMethod === 'cash' ? 'Dinheiro' : 'Cartão'}) para o serviço: ${service.name}${feeNote}`

    const { error: payError } = await adminDb
      .from('payments')
      .insert({
        appointment_id: appointment.id,
        total_amount: totalAmount,
        deposit_amount: depositAmount,
        status: 'pending',
        method: paymentMethod,
        notes: methodNote
      })

    if (payError) {
      console.error('Error inserting payment log:', payError)
    }

    return { 
      success: true, 
      message: 'Agendamento pré-confirmado com sucesso!', 
      appointmentId: appointment.id 
    }
  } catch (err) {
    console.error('Error in createAppointmentAction:', err)
    return { success: false, message: 'Não foi possível realizar o agendamento. Tente novamente em instantes.' }
  }
}

// Helper to convert time "HH:MM" to minutes from midnight
function timeToMinutesLocal(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

export type DayAvailability = {
  isClosed: boolean
  isFullyBooked: boolean
  hasSlots: boolean
}

export type MonthAvailabilityResponse = {
  success: boolean
  message: string
  availability: Record<string, DayAvailability>
}

/**
 * Server Action to load availability for all days of a month in a single batch.
 */
export async function getBarberMonthAvailabilityAction(
  barberId: string,
  year: number,
  month: number, // 1-indexed (1 = Jan, 12 = Dec)
  serviceDuration: number
): Promise<MonthAvailabilityResponse> {
  if (!barberId || !year || !month || !serviceDuration) {
    return { success: false, message: 'Parâmetros ausentes.', availability: {} }
  }

  try {
    const supabase = await createAdminSupabaseClient()

    // Resolve mock barber IDs ('sergio-uuid', 'enzo-uuid') to real database UUID if needed
    let targetBarberId = barberId
    if (barberId === 'sergio-uuid' || barberId === 'enzo-uuid') {
      const { data: realBarbers } = await supabase
        .from('barbers')
        .select('id, profiles(full_name)')
        .limit(10)
      const match = realBarbers?.find((b: any) =>
        barberId === 'sergio-uuid'
          ? b.profiles?.full_name?.toLowerCase().includes('sergio')
          : b.profiles?.full_name?.toLowerCase().includes('enzo')
      ) || realBarbers?.[0]

      if (match?.id) {
        targetBarberId = match.id
      }
    }

    // 1. Fetch working hours for the selected barber
    const { data: workingHoursList } = await supabase
      .from('barber_working_hours')
      .select('*')
      .eq('barber_id', targetBarberId)

    const workingHoursMap = new Map<number, any>()
    if (workingHoursList) {
      workingHoursList.forEach(wh => {
        workingHoursMap.set(wh.day_of_week, wh)
      })
    }

    // Last day of target month
    const lastDay = new Date(year, month, 0).getDate()
    
    const formattedMonth = String(month).padStart(2, '0')
    const startOfMonthStr = `${year}-${formattedMonth}-01T00:00:00-03:00`
    const endOfMonthStr = `${year}-${formattedMonth}-${String(lastDay).padStart(2, '0')}T23:59:59-03:00`

    // 2. Fetch days off for the month
    const { data: daysOff } = await supabase
      .from('days_off')
      .select('date')
      .eq('barber_id', targetBarberId)
      .gte('date', `${year}-${formattedMonth}-01`)
      .lte('date', `${year}-${formattedMonth}-${String(lastDay).padStart(2, '0')}`)

    const daysOffSet = new Set(daysOff?.map(d => d.date) || [])

    // 3. Fetch active appointments for the month
    const { data: appointments } = await supabase
      .from('appointments')
      .select('start_time, end_time')
      .eq('barber_id', targetBarberId)
      .neq('status', 'cancelled')
      .lt('start_time', endOfMonthStr)
      .gt('end_time', startOfMonthStr)

    // 4. Fetch blocked times for the month
    const { data: blockedTimes } = await supabase
      .from('blocked_times')
      .select('start_time, end_time')
      .eq('barber_id', targetBarberId)
      .lt('start_time', endOfMonthStr)
      .gt('end_time', startOfMonthStr)

    // 5. Fetch active recurring reservations for this barber
    const { data: recurringReservations } = await supabase
      .from('recurring_reservations')
      .select('day_of_week, time_slot, interval_weeks, start_date')
      .eq('barber_id', targetBarberId)
      .eq('status', 'active')

    // Group busy local minutes by date (YYYY-MM-DD)
    const parseToLocalMinutes = (isoString: string): number => {
      const localTime = new Date(isoString).toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
      return timeToMinutesLocal(localTime)
    }

    const parseToLocalDateStr = (isoString: string): string => {
      const localDate = new Date(isoString).toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
      return localDate.split('/').reverse().join('-') // YYYY-MM-DD
    }

    const busyIntervalsByDate = new Map<string, Array<{ start: number; end: number }>>()

    const addInterval = (dateStr: string, interval: { start: number; end: number }) => {
      if (!busyIntervalsByDate.has(dateStr)) {
        busyIntervalsByDate.set(dateStr, [])
      }
      busyIntervalsByDate.get(dateStr)!.push(interval)
    }

    appointments?.forEach(appt => {
      const dStr = parseToLocalDateStr(appt.start_time)
      addInterval(dStr, {
        start: parseToLocalMinutes(appt.start_time),
        end: parseToLocalMinutes(appt.end_time)
      })
    })

    blockedTimes?.forEach(bt => {
      const dStr = parseToLocalDateStr(bt.start_time)
      addInterval(bt.start_time.startsWith(dStr) ? dStr : parseToLocalDateStr(bt.start_time), {
        start: parseToLocalMinutes(bt.start_time),
        end: parseToLocalMinutes(bt.end_time)
      })
    })

    // Local today string to check past dates
    const now = new Date()
    const todayLocalStr = now.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).split('/').reverse().join('-')

    const currentLocalTime = now.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
    const currentMinutes = timeToMinutesLocal(currentLocalTime)

    const availability: Record<string, DayAvailability> = {}

    for (let dayVal = 1; dayVal <= lastDay; dayVal++) {
      const dateStr = `${year}-${formattedMonth}-${String(dayVal).padStart(2, '0')}`
      
      // In JS, new Date(year, monthIndex, day) creates date in local machine timezone
      // We will parse it carefully to get the correct day of week
      const dateObj = new Date(year, month - 1, dayVal)
      const dayOfWeek = dateObj.getDay()

      // 1. Check if date is in the past
      if (dateStr < todayLocalStr) {
        availability[dateStr] = { isClosed: false, isFullyBooked: false, hasSlots: false }
        continue
      }

      // 2. Check days off
      if (daysOffSet.has(dateStr)) {
        availability[dateStr] = { isClosed: true, isFullyBooked: false, hasSlots: false }
        continue
      }

      // 3. Check working hours
      const workingHours = workingHoursMap.get(dayOfWeek)
      if (!workingHours || workingHours.is_closed) {
        availability[dateStr] = { isClosed: true, isFullyBooked: false, hasSlots: false }
        continue
      }

      const slotsRanges = workingHours.slots as Array<{ start: string; end: string }>
      if (!slotsRanges || slotsRanges.length === 0) {
        availability[dateStr] = { isClosed: true, isFullyBooked: false, hasSlots: false }
        continue
      }

      // 4. Calculate slots
      const busyIntervals = [...(busyIntervalsByDate.get(dateStr) || [])]

      // Add recurring reservation blocking intervals for this day
      if (recurringReservations && recurringReservations.length > 0) {
        for (const res of recurringReservations) {
          if (res.day_of_week === dayOfWeek && isRecurringReservationActiveOnDate(res.start_date, res.interval_weeks, dateStr)) {
            const slotMinutes = timeToMinutesLocal(res.time_slot)
            busyIntervals.push({
              start: slotMinutes,
              end: slotMinutes + 60
            })
          }
        }
      }

      if (workingHours.lunch_break_start && typeof workingHours.lunch_break_start === 'string') {
        const lunchStartMin = timeToMinutesLocal(workingHours.lunch_break_start)
        busyIntervals.push({
          start: lunchStartMin,
          end: lunchStartMin + 60
        })
      }
      let totalSlotsCount = 0
      let availableSlotsCount = 0
      const timeStep = 60 // Check slots every 60 minutes

      for (const range of slotsRanges) {
        const rangeStart = timeToMinutesLocal(range.start)
        const rangeEnd = timeToMinutesLocal(range.end)

        let current = rangeStart
        while (current + serviceDuration <= rangeEnd) {
          const slotStart = current
          const slotEnd = current + serviceDuration
          totalSlotsCount++

          // Overlap check
          const overlaps = busyIntervals.some(busy => {
            return slotStart < busy.end && busy.start < slotEnd
          })

          if (!overlaps) {
            // Filter out past slots for today
            if (dateStr !== todayLocalStr || slotStart > currentMinutes) {
              availableSlotsCount++
            }
          }

          current += timeStep
        }
      }

      if (totalSlotsCount === 0) {
        availability[dateStr] = { isClosed: true, isFullyBooked: false, hasSlots: false }
      } else if (availableSlotsCount === 0) {
        availability[dateStr] = { isClosed: false, isFullyBooked: true, hasSlots: false }
      } else {
        availability[dateStr] = { isClosed: false, isFullyBooked: false, hasSlots: true }
      }
    }

    return { success: true, message: 'Sucesso', availability }
  } catch (error) {
    console.error('Error calculating month availability:', error)
    return { success: false, message: 'Não foi possível concluir a operação. Tente novamente em instantes.', availability: {} }
  }
}

