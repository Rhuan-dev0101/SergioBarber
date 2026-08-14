import { NextRequest, NextResponse } from 'next/server'
import { getAvailableSlots } from '@/lib/booking'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const barberId = searchParams.get('barberId')
  const dateStr = searchParams.get('dateStr')
  const durationStr = searchParams.get('duration')

  const allowPast = searchParams.get('allowPast') === 'true'

  if (!barberId || !dateStr || !durationStr) {
    return NextResponse.json({ error: 'Parâmetros ausentes.' }, { status: 400 })
  }

  const duration = parseInt(durationStr, 10)
  if (isNaN(duration)) {
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
