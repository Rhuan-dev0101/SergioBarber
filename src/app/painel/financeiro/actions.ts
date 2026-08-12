'use server'

import { createServerSupabaseClient } from '@/lib/supabase'
import { resolveNoShowFeeForCustomer } from '@/lib/no-show'

export type PayActionResponse = {
  success: boolean
  message: string
}

async function verifyAdminSession() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile && (profile.role === 'admin' || profile.role === 'barber')
}

/**
 * Confirm a pending payment entry (marks Pix signal as cleared)
 */
export async function confirmPaymentAction(
  paymentId: string,
  newStatus: 'confirmed_manually' | 'paid' | 'refunded'
): Promise<PayActionResponse> {
  const isAdmin = await verifyAdminSession()
  if (!isAdmin) return { success: false, message: 'Acesso restrito a administradores.' }

  if (!paymentId || !newStatus) {
    return { success: false, message: 'Parâmetros inválidos.' }
  }

  try {
    const supabase = await createServerSupabaseClient()

    // Handle package payments
    if (paymentId.startsWith('pkg_')) {
      const packageId = paymentId.replace('pkg_', '')
      
      if (newStatus === 'confirmed_manually' || newStatus === 'paid') {
        const { error } = await supabase
          .from('package_subscriptions')
          .update({ payment_status: 'paid', updated_at: new Date().toISOString() })
          .eq('id', packageId)
          
        if (error) {
          console.error('Error marking package as paid:', error)
          return { success: false, message: 'Erro ao liquidar o pagamento do pacote.' }
        }
        return { success: true, message: 'Pacote liquidado como pago!' }
      } else if (newStatus === 'refunded') {
        const { error: subError } = await supabase
          .from('package_subscriptions')
          .update({ status: 'cancelled', payment_status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('id', packageId)
          
        if (subError) {
          console.error('Error cancelling package subscription:', subError)
          return { success: false, message: 'Erro ao estornar/cancelar o pacote.' }
        }
        
        const now = new Date().toISOString()
        const { data: futureAppts } = await supabase
          .from('appointments')
          .select('id')
          .eq('package_subscription_id', packageId)
          .neq('status', 'completed')
          .neq('status', 'cancelled')
          .gte('start_time', now)
          
        if (futureAppts && futureAppts.length > 0) {
          const ids = futureAppts.map(a => a.id)
          await supabase
            .from('appointments')
            .update({ status: 'cancelled' })
            .in('id', ids)
            
          await supabase
            .from('payments')
            .update({ status: 'refunded', notes: 'Pacote estornado pelo administrador.' })
            .in('appointment_id', ids)
        }
        return { success: true, message: 'Pacote estornado e agendamentos futuros cancelados com sucesso.' }
      }
    }

    // 1. Fetch payment and linked appointment
    const { data: payment } = await supabase
      .from('payments')
      .select('appointment_id')
      .eq('id', paymentId)
      .single()

    if (!payment) {
      return { success: false, message: 'Registro de pagamento não localizado.' }
    }

    // 2. Update payment status
    const { error: payError } = await supabase
      .from('payments')
      .update({ status: newStatus })
      .eq('id', paymentId)

    if (payError) {
      console.error('Error updating payment status:', payError)
      return { success: false, message: 'Erro ao liquidar o pagamento no banco de dados.' }
    }

    // 3. If confirming deposit, auto-confirm the linked appointment
    if (newStatus === 'confirmed_manually' || newStatus === 'paid') {
      const { error: apptError } = await supabase
        .from('appointments')
        .update({ status: 'confirmed' })
        .eq('id', payment.appointment_id)
        .eq('status', 'pending') // only update if currently pending

      if (apptError) {
        console.error('Error auto-confirming appointment:', apptError)
      }

      // Resolve outstanding no-show fees when payment is confirmed
      const { data: paidAppt } = await supabase
        .from('appointments')
        .select('customer_id')
        .eq('id', payment.appointment_id)
        .single()

      if (paidAppt?.customer_id) {
        await resolveNoShowFeeForCustomer(paidAppt.customer_id)
      }
    } else if (newStatus === 'refunded') {
      const { error: apptError } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', payment.appointment_id)

      if (apptError) {
        console.error('Error auto-cancelling refunded appointment:', apptError)
      }
    }

    return { success: true, message: 'Transação financeira liquidada com sucesso!' }
  } catch (err) {
    console.error('Error inside confirmPaymentAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}
