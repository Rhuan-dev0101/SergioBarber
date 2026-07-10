import { createServerSupabaseClient } from '@/lib/supabase'

export interface BusinessSettings {
  whatsapp?: string
  address?: string
  instagram?: string
  pixType?: string
  pixKey?: string
  pixName?: string
}

/**
 * Fetch business settings from database (server-side helper)
 */
export async function getBusinessSettings(): Promise<BusinessSettings | null> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('business_settings')
      .select('value')
      .eq('key', 'general_settings')
      .single()

    if (error) {
      console.error('Error fetching settings from database:', error)
      return null
    }

    return (data?.value as BusinessSettings) || null
  } catch (err) {
    console.error('Exception in getBusinessSettings:', err)
    return null
  }
}

/**
 * Format a raw string phone number into Brazilian format: +55 (DD) XXXXX-XXXX
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '+55 (11) 99999-9999'
  
  // Keep only digits
  let cleaned = phone.replace(/\D/g, '')

  // If it starts with 55 and has 12 or 13 digits, it already includes the country code
  // Brazilian mobile number length: 11 (DDD + 9 digits) or landline: 10 (DDD + 8 digits)
  if (cleaned.length === 10 || cleaned.length === 11) {
    cleaned = '55' + cleaned
  }

  if (cleaned.startsWith('55')) {
    const mainPart = cleaned.substring(2)
    if (mainPart.length === 9) {
      return `+55 (${mainPart.substring(0, 2)}) ${mainPart.substring(2, 7)}-${mainPart.substring(7)}`
    } else if (mainPart.length === 8) {
      return `+55 (${mainPart.substring(0, 2)}) ${mainPart.substring(2, 6)}-${mainPart.substring(6)}`
    }
  }

  // Fallback if formatting doesn't fit standard
  return phone
}

/**
 * Build a valid WhatsApp link (wa.me) dynamically from settings
 */
export function formatWhatsAppLink(phone: string, text?: string): string {
  if (!phone) return 'https://wa.me/5511999999999'
  
  // Clean all non-digits
  let cleaned = phone.replace(/\D/g, '')

  // If length is 10 or 11, prepend Brazilian country code 55
  if (cleaned.length === 10 || cleaned.length === 11) {
    if (!cleaned.startsWith('55')) {
      cleaned = '55' + cleaned
    }
  }

  const baseUrl = `https://wa.me/${cleaned}`
  if (text) {
    return `${baseUrl}?text=${encodeURIComponent(text)}`
  }
  return baseUrl
}
