import { createAdminSupabaseClient } from './supabase'

const WINDOW_MS = 15 * 60 * 1000 // 15-minute window
const MAX_ATTEMPTS = 5 // max 5 attempts per window

const TABLE = 'rate_limit_attempts' // (key text primary key, count int, reset_time timestamptz)

/**
 * Registra uma tentativa para `key` e informa se o limite da janela foi excedido.
 * Contadores ficam no Supabase para valer entre instancias serverless.
 * Retorna os minutos restantes quando limitado, ou null.
 */
async function verifyAndIncrement(
  db: Awaited<ReturnType<typeof createAdminSupabaseClient>>,
  key: string,
  now: number
): Promise<number | null> {
  const { data: record, error } = await db
    .from(TABLE)
    .select('count, reset_time')
    .eq('key', key)
    .maybeSingle()

  if (error) throw error

  const resetMs = record ? new Date(record.reset_time).getTime() : 0

  if (!record || now > resetMs) {
    const { error: upsertErr } = await db
      .from(TABLE)
      .upsert({ key, count: 1, reset_time: new Date(now + WINDOW_MS).toISOString() })
    if (upsertErr) throw upsertErr
    return null
  }

  if (record.count >= MAX_ATTEMPTS) {
    return Math.ceil((resetMs - now) / 60000)
  }

  // Incremento otimista: so aplica se ninguem alterou o contador desde a leitura.
  const { error: updateErr } = await db
    .from(TABLE)
    .update({ count: record.count + 1 })
    .eq('key', key)
    .eq('count', record.count)
  if (updateErr) throw updateErr
  return null
}

/**
 * Checks if a request from an IP / target email should be rate limited.
 * Fail-open: se o Supabase falhar, registra o erro e nao bloqueia o login.
 */
export async function checkRateLimit(ip: string, email?: string): Promise<{ limited: boolean; message: string }> {
  const now = Date.now()

  try {
    const db = await createAdminSupabaseClient()

    const ipMinutes = await verifyAndIncrement(db, `ip:${ip}`, now)
    if (ipMinutes !== null) {
      return {
        limited: true,
        message: `Muitas tentativas a partir deste IP. Tente novamente em ${ipMinutes} minuto(s).`,
      }
    }

    if (email) {
      const emailMinutes = await verifyAndIncrement(db, `email:${email.toLowerCase().trim()}`, now)
      if (emailMinutes !== null) {
        return {
          limited: true,
          message: `Muitas tentativas para este e-mail. Tente novamente em ${emailMinutes} minuto(s).`,
        }
      }
    }
  } catch (err) {
    console.error('Rate limit check failed (fail-open):', err)
  }

  return { limited: false, message: '' }
}
