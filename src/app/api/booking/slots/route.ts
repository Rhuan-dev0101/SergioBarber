import { NextRequest, NextResponse } from 'next/server'
import { getAvailableSlots } from '@/lib/booking'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Ids placeholder que getAvailableSlots resolve para o barbeiro real.
const BARBER_ID_RE = new RegExp(`${UUID_RE.source}|^(sergio|enzo)-uuid$`, 'i')
const MAX_DURATION_MIN = 480

function isValidDateStr(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const barberId = searchParams.get('barberId')
  const dateStr = searchParams.get('dateStr')
  const durationStr = searchParams.get('duration')

  const allowPast = searchParams.get('allowPast') === 'true'

  if (!barberId || !dateStr || !durationStr) {
    return NextResponse.json({ error: 'Parâmetros ausentes.' }, { status: 400 })
  }

  // Validacao antes de qualquer acesso ao banco (usa client admin).
  if (!BARBER_ID_RE.test(barberId)) {
    return NextResponse.json({ error: 'Barbeiro inválido.' }, { status: 400 })
  }
  if (!isValidDateStr(dateStr)) {
    return NextResponse.json({ error: 'Data inválida.' }, { status: 400 })
  }
  const duration = /^\d{1,3}$/.test(durationStr) ? parseInt(durationStr, 10) : NaN
  if (!Number.isInteger(duration) || duration < 1 || duration > MAX_DURATION_MIN) {
    return NextResponse.json({ error: 'Duração inválida.' }, { status: 400 })
  }

  try {
    const slots = await getAvailableSlots(barberId, dateStr, duration, allowPast)
    return NextResponse.json({ slots })
  } catch (error) {
    console.error('Error fetching slots inside API route:', error)
    return NextResponse.json({ error: 'Erro ao calcular horários livres.' }, { status: 500 })
  }
}
