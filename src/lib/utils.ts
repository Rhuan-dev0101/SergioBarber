export function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ')
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

