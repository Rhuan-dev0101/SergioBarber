import { addWeeks } from 'date-fns'

/**
 * Calculate precise weekly session dates for a given start date and duration in months (1, 4, or 6).
 */
export function getSessionDatesForDuration(startDateStr: string, durationMonths: number): string[] {
  if (!startDateStr || !durationMonths) return []
  const [y, m, d] = startDateStr.split('-').map(Number)
  const baseDate = new Date(y, m - 1, d)
  const endDate = new Date(y, (m - 1) + durationMonths, d)

  const sessionDates: string[] = []
  let current = new Date(baseDate)

  while (current <= endDate) {
    const curY = current.getFullYear()
    const curM = String(current.getMonth() + 1).padStart(2, '0')
    const curD = String(current.getDate()).padStart(2, '0')
    sessionDates.push(`${curY}-${curM}-${curD}`)
    current = addWeeks(current, 1)
  }

  return sessionDates
}
