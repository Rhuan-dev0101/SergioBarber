'use server'

import { createServerSupabaseClient } from '@/lib/supabase'
import { getBusinessSettings, formatPhoneNumber } from '@/lib/settings'

export interface ReceiptItem {
  name: string
  duration?: number
  quantity: number
  price: number
}

export interface ReceiptData {
  receiptNumber: number | string
  paymentDate: string
  businessName: string
  businessAddress: string
  businessWhatsapp: string
  customerName: string
  barberName?: string
  items: ReceiptItem[]
  hasNoShowFee: boolean
  noShowFeeAmount: number
  subtotal: number
  totalAmount: number
  paymentMethod: string
  status: string
}

export type ReceiptActionResponse = {
  success: boolean
  message?: string
  data?: ReceiptData
}

/**
 * Fetch full receipt details by paymentId or appointmentId.
 * If receipt_number is missing on a paid record, assign the next available number.
 */
export async function getReceiptDataAction(
  params: { paymentId?: string; appointmentId?: string }
): Promise<ReceiptActionResponse> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, message: 'Não autenticado.' }
    }

    // Esta action e' usada hoje apenas pelo painel de staff (ReceiptModal em
    // /painel/agendamentos e /painel/financeiro) e aceita paymentId/appointmentId
    // arbitrarios sem filtrar por dono -- sem esta checagem, qualquer cliente
    // autenticado poderia chamar a action diretamente (Server Actions sao
    // endpoints HTTP normais) e ler nome, servico e valor de QUALQUER outro
    // cliente pelo ID. Restringe a admin/barber ate' existir um fluxo de
    // recibo para o proprio cliente (que exigiria checar ownership em vez de role).
    const { data: staffProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!staffProfile || (staffProfile.role !== 'admin' && staffProfile.role !== 'barber')) {
      return { success: false, message: 'Não autorizado.' }
    }

    // 1. Fetch Business Settings
    const settings = await getBusinessSettings()
    const businessName = settings?.pixName || 'Osanchez Barbearia'
    const businessAddress = settings?.address || 'Endereço não cadastrado'
    const businessWhatsapp = settings?.whatsapp ? formatPhoneNumber(settings.whatsapp) : 'Não informado'

    let paymentRecord: any = null

    if (params.paymentId) {
      // Handle package payments if prefixed with pkg_
      if (params.paymentId.startsWith('pkg_')) {
        const pkgId = params.paymentId.replace('pkg_', '')
        const { data: pkg } = await supabase
          .from('package_subscriptions')
          .select(`
            id,
            customer_id,
            package_price,
            payment_status,
            created_at,
            services (name, price, duration)
          `)
          .eq('id', pkgId)
          .single()

        if (!pkg) {
          return { success: false, message: 'Assinatura de pacote não encontrada.' }
        }

        let customerName = 'Cliente'
        if (pkg.customer_id) {
          const { data: custProf } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', pkg.customer_id)
            .single()
          if (custProf?.full_name) customerName = custProf.full_name
        }

        const pkgPrice = Number(pkg.package_price || 0)
        const serviceObj: any = Array.isArray(pkg.services) ? pkg.services[0] : pkg.services
        const sName = serviceObj?.name ? `Pacote: ${serviceObj.name}` : 'Pacote Mensal'

        return {
          success: true,
          data: {
            receiptNumber: `PKG-${pkg.id.substring(0, 6).toUpperCase()}`,
            paymentDate: pkg.created_at,
            businessName,
            businessAddress,
            businessWhatsapp,
            customerName,
            items: [
              {
                name: sName,
                duration: undefined,
                quantity: 1,
                price: pkgPrice
              }
            ],
            hasNoShowFee: false,
            noShowFeeAmount: 0,
            subtotal: pkgPrice,
            totalAmount: pkgPrice,
            paymentMethod: 'pix',
            status: pkg.payment_status || 'paid'
          }
        }
      }

      // Query standard payments by ID
      const { data: pay } = await supabase
        .from('payments')
        .select(`
          id,
          receipt_number,
          appointment_id,
          total_amount,
          deposit_amount,
          status,
          method,
          notes,
          created_at,
          appointments (
            id,
            customer_id,
            barber_id,
            start_time,
            notes,
            no_show_fee_charged,
            services (name, price, duration)
          )
        `)
        .eq('id', params.paymentId)
        .single()

      paymentRecord = pay
    } else if (params.appointmentId) {
      const { data: pay } = await supabase
        .from('payments')
        .select(`
          id,
          receipt_number,
          appointment_id,
          total_amount,
          deposit_amount,
          status,
          method,
          notes,
          created_at,
          appointments (
            id,
            customer_id,
            barber_id,
            start_time,
            notes,
            no_show_fee_charged,
            services (name, price, duration)
          )
        `)
        .eq('appointment_id', params.appointmentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      paymentRecord = pay
    }

    if (!paymentRecord) {
      return { success: false, message: 'Registro de pagamento não localizado.' }
    }

    // Ensure receipt_number is assigned if status is paid/confirmed_manually but receipt_number is null
    let receiptNum = paymentRecord.receipt_number
    if (!receiptNum && (paymentRecord.status === 'paid' || paymentRecord.status === 'confirmed_manually')) {
      // Re-update payment row to trigger the DB sequence if missing
      const { data: updatedPay } = await supabase
        .from('payments')
        .update({ status: paymentRecord.status })
        .eq('id', paymentRecord.id)
        .select('receipt_number')
        .single()

      if (updatedPay?.receipt_number) {
        receiptNum = updatedPay.receipt_number
      } else {
        // Fallback fallback if trigger not run in DB yet
        receiptNum = 1000
      }
    }

    const appt: any = Array.isArray(paymentRecord.appointments) ? paymentRecord.appointments[0] : paymentRecord.appointments
    const service: any = appt?.services ? (Array.isArray(appt.services) ? appt.services[0] : appt.services) : null

    // Customer & Barber names
    let customerName = 'Cliente Presencial'
    let barberName = ''

    if (appt?.customer_id) {
      const { data: cProf } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', appt.customer_id)
        .single()
      if (cProf?.full_name) customerName = cProf.full_name
    } else if (appt?.notes && appt.notes.includes('[Walk-in] Cliente:')) {
      const match = appt.notes.match(/\[Walk-in\] Cliente:\s*([^.]+)/)
      if (match) customerName = match[1].trim()
    }

    if (appt?.barber_id) {
      const { data: bProf } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', appt.barber_id)
        .single()
      if (bProf?.full_name) barberName = bProf.full_name
    }

    const totalVal = Number(paymentRecord.total_amount || service?.price || 0)
    const servicePrice = Number(service?.price || totalVal)

    // Check if No-show fee was applied to this payment
    let hasNoShowFee = false
    let noShowFeeAmount = 0

    if (
      appt?.no_show_fee_charged ||
      (typeof paymentRecord.notes === 'string' && paymentRecord.notes.includes('Taxa no-show'))
    ) {
      hasNoShowFee = true
      noShowFeeAmount = Math.max(0, totalVal - servicePrice)
      if (noShowFeeAmount === 0 && servicePrice > 0) {
        // Default half of service price if total was calculated with fee included
        noShowFeeAmount = servicePrice * 0.5
      }
    }

    const items: ReceiptItem[] = []
    if (service) {
      items.push({
        name: service.name,
        duration: service.duration,
        quantity: 1,
        price: servicePrice
      })
    } else {
      items.push({
        name: 'Serviço Barbearia',
        quantity: 1,
        price: totalVal - noShowFeeAmount
      })
    }

    if (hasNoShowFee && noShowFeeAmount > 0) {
      items.push({
        name: 'Taxa de Não Compareceu (Anterior)',
        quantity: 1,
        price: noShowFeeAmount
      })
    }

    const subtotal = items.reduce((acc, item) => acc + item.price, 0)

    return {
      success: true,
      data: {
        receiptNumber: receiptNum || '1000',
        paymentDate: paymentRecord.created_at || new Date().toISOString(),
        businessName,
        businessAddress,
        businessWhatsapp,
        customerName,
        barberName,
        items,
        hasNoShowFee,
        noShowFeeAmount,
        subtotal,
        totalAmount: totalVal || subtotal,
        paymentMethod: paymentRecord.method || 'cash',
        status: paymentRecord.status || 'paid'
      }
    }
  } catch (err) {
    console.error('Error fetching receipt data:', err)
    return { success: false, message: 'Erro ao gerar dados do recibo.' }
  }
}
