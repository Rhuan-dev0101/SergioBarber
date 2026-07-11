'use server'

import { createServerSupabaseClient } from '@/lib/supabase'
import { getAvailableSlots } from '@/lib/booking'
import { addMinutes, format } from 'date-fns'

export type BookingResponse = {
  success: boolean
  message: string
  appointmentId?: string
}

export async function createAppointmentAction(
  barberId: string,
  serviceId: string,
  dateStr: string,
  timeStr: string,
  notes: string
): Promise<BookingResponse> {
  if (!barberId || !serviceId || !dateStr || !timeStr) {
    return { success: false, message: 'Todos os campos de agendamento são obrigatórios.' }
  }

  try {
    const supabase = await createServerSupabaseClient()

    // 1. Get authenticated user session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, message: 'Sessão expirada. Por favor, faça login novamente.' }
    }

    // 2. Fetch service details from DB (secure, avoids client-side price/duration tampering)
    let service: { name: string; duration: number; price: number; is_active: boolean } | null = null

    if (barberId === 'sergio-uuid' || barberId === 'enzo-uuid') {
      const mockServices = [
        { id: '1', name: 'Corte', duration: 60, price: 50.00, is_active: true },
        { id: '2', name: 'Cabelo + Barba', duration: 90, price: 85.00, is_active: true },
        { id: '3', name: 'Barba', duration: 30, price: 45.00, is_active: true }
      ]
      const found = mockServices.find(s => s.id === serviceId)
      if (found) {
        service = { name: found.name, duration: found.duration, price: found.price, is_active: found.is_active }
      }
    } else {
      const { data: barberService, error: serviceError } = await supabase
        .from('barber_services')
        .select('price, duration, is_active, services(name)')
        .eq('barber_id', barberId)
        .eq('service_id', serviceId)
        .single()

      if (!serviceError && barberService && barberService.is_active) {
        service = {
          name: (barberService.services as any)?.name || 'Serviço',
          duration: Number(barberService.duration),
          price: Number(barberService.price),
          is_active: barberService.is_active
        }
      }
    }

    if (!service || !service.is_active) {
      return { success: false, message: 'Serviço selecionado inválido ou inativo para este profissional.' }
    }

    // 3. Verify availability (Double-booking prevention rule)
    const duration = service.duration
    const availableSlots = await getAvailableSlots(barberId, dateStr, duration)

    if (!availableSlots.includes(timeStr)) {
      return { success: false, message: 'Desculpe, este horário não está mais disponível. Escolha outro.' }
    }

    // 4. Construct start and end timestamps in Sao Paulo timezone (UTC-3)
    const startTimeStr = `${dateStr}T${timeStr}:00-03:00`
    const startDate = new Date(startTimeStr)
    const endDate = addMinutes(startDate, duration)
    const endTimeStr = endDate.toISOString() // UTC format standard

    // 5. Insert appointment
    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .insert({
        customer_id: user.id,
        barber_id: barberId,
        service_id: serviceId,
        start_time: startDate.toISOString(),
        end_time: endTimeStr,
        status: 'pending',
        notes: notes || null
      })
      .select('id')
      .single()

    if (apptError || !appointment) {
      console.error('Error inserting appointment:', apptError)
      return { success: false, message: 'Erro ao registrar agendamento no banco de dados.' }
    }

    // 6. Compute 50% signal setup & Insert payment entry
    const totalAmount = Number(service.price)
    const depositAmount = totalAmount * 0.5

    const { error: payError } = await supabase
      .from('payments')
      .insert({
        appointment_id: appointment.id,
        total_amount: totalAmount,
        deposit_amount: depositAmount,
        status: 'pending',
        method: 'pix',
        notes: `Sinal Pix de 50% gerado para o serviço: ${service.name}`
      })

    if (payError) {
      console.error('Error inserting payment log:', payError)
      // We don't rollback the appointment as it's created, but log the error
    }

    return { 
      success: true, 
      message: 'Agendamento pré-confirmado com sucesso!', 
      appointmentId: appointment.id 
    }
  } catch (err) {
    console.error('Error in createAppointmentAction:', err)
    return { success: false, message: 'Ocorreu um erro interno no servidor ao realizar o agendamento.' }
  }
}
