'use server'

import { createServerSupabaseClient } from '@/lib/supabase'

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

  return profile && profile.role === 'admin'
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
