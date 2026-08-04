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

/**
 * Generate candidate dates given a start date, duration in months, and a list of excluded (deselected) dates.
 * Keeps adding weekly compensation dates until the count of selected (non-excluded) dates equals targetSessions.
 */
export function getExpandedSessionDates(
  startDateStr: string,
  durationMonths: number,
  excludedDates: string[] = []
): { baseDates: string[]; candidateDates: string[]; selectedDates: string[]; targetSessions: number } {
  if (!startDateStr || !durationMonths) {
    return { baseDates: [], candidateDates: [], selectedDates: [], targetSessions: 0 }
  }

  const baseDates = getSessionDatesForDuration(startDateStr, durationMonths)
  const targetSessions = baseDates.length

  const excludedSet = new Set(excludedDates)
  const [y, m, d] = startDateStr.split('-').map(Number)
  let current = new Date(y, m - 1, d)

  const candidateDates: string[] = []
  const selectedDates: string[] = []

  let safetyLimit = 0
  while (selectedDates.length < targetSessions && safetyLimit < targetSessions + 52) {
    const curY = current.getFullYear()
    const curM = String(current.getMonth() + 1).padStart(2, '0')
    const curD = String(current.getDate()).padStart(2, '0')
    const dateStr = `${curY}-${curM}-${curD}`

    candidateDates.push(dateStr)
    if (!excludedSet.has(dateStr)) {
      selectedDates.push(dateStr)
    }

    current = addWeeks(current, 1)
    safetyLimit++
  }

  return { baseDates, candidateDates, selectedDates, targetSessions }
}
