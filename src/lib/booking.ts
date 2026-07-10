import { createServerSupabaseClient } from './supabase'

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

export async function getAvailableSlots(barberId: string, dateStr: string, serviceDuration: number) {
  const supabase = await createServerSupabaseClient()
  
  // Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  // To avoid timezone shift, parse date manually
  const [year, month, day] = dateStr.split('-').map(Number)
  const dateObj = new Date(year, month - 1, day)
  const dayOfWeek = dateObj.getDay()

  // 1. Fetch working hours for the selected barber and day of week
  const { data: workingHours } = await supabase
    .from('barber_working_hours')
    .select('*')
    .eq('barber_id', barberId)
    .eq('day_of_week', dayOfWeek)
    .single()

  if (!workingHours || workingHours.is_closed) {
    return [] // Closed
  }

  // 2. Fetch days off
  const { data: dayOff } = await supabase
    .from('days_off')
    .select('*')
    .eq('barber_id', barberId)
    .eq('date', dateStr)
    .single()

  if (dayOff) {
    return [] // Day off
  }

  // 3. Fetch appointments (in UTC)
  // Fetch everything starting on this day in local timezone (UTC-3).
  // Safe boundaries: dateStr + T00:00:00-03:00 to T23:59:59-03:00
  const startOfDay = `${dateStr}T00:00:00-03:00`
  const endOfDay = `${dateStr}T23:59:59-03:00`

  const { data: appointments } = await supabase
    .from('appointments')
    .select('start_time, end_time')
    .eq('barber_id', barberId)
    .neq('status', 'cancelled')
    .gte('start_time', startOfDay)
    .lte('end_time', endOfDay)

  // 4. Fetch blocked times
  const { data: blockedTimes } = await supabase
    .from('blocked_times')
    .select('start_time, end_time')
    .eq('barber_id', barberId)
    .gte('start_time', startOfDay)
    .lte('end_time', endOfDay)

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

  const slotsRanges = workingHours.slots as Array<{ start: string; end: string }>
  if (!slotsRanges || slotsRanges.length === 0) return []

  const availableSlots: string[] = []
  const timeStep = 30 // Check slots every 30 minutes

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
        // Filter out past times if today
        if (dateStr !== todayLocalStr || slotStart > currentMinutes) {
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
