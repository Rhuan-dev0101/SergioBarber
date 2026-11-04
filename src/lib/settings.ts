export interface BusinessSettings {
  whatsapp?: string
  address?: string
  instagram?: string
  pixType?: string
  pixKey?: string
  pixName?: string
}

/**
 * Fixed coordinates of the physical barbershop location, used to embed a real
 * Google Maps view (no API key required). Update if the business relocates.
 */
export const BARBERSHOP_COORDS = { lat: -23.4212142, lng: -46.5324821 }

/**
 * Embeddable Google Maps URL (works in an <iframe>, no API key needed).
 */
export function getGoogleMapsEmbedUrl(zoom: number = 17): string {
  return `https://www.google.com/maps?q=${BARBERSHOP_COORDS.lat},${BARBERSHOP_COORDS.lng}&z=${zoom}&output=embed`
}

/**
 * Fetch business settings from database (server-side helper)
 */
export async function getBusinessSettings(): Promise<BusinessSettings | null> {
  try {
    // Import dinamico: componentes client importam os formatadores deste modulo
    // e nao devem arrastar o supabase-js para o bundle inicial.
    const { createServerSupabaseClient } = await import('@/lib/supabase')
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
export function formatWhatsAppLink(phone?: string | null, text?: string): string {
  const raw = phone || ''
  let cleaned = raw.replace(/\D/g, '')

  if (cleaned.length === 10 || cleaned.length === 11) {
    if (!cleaned.startsWith('55')) {
      cleaned = '55' + cleaned
    }
  }

  const baseUrl = cleaned ? `https://wa.me/${cleaned}` : `https://wa.me/`
  if (text) {
    return `${baseUrl}?text=${encodeURIComponent(text)}`
  }
  return baseUrl
}
