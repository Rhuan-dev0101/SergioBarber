import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'crypto'
import { sendEmail } from '@/lib/email'
import { formatWhatsAppLink } from '@/lib/settings'

function isValidCronToken(token: string, secret: string): boolean {
  const tokenBuf = Buffer.from(token)
  const secretBuf = Buffer.from(secret)
  if (tokenBuf.length !== secretBuf.length) return false
  return timingSafeEqual(tokenBuf, secretBuf)
}

export const dynamic = 'force-dynamic'

/**
 * Secured cron endpoint: sends appointment reminder emails ~3 hours before.
 * Triggered by an external cron service every ~15 minutes.
 *
 * Security: requires Authorization: Bearer <CRON_SECRET> header.
 */
export async function GET(request: NextRequest) {
  // ─── 1. Auth check ───────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[Cron Reminders] CRON_SECRET env var is not configured.')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token || !isValidCronToken(token, cronSecret)) {
    console.warn('[Cron Reminders] Unauthorized request — invalid or missing Bearer token.')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ─── 2. Supabase admin client (bypasses RLS) ─────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Cron Reminders] Missing Supabase env vars.')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // ─── 3. Calculate the 3-hour reminder window ─────────────────
  const now = new Date()
  const windowStart = new Date(now.getTime() + 2 * 60 * 60 * 1000 + 55 * 60 * 1000) // now + 2h55m
  const windowEnd = new Date(now.getTime() + 3 * 60 * 60 * 1000 + 5 * 60 * 1000)   // now + 3h05m

  console.log(`[Cron Reminders] Running at ${now.toISOString()}`)
  console.log(`[Cron Reminders] Window: ${windowStart.toISOString()} → ${windowEnd.toISOString()}`)

  // ─── 4. Query matching appointments ──────────────────────────
  const { data: appointments, error: queryError } = await supabase
    .from('appointments')
    .select(`
      id,
      start_time,
      customer_id,
      barber_id,
      service_id,
      services ( name ),
      status
    `)
    .gte('start_time', windowStart.toISOString())
    .lte('start_time', windowEnd.toISOString())
    .in('status', ['confirmed', 'pending'])
    .eq('reminder_sent', false)

  if (queryError) {
    console.error('[Cron Reminders] Query error:', queryError)
    return NextResponse.json({ error: 'Database query failed' }, { status: 500 })
  }

  if (!appointments || appointments.length === 0) {
    console.log('[Cron Reminders] No appointments found in the reminder window.')
    return NextResponse.json({ message: 'No reminders to send', processed: 0 })
  }

  console.log(`[Cron Reminders] Found ${appointments.length} appointment(s) to remind.`)

  // ─── 5. Fetch related data (customer profiles, barber names, business settings) ──
  const customerIds = [...new Set(appointments.map(a => a.customer_id).filter(Boolean))]
  const barberIds = [...new Set(appointments.map(a => a.barber_id))]
  const allProfileIds = [...new Set([...customerIds, ...barberIds])]

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', allProfileIds)

  const profileMap = new Map(
    (profiles || []).map(p => [p.id, { full_name: p.full_name, email: p.email }])
  )

  // Fetch WhatsApp number from business_settings
  let whatsappPhone = ''
  const { data: settingsData } = await supabase
    .from('business_settings')
    .select('value')
    .eq('key', 'general_settings')
    .single()

  if (settingsData?.value && typeof settingsData.value === 'object') {
    whatsappPhone = (settingsData.value as Record<string, string>).whatsapp || ''
  }

  // ─── 6. Send emails and update flags ─────────────────────────
  let sent = 0
  let failed = 0
  const results: Array<{ appointmentId: string; status: string; error?: string }> = []

  for (const appt of appointments) {
    const customer = profileMap.get(appt.customer_id)
    const barber = profileMap.get(appt.barber_id)
    const serviceName = (appt.services as any)?.name || 'Serviço'

    // Skip walk-in appointments without customer profile or email
    if (!customer?.email) {
      console.log(`[Cron Reminders] Skipping appointment ${appt.id} — no customer email.`)
      // Still mark as sent so we don't retry endlessly
      await supabase
        .from('appointments')
        .update({ reminder_sent: true })
        .eq('id', appt.id)
      results.push({ appointmentId: appt.id, status: 'skipped_no_email' })
      continue
    }

    // Format date/time in São Paulo timezone
    const startDate = new Date(appt.start_time)
    const dateFormatted = startDate.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
    const timeFormatted = startDate.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })

    const customerName = customer.full_name || 'Cliente'
    const barberName = barber?.full_name || 'Profissional'

    // Build WhatsApp cancel link
    const cancelMessage = `Olá, preciso cancelar/reagendar meu horário de ${timeFormatted} do dia ${dateFormatted}. Meu nome: ${customerName}.`
    const whatsappLink = formatWhatsAppLink(whatsappPhone, cancelMessage)

    const emailHtml = buildReminderEmailHtml({
      customerName,
      barberName,
      serviceName,
      dateFormatted,
      timeFormatted,
      whatsappLink,
    })

    try {
      await sendEmail({
        to: customer.email,
        subject: `⏰ Lembrete: seu horário na Osanchez Barbearia é em 3 horas!`,
        html: emailHtml,
      })

      // Mark as sent
      await supabase
        .from('appointments')
        .update({ reminder_sent: true })
        .eq('id', appt.id)

      sent++
      results.push({ appointmentId: appt.id, status: 'sent' })
      console.log(`[Cron Reminders] ✅ Email sent for appointment ${appt.id} to ${customer.email}`)
    } catch (emailError: any) {
      failed++
      const errorMsg = emailError?.message || 'Unknown error'
      results.push({ appointmentId: appt.id, status: 'failed', error: errorMsg })
      console.error('[Cron Reminders] ❌ Failed to send email for appointment', appt.id, ':', errorMsg)
    }
  }

  console.log(`[Cron Reminders] Done. Sent: ${sent}, Failed: ${failed}, Total: ${appointments.length}`)
  return NextResponse.json({
    message: 'Reminder cron completed',
    processed: appointments.length,
    sent,
    failed,
    results,
  })
}

