import { createServerSupabaseClient } from '@/lib/supabase'

// Sem 'use server' de proposito: as funcoes abaixo nao fazem nenhuma
// checagem de autenticacao/ownership sobre o customerId/appointmentId que
// recebem (confiam em quem chama ja ter validado a sessao). Com 'use server'
// no arquivo, cada export vira um Server Action invocavel via HTTP por
// qualquer requisicao -- o que tornaria markNoShowFeeCharged() um jeito de
// qualquer um zerar a propria taxa de no-show sem pagar, e
// getOutstandingNoShowFee() um jeito de consultar a taxa de qualquer
// customerId. Estas funcoes sao helpers server-only, chamadas apenas de
// dentro de outras Server Actions (agendar/actions.ts, agendamentos/actions.ts,
// financeiro/actions.ts) que ja autenticam antes de chamar.

export type NoShowFeeInfo = {
  hasFee: boolean
  fee: number
  originalAppointmentId: string
  serviceName: string
  date: string
}

/**
 * Check if a customer has an outstanding (uncharged) no-show fee.
 * Returns the fee details if found, or null if no outstanding fee exists.
 *
 * This function is intentionally isolated so it can be reused:
 * - In the booking flow (informational banner + price adjustment)
 * - In a future blocking check (if the barbershop decides to block bookings until the fee is paid)
 */
export async function getOutstandingNoShowFee(customerId: string): Promise<NoShowFeeInfo | null> {
  if (!customerId) return null

  try {
    const supabase = await createServerSupabaseClient()

    const { data: noShowAppt } = await supabase
      .from('appointments')
      .select(`
        id,
        start_time,
        no_show,
        no_show_fee_charged,
        service_id,
        services (name, price)
      `)
      .eq('customer_id', customerId)
      .eq('no_show', true)
      .eq('no_show_fee_charged', false)
      .order('start_time', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!noShowAppt) return null

    const service = noShowAppt.services as any
    const originalPrice = Number(service?.price || 0)
    const fee = originalPrice * 0.5

    // Format date for display
    const dateObj = new Date(noShowAppt.start_time)
    const formattedDate = dateObj.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })

    return {
      hasFee: true,
      fee,
      originalAppointmentId: noShowAppt.id,
      serviceName: service?.name || 'Serviço',
      date: formattedDate
    }
  } catch (err) {
    console.error('Error checking no-show fee:', err)
    return null
  }
}

/**
 * Mark a no-show fee as charged (resolved).
 * Called when the new appointment that included the fee reaches 'completed' status
 * or when its payment is confirmed as paid.
 */
export async function markNoShowFeeCharged(originalAppointmentId: string): Promise<boolean> {
  if (!originalAppointmentId) return false

  try {
    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('appointments')
      .update({ no_show_fee_charged: true })
      .eq('id', originalAppointmentId)
      .eq('no_show', true)

    if (error) {
      console.error('Error marking no-show fee as charged:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('Error in markNoShowFeeCharged:', err)
    return false
  }
}

/**
 * Resolve any outstanding no-show fees for a customer.
 * Called when an appointment is completed or payment is confirmed.
 */
export async function resolveNoShowFeeForCustomer(customerId: string): Promise<void> {
  if (!customerId) return

  try {
    const feeInfo = await getOutstandingNoShowFee(customerId)
    if (feeInfo) {
      await markNoShowFeeCharged(feeInfo.originalAppointmentId)
    }
  } catch (err) {
    console.error('Error resolving no-show fee for customer:', err)
  }
}
