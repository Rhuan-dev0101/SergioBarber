export function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ')
}

/**
 * Valida que um destino de redirecionamento pós-login (vindo de query string,
 * portanto controlado pelo atacante) é um path interno do app, nunca uma URL
 * externa. Bloqueia `https://evil.com`, `//evil.com` (protocol-relative) e
 * `/\evil.com` (alguns navegadores tratam backslash como barra).
 * Usado em /entrar, /aceite e /auth/callback antes de qualquer redirect.
 */
export function sanitizeRedirectPath(path: string | null | undefined, fallback: string = '/cliente'): string {
  if (!path) return fallback
  if (!/^\/(?!\/|\\)/.test(path)) return fallback
  return path
}

/**
 * Derives a short human-readable reference code from an appointment UUID.
 * Takes the first 6 characters of the UUID and uppercases them, then
 * prefixes with "#" — e.g. "dd33ce7c-d637-..." → "#DD33CE".
 *
 * Used consistently in:
 *   - WhatsApp proof-of-payment message (agendar/page.tsx)
 *   - Admin appointments panel (/painel/agendamentos/page.tsx)
 *   - Customer appointments view (/cliente/page.tsx)
 */
export function apptShortCode(appointmentId: string): string {
  if (!appointmentId) return '#------'
  return '#' + appointmentId.replace(/-/g, '').slice(0, 6).toUpperCase()
}

/**
 * Safely converts an ISO timestamp string or Date object into a local date string ("YYYY-MM-DD")
 * in the specified timezone (default: 'America/Sao_Paulo').
 *
 * Avoids naive string splitting (`isoStr.split('T')[0]`), which causes timezone shifts
 * for evening/night appointments (e.g. 21:00 BRT is 00:00 UTC next day).
 */
export function getLocalDateStr(dateInput: string | Date, timeZone: string = 'America/Sao_Paulo'): string {
  if (!dateInput) return ''
  const dateObj = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  if (isNaN(dateObj.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(dateObj)
}


