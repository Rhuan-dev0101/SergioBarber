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
 * Add a new image to the gallery
 */
export async function addGalleryImageAction(
  url: string,
  title: string,
  category: string,
  description?: string
): Promise<GalleryActionResponse> {
  const isAdmin = await verifyAdminSession()
  if (!isAdmin) return { success: false, message: 'Acesso restrito a administradores.' }

  if (!url) {
    return { success: false, message: 'A URL da imagem é obrigatória.' }
  }
  if (!title) {
    return { success: false, message: 'O título da imagem é obrigatório.' }
  }
  if (!category) {
    return { success: false, message: 'A categoria da imagem é obrigatória.' }
  }

  try {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('gallery_images')
      .insert({
        url,
        title,
        category,
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
 * Update an existing image in the gallery (title, category, url, description)
 */
export async function updateGalleryImageAction(
  id: string,
  url: string,
  title: string,
  category: string,
  description?: string
): Promise<GalleryActionResponse> {
  const isAdmin = await verifyAdminSession()
  if (!isAdmin) return { success: false, message: 'Acesso restrito a administradores.' }

  if (!id) {
    return { success: false, message: 'ID inválido.' }
  }
  if (!url) {
    return { success: false, message: 'A URL da imagem é obrigatória.' }
  }
  if (!title) {
    return { success: false, message: 'O título da imagem é obrigatório.' }
  }
  if (!category) {
    return { success: false, message: 'A categoria da imagem é obrigatória.' }
  }

  try {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('gallery_images')
      .update({
        url,
        title,
        category,
        description: description || null
      })
      .eq('id', id)

    if (error) {
      console.error('Error updating gallery image:', error)
      return { success: false, message: 'Erro ao atualizar dados da imagem.' }
    }

    return { success: true, message: 'Imagem da galeria atualizada com sucesso!' }
  } catch (err) {
    console.error('Error inside updateGalleryImageAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}

/**
 * Delete an image from the database and storage
 */
export async function deleteGalleryImageAction(
  id: string,
  storagePath?: string
): Promise<GalleryActionResponse> {
  const isAdmin = await verifyAdminSession()
  if (!isAdmin) return { success: false, message: 'Acesso restrito a administradores.' }

  if (!id) {
    return { success: false, message: 'ID inválido.' }
  }

  try {
    const supabase = await createServerSupabaseClient()

    // 1. If storage path is provided, remove file from storage
    if (storagePath) {
      const { error: storageErr } = await supabase.storage
        .from('gallery-photos')
        .remove([storagePath])
      if (storageErr) {
        console.error('Error removing file from Supabase Storage:', storageErr)
      }
    }

    // 2. Delete row from gallery_images
    const { error: dbErr } = await supabase
      .from('gallery_images')
      .delete()
      .eq('id', id)

    if (dbErr) {
      console.error('Error deleting gallery image from DB:', dbErr)
      return { success: false, message: 'Erro ao remover imagem da galeria.' }
    }

    return { success: true, message: 'Imagem removida com sucesso!' }
  } catch (err) {
    console.error('Error inside deleteGalleryImageAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}
