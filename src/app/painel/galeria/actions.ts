'use server'

import { createServerSupabaseClient } from '@/lib/supabase'

export type GalleryActionResponse = {
  success: boolean
  message: string
}

async function verifyAdminSession() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile && profile.role === 'admin'
}

/**
 * Add a new image URL to the public gallery catalog
 */
export async function addGalleryImageAction(
  url: string,
  description: string
): Promise<GalleryActionResponse> {
  const isAdmin = await verifyAdminSession()
  if (!isAdmin) return { success: false, message: 'Acesso restrito a administradores.' }

  if (!url) {
    return { success: false, message: 'A URL da imagem é obrigatória.' }
  }

  try {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('gallery_images')
      .insert({
        url,
        description: description || null
      })

    if (error) {
      console.error('Error inserting gallery image:', error)
      return { success: false, message: 'Erro ao registrar imagem no banco de dados.' }
    }

    return { success: true, message: 'Imagem adicionada à galeria com sucesso!' }
  } catch (err) {
    console.error('Error inside addGalleryImageAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}

/**
 * Delete an image from the gallery
 */
export async function deleteGalleryImageAction(
  id: string
): Promise<GalleryActionResponse> {
  const isAdmin = await verifyAdminSession()
  if (!isAdmin) return { success: false, message: 'Acesso restrito a administradores.' }

  if (!id) {
    return { success: false, message: 'ID inválido.' }
  }

  try {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('gallery_images')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting gallery image:', error)
      return { success: false, message: 'Erro ao remover imagem da galeria.' }
    }

    return { success: true, message: 'Imagem removida com sucesso!' }
  } catch (err) {
    console.error('Error inside deleteGalleryImageAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}
