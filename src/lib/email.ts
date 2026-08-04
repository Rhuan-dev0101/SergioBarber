import nodemailer from 'nodemailer'

/**
 * Reusable Nodemailer transporter for Gmail SMTP.
 * Reads credentials from GMAIL_SMTP_USER and GMAIL_SMTP_APP_PASSWORD env vars.
 */
function createTransporter() {
  const user = process.env.GMAIL_SMTP_USER
  const pass = process.env.GMAIL_SMTP_APP_PASSWORD

  if (!user || !pass) {
    throw new Error(
      'Missing email credentials: GMAIL_SMTP_USER and GMAIL_SMTP_APP_PASSWORD must be set in environment variables.'
    )
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // TLS via STARTTLS on port 587
    auth: { user, pass },
  })
}

interface SendEmailOptions {
  to: string
  subject: string
  html: string
}

/**
 * Send an email using Gmail SMTP.
 * @returns true on success, throws on failure
 */
export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<boolean> {
  const transporter = createTransporter()
  const from = `"Osanchez Barbearia" <${process.env.GMAIL_SMTP_USER}>`

  const info = await transporter.sendMail({ from, to, subject, html })
  console.log(`[Email] Sent to ${to} — messageId: ${info.messageId}`)
  return true
}
