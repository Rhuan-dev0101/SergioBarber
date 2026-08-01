'use server'

import { createServerSupabaseClient } from '@/lib/supabase'

export type CancelResponse = {
  success: boolean
  message: string
}

/**
 * Server Action to cancel a customer appointment.
 * Validates ownership and the 1-hour cancellation time window.
 */
export async function cancelAppointmentAction(appointmentId: string): Promise<CancelResponse> {
  if (!appointmentId) {
    return { success: false, message: 'ID do agendamento inválido.' }
  }

  try {
    const supabase = await createServerSupabaseClient()

    // 1. Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, message: 'Sessão expirada. Faça login novamente.' }
    }

    // 2. Fetch appointment details (checks ownership to prevent IDOR)
    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .select('id, start_time, customer_id, status')
      .eq('id', appointmentId)
      .eq('customer_id', user.id) // IDOR check
      .single()

    if (apptError || !appointment) {
      return { success: false, message: 'Agendamento não encontrado ou acesso não autorizado.' }
    }

    if (appointment.status === 'cancelled') {
      return { success: false, message: 'Este agendamento já está cancelado.' }
    }

    // 3. Verify cancellation time window (minimum 1 hour before appointment start)
    const nowObj = new Date()
    const startTimeObj = new Date(appointment.start_time)
    
    // Difference in milliseconds
    const diffMs = startTimeObj.getTime() - nowObj.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)

    if (diffHours < 1) {
      return { 
        success: false, 
        message: 'Cancelamentos só são permitidos com antecedência mínima de 1 hora. Caso precise cancelar urgente, entre em contato via WhatsApp.' 
      }
    }

    // 4. Perform cancel update
    const { error: updateError } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointmentId)

    if (updateError) {
      console.error('Error cancelling appointment:', updateError)
      return { success: false, message: 'Erro ao processar cancelamento no banco de dados.' }
    }

    // Optionally set payment status to 'refunded' if it was paid
    await supabase
      .from('payments')
      .update({ status: 'refunded', notes: 'Cancelamento efetuado pelo cliente.' })
      .eq('appointment_id', appointmentId)

    return { success: true, message: 'Agendamento cancelado com sucesso.' }
  } catch (err) {
    console.error('Error inside cancelAppointmentAction:', err)
    return { success: false, message: 'Erro interno no servidor ao cancelar agendamento.' }
  }
}

/**
 * Server Action to update user profile information.
 */
export async function updateProfileAction(fullName: string, phone: string): Promise<CancelResponse> {
  if (!fullName || !phone) {
    return { success: false, message: 'Por favor, preencha todos os campos obrigatórios.' }
  }

  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return { success: false, message: 'Sessão expirada.' }
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        phone: phone,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (profileError) {
      console.error('Profile update error:', profileError)
      return { success: false, message: 'Erro ao atualizar dados cadastrais.' }
    }

    return { success: true, message: 'Dados cadastrais atualizados com sucesso.' }
  } catch (err) {
    console.error('Error inside updateProfileAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}