// ─── Email HTML Template ─────────────────────────────────────────
interface ReminderEmailData {
  customerName: string
  barberName: string
  serviceName: string
  dateFormatted: string
  timeFormatted: string
  whatsappLink: string
}

function buildReminderEmailHtml(data: ReminderEmailData): string {
  const { customerName, barberName, serviceName, dateFormatted, timeFormatted, whatsappLink } = data

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lembrete de Agendamento</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f3ee; font-family: Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f3ee; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color: #09090b; padding: 32px 24px; text-align: center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="font-size: 28px; font-weight: 700; color: #c5a880; letter-spacing: 2px; font-family: Georgia, 'Times New Roman', serif;">
                    OSANCHEZ
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 11px; color: #8a8478; letter-spacing: 4px; text-transform: uppercase; padding-top: 4px; font-family: Arial, Helvetica, sans-serif;">
                    BARBEARIA
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Clock Icon & Title -->
          <tr>
            <td style="padding: 32px 32px 8px; text-align: center;">
              <div style="font-size: 40px; margin-bottom: 12px;">⏰</div>
              <h1 style="margin: 0; font-size: 22px; color: #1c1b18; font-family: Georgia, 'Times New Roman', serif; font-weight: 700;">
                Seu horário é em 3 horas!
              </h1>
              <p style="margin: 8px 0 0; font-size: 15px; color: #7c766a;">
                Olá, <strong style="color: #1c1b18;">${customerName}</strong>! Este é um lembrete do seu agendamento.
              </p>
            </td>
          </tr>

          <!-- Appointment Details Card -->
          <tr>
            <td style="padding: 16px 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #faf9f6; border: 1px solid #e3ded6; border-radius: 10px; overflow: hidden;">
                <!-- Date -->
                <tr>
                  <td style="padding: 16px 20px 8px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size: 18px; padding-right: 10px; vertical-align: middle;">📅</td>
                        <td>
                          <div style="font-size: 11px; color: #8a8478; text-transform: uppercase; letter-spacing: 1px; font-family: Arial, Helvetica, sans-serif;">Data</div>
                          <div style="font-size: 15px; color: #1c1b18; font-weight: 600; font-family: Arial, Helvetica, sans-serif; text-transform: capitalize;">${dateFormatted}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Time -->
                <tr>
                  <td style="padding: 8px 20px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size: 18px; padding-right: 10px; vertical-align: middle;">🕐</td>
                        <td>
                          <div style="font-size: 11px; color: #8a8478; text-transform: uppercase; letter-spacing: 1px; font-family: Arial, Helvetica, sans-serif;">Horário</div>
                          <div style="font-size: 15px; color: #1c1b18; font-weight: 600; font-family: Arial, Helvetica, sans-serif;">${timeFormatted}h</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Barber -->
                <tr>
                  <td style="padding: 8px 20px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size: 18px; padding-right: 10px; vertical-align: middle;">💈</td>
                        <td>
                          <div style="font-size: 11px; color: #8a8478; text-transform: uppercase; letter-spacing: 1px; font-family: Arial, Helvetica, sans-serif;">Profissional</div>
                          <div style="font-size: 15px; color: #1c1b18; font-weight: 600; font-family: Arial, Helvetica, sans-serif;">${barberName}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Service -->
                <tr>
                  <td style="padding: 8px 20px 16px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size: 18px; padding-right: 10px; vertical-align: middle;">✂️</td>
                        <td>
                          <div style="font-size: 11px; color: #8a8478; text-transform: uppercase; letter-spacing: 1px; font-family: Arial, Helvetica, sans-serif;">Serviço</div>
                          <div style="font-size: 15px; color: #1c1b18; font-weight: 600; font-family: Arial, Helvetica, sans-serif;">${serviceName}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Cancellation Notice -->
          <tr>
            <td style="padding: 0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fffbf0; border: 1px solid #e8dcc8; border-radius: 10px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0 0 8px; font-size: 14px; color: #8c6e43; font-weight: 600; font-family: Arial, Helvetica, sans-serif;">
                      ℹ️ Política de cancelamento
                    </p>
                    <p style="margin: 0 0 12px; font-size: 13px; color: #7c766a; line-height: 1.5; font-family: Arial, Helvetica, sans-serif;">
                      Cancelamento <strong>gratuito</strong> até <strong>1 hora antes</strong> do horário agendado. Após esse prazo, pode ser cobrada uma taxa de no-show.
                    </p>
                    <a href="${whatsappLink}" target="_blank" style="display: inline-block; background-color: #25D366; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: Arial, Helvetica, sans-serif;">
                      📱 Cancelar / Reagendar via WhatsApp
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #09090b; padding: 24px 32px; text-align: center;">
              <p style="margin: 0 0 4px; font-size: 13px; color: #c5a880; font-family: Arial, Helvetica, sans-serif;">
                Osanchez Barbearia
              </p>
              <p style="margin: 0; font-size: 11px; color: #6b6560; font-family: Arial, Helvetica, sans-serif;">
                Este é um lembrete automático. Não é necessário responder este e-mail.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}
