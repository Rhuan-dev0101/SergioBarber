import { createAdminSupabaseClient } from './supabase'
function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

/**
 * Check if a recurring reservation is active on a specific date.
 * A reservation with interval_weeks=1 fires every week; interval_weeks=2 fires every other week.
 * Returns true if daysDiff >= 0 AND daysDiff is evenly divisible by (interval_weeks * 7).
 */
function isRecurringReservationActiveOnDate(
  startDateStr: string,
  intervalWeeks: number,
  targetDateStr: string
): boolean {
  const [sy, sm, sd] = startDateStr.split('-').map(Number)
  const [ty, tm, td] = targetDateStr.split('-').map(Number)
  const startDate = new Date(sy, sm - 1, sd)
  const targetDate = new Date(ty, tm - 1, td)
  const daysDiff = Math.round((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  if (daysDiff < 0) return false
  const intervalDays = intervalWeeks * 7
  return daysDiff % intervalDays === 0
}

export { isRecurringReservationActiveOnDate }

export async function getAvailableSlots(barberId: string, dateStr: string, serviceDuration: number, allowPast: boolean = false) {
  // Use admin client to bypass RLS and read ALL booked appointments across all customers
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

  // Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  // To avoid timezone shift, parse date manually
  const [year, month, day] = dateStr.split('-').map(Number)
  const dateObj = new Date(year, month - 1, day)
  const dayOfWeek = dateObj.getDay()

  const startOfDay = `${dateStr}T00:00:00-03:00`
  const endOfDay = `${dateStr}T23:59:59-03:00`

  // Fetch working hours, days off, appointments, blocked times, and recurring reservations in PARALLEL
  const [
    { data: workingHours },
    { data: dayOff },
    { data: appointments },
    { data: blockedTimes },
    { data: recurringReservations }
  ] = await Promise.all([
    supabase
      .from('barber_working_hours')
      .select('*')
      .eq('barber_id', targetBarberId)
      .eq('day_of_week', dayOfWeek)
      .single(),
    supabase
      .from('days_off')
      .select('*')
      .eq('barber_id', targetBarberId)
      .eq('date', dateStr)
      .single(),
    supabase
      .from('appointments')
      .select('start_time, end_time')
      .eq('barber_id', targetBarberId)
      .neq('status', 'cancelled')
      .lt('start_time', endOfDay)
      .gt('end_time', startOfDay),
    supabase
      .from('blocked_times')
      .select('start_time, end_time')
      .eq('barber_id', targetBarberId)
      .lt('start_time', endOfDay)
      .gt('end_time', startOfDay),
    supabase
      .from('recurring_reservations')
      .select('time_slot, interval_weeks, start_date')
      .eq('barber_id', targetBarberId)
      .eq('day_of_week', dayOfWeek)
      .eq('status', 'active')
  ])

  if (!workingHours || workingHours.is_closed || dayOff) {
    return [] // Closed or day off
  }

  // Map busy intervals by converting to Sao Paulo local minutes from midnight
  const parseToLocalMinutes = (isoString: string): number => {
    const localTime = new Date(isoString).toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
    return timeToMinutes(localTime)
  }

  const busyIntervals = [
    ...(appointments || []).map(a => ({
      start: parseToLocalMinutes(a.start_time),
      end: parseToLocalMinutes(a.end_time)
    })),
    ...(blockedTimes || []).map(b => ({
      start: parseToLocalMinutes(b.start_time),
      end: parseToLocalMinutes(b.end_time)
    }))
  ]

  // Add recurring reservation blocking intervals
  if (recurringReservations && recurringReservations.length > 0) {
    for (const res of recurringReservations) {
      if (isRecurringReservationActiveOnDate(res.start_date, res.interval_weeks, dateStr)) {
        const slotMinutes = timeToMinutes(res.time_slot)
        busyIntervals.push({
          start: slotMinutes,
          end: slotMinutes + 60 // Block a 60-minute window
        })
      }
    }
  }

  if (workingHours.lunch_break_start && typeof workingHours.lunch_break_start === 'string') {
    const lunchStartMin = timeToMinutes(workingHours.lunch_break_start)
    busyIntervals.push({
      start: lunchStartMin,
      end: lunchStartMin + 60
    })
  }

  const slotsRanges = workingHours.slots as Array<{ start: string; end: string }>
  if (!slotsRanges || slotsRanges.length === 0) return []

  const availableSlots: string[] = []
  const timeStep = 60 // Check slots every 60 minutes

  // Calculate current minutes if date is today to filter out past slots
  const now = new Date()
  const todayLocalStr = now.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).split('/').reverse().join('-') // yyyy-mm-dd

  const currentLocalTime = now.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  const currentMinutes = timeToMinutes(currentLocalTime)

  for (const range of slotsRanges) {
    const rangeStart = timeToMinutes(range.start)
    const rangeEnd = timeToMinutes(range.end)

    let current = rangeStart
    while (current + serviceDuration <= rangeEnd) {
      const slotStart = current
      const slotEnd = current + serviceDuration

      // Check overlaps
      const overlaps = busyIntervals.some(busy => {
        return slotStart < busy.end && busy.start < slotEnd
      })

      if (!overlaps) {
        // Filter out past times if today (unless allowPast is true)
        if (allowPast || dateStr !== todayLocalStr || slotStart > currentMinutes) {
          const hours = Math.floor(slotStart / 60)
          const mins = slotStart % 60
          const timeFormatted = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
          availableSlots.push(timeFormatted)
        }
      }

      current += timeStep
    }
  }

  return availableSlots
}

