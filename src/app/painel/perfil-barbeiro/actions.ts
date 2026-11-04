'use server'

import { createServerSupabaseClient } from '@/lib/supabase'

export type BarberProfileData = {
  id: string
  full_name: string
  email: string
  role: string
  bio: string
  about_quote: string
  experience_years: number
  specialties: string[]
  photo_url: string | null
}

export type ActionResponse<T = any> = {
  success: boolean
  message: string
  data?: T
}

/**
 * Retrieve barber profile for edit
 */
export async function getBarberProfileAction(): Promise<ActionResponse<BarberProfileData>> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, message: 'Usuário não autenticado.' }
    }

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, barbers(bio, about_quote, experience_years, specialties, photo_url)')
      .eq('id', user.id)
      .single()

    if (profileErr || !profile) {
      console.error('Error fetching profile:', profileErr)
      return { success: false, message: 'Perfil não encontrado.' }
    }

    if (profile.role !== 'barber' && profile.role !== 'admin') {
      return { success: false, message: 'Acesso permitido apenas para profissionais/administradores.' }
    }

    const barberObj = (profile.barbers as any) || {}

    return {
      success: true,
      message: 'Perfil carregado com sucesso.',
      data: {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email || '',
        role: profile.role,
        bio: barberObj.bio || '',
        about_quote: barberObj.about_quote || '',
        experience_years: Number(barberObj.experience_years || 0),
        specialties: barberObj.specialties || [],
        photo_url: barberObj.photo_url || null
      }
    }
  } catch (err) {
    console.error('Error inside getBarberProfileAction:', err)
    return { success: false, message: 'Não foi possível concluir a operação. Tente novamente em instantes.' }
  }
}

/**
 * Update profile data (by the barber themselves or an admin)
 */
export async function updateBarberProfileAction(
  barberId: string,
  data: {
    bio: string
    about_quote: string
    experience_years: number
    specialties: string[]
    photo_url: string | null
  }
): Promise<ActionResponse> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, message: 'Usuário não autenticado.' }
    }

    // Verify role/permissions
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isSelf = user.id === barberId
    const isAdmin = profile && profile.role === 'admin'

    if (!isAdmin && !isSelf) {
      return { success: false, message: 'Não autorizado a realizar esta alteração.' }
    }

    // Perform upsert on barbers table
    const { error: upsertErr } = await supabase
      .from('barbers')
      .upsert({
        id: barberId,
        bio: data.bio || '',
        about_quote: data.about_quote || '',
        experience_years: Number(data.experience_years || 0),
        specialties: data.specialties || [],
        photo_url: data.photo_url || null,
        is_active: true // Keep active status during profile updates
      }, {
        onConflict: 'id'
      })

    if (upsertErr) {
      console.error('Error updating barbers table:', upsertErr)
      return { success: false, message: 'Erro ao salvar informações de perfil.' }
    }

    return { success: true, message: 'Perfil de barbeiro atualizado com sucesso.' }
  } catch (err) {
    console.error('Error inside updateBarberProfileAction:', err)
    return { success: false, message: 'Não foi possível concluir a operação. Tente novamente em instantes.' }
  }
}
