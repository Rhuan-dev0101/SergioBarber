import { addWeeks } from 'date-fns'

/**
 * Calculate precise weekly session dates for a given start date and duration in months (1, 4, or 6).
 * Business rule: FIXED 4 sessions per month (1m = 4, 4m = 16, 6m = 24).
 */
export function getSessionDatesForDuration(startDateStr: string, durationMonths: number): string[] {
  if (!startDateStr || !durationMonths) return []
  const [y, m, d] = startDateStr.split('-').map(Number)
  const baseDate = new Date(y, m - 1, d)

  const targetCount = durationMonths * 4
  const sessionDates: string[] = []
  let current = new Date(baseDate)

  for (let i = 0; i < targetCount; i++) {
    const curY = current.getFullYear()
    const curM = String(current.getMonth() + 1).padStart(2, '0')
    const curD = String(current.getDate()).padStart(2, '0')
    sessionDates.push(`${curY}-${curM}-${curD}`)
    current = addWeeks(current, 1)
  }

  return sessionDates
}

/**
 * Generate candidate dates given a start date and duration in months (1, 4, or 6).
 * Fixed weekly dates for the package duration (1m = 4, 4m = 16, 6m = 24).
 * Excluded (deselected) dates are simply removed without adding extra compensation weeks at the end.
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
  const excludedSet = new Set(excludedDates)

  const candidateDates = baseDates
  const selectedDates = baseDates.filter(d => !excludedSet.has(d))
  const targetSessions = selectedDates.length

  return { baseDates, candidateDates, selectedDates, targetSessions }
}

