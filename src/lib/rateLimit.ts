type RateLimitRecord = {
  count: number
  resetTime: number
}

// In-memory rate limiting store (cleared on server restart)
const ipStore = new Map<string, RateLimitRecord>()
const emailStore = new Map<string, RateLimitRecord>()

const WINDOW_MS = 15 * 60 * 1000 // 15-minute window
const MAX_ATTEMPTS = 5 // max 5 attempts per window

/**
 * Checks if a request from an IP / target email should be rate limited.
 * Returns an object with the result.
 */
export function checkRateLimit(ip: string, email?: string): { limited: boolean; message: string } {
  const now = Date.now()

  const verifyAndIncrement = (key: string, store: Map<string, RateLimitRecord>): boolean => {
    const record = store.get(key)
    if (!record) {
      store.set(key, { count: 1, resetTime: now + WINDOW_MS })
      return false
    }

    if (now > record.resetTime) {
      store.set(key, { count: 1, resetTime: now + WINDOW_MS })
      return false
    }

    if (record.count >= MAX_ATTEMPTS) {
      return true
    }

    record.count += 1
    return false
  }

  // Check IP limit
  if (verifyAndIncrement(ip, ipStore)) {
    const record = ipStore.get(ip)
    const minutesLeft = Math.ceil((record!.resetTime - now) / 60000)
    return {
      limited: true,
      message: `Muitas tentativas a partir deste IP. Tente novamente em ${minutesLeft} minuto(s).`,
    }
  }

  // Check Email limit if provided
  if (email) {
    const normalizedEmail = email.toLowerCase().trim()
    if (verifyAndIncrement(normalizedEmail, emailStore)) {
      const record = emailStore.get(normalizedEmail)
      const minutesLeft = Math.ceil((record!.resetTime - now) / 60000)
      return {
        limited: true,
        message: `Muitas tentativas para este e-mail. Tente novamente em ${minutesLeft} minuto(s).`,
      }
    }
  }

  return { limited: false, message: '' }
}
