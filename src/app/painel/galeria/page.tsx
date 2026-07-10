'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { 
  Plus, Trash2, AlertCircle, CheckCircle2, 
  Loader2, X, Camera, Edit2, ArrowLeft, Image as ImageIcon, Save 
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { DashboardSidebar } from '@/components/DashboardSidebar'
import { 
  addGalleryImageAction, 
  updateGalleryImageAction, 
  deleteGalleryImageAction 
} from './actions'
import { GradientButton } from '@/components/ui/gradient-button'

export default function PainelGaleria() {
  const router = useRouter()
  const [images, setImages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Form states
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Corte')
  const [imageUrl, setImageUrl] = useState('')
  const [description, setDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  
  // Edit states
  const [editingImage, setEditingImage] = useState<any | null>(null)

  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isPending, startTransition] = useTransition()

  const supabase = createClient()

  const loadGallery = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/entrar')
        return
      }

      // Check admin auth
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()
      
      if (!profile || profile.role !== 'admin') {
        router.push('/painel')
        return
      }

      const { data: dbImages } = await supabase
        .from('gallery_images')
        .select('*')
        .order('created_at', { ascending: false })

      setImages(dbImages || [])
    } catch (err) {
      console.error('Error fetching gallery logs:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGallery()
  }, [])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEditMode = false) => {
    setErrorMsg('')
    setSuccessMsg('')
    
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('A imagem deve ter no máximo 5MB.')
      return
    }

    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `gallery-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`
      const filePath = `images/${fileName}`

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('gallery-photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (error) {
        console.error('Storage upload error:', error)
        throw new Error('Certifique-se de que o bucket "gallery-photos" foi criado e está público no Supabase console.')
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('gallery-photos')
        .getPublicUrl(filePath)

      if (isEditMode) {
        setEditingImage((prev: any) => ({ ...prev, url: publicUrl }))
      } else {
        setImageUrl(publicUrl)
      }
      setSuccessMsg('Imagem carregada com sucesso para o Supabase Storage!')
    } catch (err: any) {
      console.error('Error uploading photo:', err)
      setErrorMsg(err.message || 'Erro ao carregar a imagem para o storage.')
    } finally {
      setUploading(false)
    }
  }

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!imageUrl) {
      setErrorMsg('Por favor, carregue uma imagem ou informe a URL.')
      return
    }
    if (!title) {
      setErrorMsg('O título é obrigatório.')
      return
    }

    startTransition(async () => {
      const res = await addGalleryImageAction(imageUrl, title, category, description)
      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg(res.message)
        setImageUrl('')
        setTitle('')
        setCategory('Corte')
        setDescription('')
        setShowAddForm(false)
        loadGallery()
      }
    })
  }

  const handleEditClick = (img: any) => {
    setEditingImage(img)
    setShowAddForm(false)
    setErrorMsg('')
    setSuccessMsg('')
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingImage) return

    setErrorMsg('')
    setSuccessMsg('')

    startTransition(async () => {
      const res = await updateGalleryImageAction(
        editingImage.id,
        editingImage.url,
        editingImage.title || '',
        editingImage.category || 'Corte',
        editingImage.description || ''
      )
      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg(res.message)
        setEditingImage(null)
        loadGallery()
      }
    })
  }

  const handleDelete = (img: any) => {
    if (!confirm(`Deseja realmente excluir "${img.title || 'esta imagem'}" da galeria?`)) return
    setErrorMsg('')
    setSuccessMsg('')

    // Try to extract storage filename if it came from our bucket
    let storagePath = undefined
    if (img.url && img.url.includes('gallery-photos/')) {
      storagePath = img.url.split('gallery-photos/')[1]
    }

    startTransition(async () => {
      const res = await deleteGalleryImageAction(img.id, storagePath)
      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg(res.message)
        loadGallery()
      }
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col md:flex-row justify-center items-center gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Carregando galeria do painel...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <DashboardSidebar />

      <main className="flex-grow p-6 sm:p-8 space-y-6 overflow-y-auto">
        
        {/* Title */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/40 pb-4">
          <div>
            <h1 className="text-2xl font-serif font-bold text-foreground">Gerenciar Galeria</h1>
            <p className="text-xs text-muted-foreground">Adicione, edite ou exclua fotos de cortes exibidas na página pública e portfólio</p>
          </div>
          {!showAddForm && !editingImage && (
            <button
              onClick={() => {
                setShowAddForm(true)
                setEditingImage(null)
              }}
              className="w-full sm:w-auto px-4 py-2.5 bg-primary hover:bg-primary-hover text-primary-foreground font-bold rounded text-xs flex items-center justify-center gap-1.5 shadow cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4 text-primary-foreground" />
              Adicionar Nova Foto
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded flex items-start gap-2 text-xs text-destructive max-w-2xl">
            <AlertCircle className="w-4.5 h-4.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded flex items-start gap-2 text-xs text-emerald-500 max-w-2xl">
            <CheckCircle2 className="w-4.5 h-4.5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Add image form */}
        {showAddForm && (
          <form onSubmit={handleAddSubmit} className="p-6 bg-secondary/15 rounded-lg border border-border space-y-4 max-w-2xl shadow-xl animate-in slide-in-from-top duration-200">
            <div className="flex justify-between items-center pb-2 border-b border-border/40">
              <h3 className="font-semibold text-xs text-foreground uppercase tracking-wider">Nova Foto da Galeria</h3>
              <button type="button" onClick={() => setShowAddForm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Photo Upload Area */}
              <div className="md:col-span-4 flex flex-col items-center justify-center">
                <div className="relative w-full aspect-square rounded-lg border border-border/80 bg-secondary/30 flex items-center justify-center overflow-hidden group select-none">
                  {imageUrl ? (
                    <Image 
                      src={imageUrl} 
                      alt="Preview" 
                      width={200} 
                      height={200} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-4 text-muted-foreground flex flex-col items-center">
                      <ImageIcon className="w-8 h-8 text-primary/30 mb-2" />
                      <span className="text-[10px] uppercase font-bold">Sem imagem</span>
                    </div>
                  )}

                  <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center cursor-pointer text-white text-[10px] font-semibold">
                    <Camera size={18} className="text-primary mb-1" />
                    <span>Upload Foto</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => handleFileUpload(e, false)} 
                      disabled={uploading} 
                      className="hidden" 
                    />
                  </label>

                  {uploading && (
                    <div className="absolute inset-0 bg-black/75 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  )}
                </div>
                <p className="text-[9px] text-muted-foreground mt-1.5 text-center">Clique na imagem para enviar (JPEG/PNG, máx. 5MB)</p>
              </div>

              {/* Data Fields */}
              <div className="md:col-span-8 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="imgTitle" className="text-[10px] font-bold text-foreground uppercase tracking-wider">Título da Foto</label>
                    <input
                      id="imgTitle"
                      type="text"
                      placeholder="Ex: Degradê Texturizado"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      disabled={isPending}
                      className="w-full px-3.5 py-2.5 bg-secondary/30 border border-border/80 focus:border-primary rounded text-xs text-foreground outline-none transition-colors"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="imgCategory" className="text-[10px] font-bold text-foreground uppercase tracking-wider">Categoria</label>
                    <select
                      id="imgCategory"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      disabled={isPending}
                      className="w-full px-3.5 py-2.5 bg-secondary/30 border border-border/80 focus:border-primary rounded text-xs text-foreground outline-none transition-colors"
                    >
                      <option value="Corte">Corte</option>
                      <option value="Barba">Barba</option>
                      <option value="Cabelo">Cabelo</option>
                      <option value="Química">Química</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="imgDesc" className="text-[10px] font-bold text-foreground uppercase tracking-wider">Descrição / Detalhes (Opcional)</label>
                  <textarea
                    id="imgDesc"
                    rows={2}
                    placeholder="Ex: Transição limpa da pele ao cabelo, perfeita para rostos quadrados."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isPending}
                    className="w-full px-3.5 py-2.5 bg-secondary/30 border border-border/80 focus:border-primary rounded text-xs text-foreground outline-none transition-colors"
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <GradientButton type="button" variant="variant" onClick={() => setShowAddForm(false)} className="text-xs h-9 px-4">
                    Cancelar
                  </GradientButton>
                  <GradientButton type="submit" disabled={isPending || uploading} className="text-xs h-9 px-4 gap-1.5">
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Confirmar Cadastro
                  </GradientButton>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* Edit image form */}
        {editingImage && (
          <form onSubmit={handleEditSubmit} className="p-6 bg-secondary/15 rounded-lg border border-border space-y-4 max-w-2xl shadow-xl animate-in slide-in-from-top duration-200">
            <div className="flex justify-between items-center pb-2 border-b border-border/40">
              <h3 className="font-semibold text-xs text-foreground uppercase tracking-wider">Editar Detalhes da Foto</h3>
              <button type="button" onClick={() => setEditingImage(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Photo Upload Area */}
              <div className="md:col-span-4 flex flex-col items-center justify-center">
                <div className="relative w-full aspect-square rounded-lg border border-border/80 bg-secondary/30 flex items-center justify-center overflow-hidden group select-none">
                  {editingImage.url ? (
                    <Image 
                      src={editingImage.url} 
                      alt="Preview" 
                      width={200} 
                      height={200} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-4 text-muted-foreground flex flex-col items-center">
                      <ImageIcon className="w-8 h-8 text-primary/30 mb-2" />
                      <span className="text-[10px] uppercase font-bold">Sem imagem</span>
                    </div>
                  )}

                  <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center cursor-pointer text-white text-[10px] font-semibold">
                    <Camera size={18} className="text-primary mb-1" />
                    <span>Substituir Foto</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => handleFileUpload(e, true)} 
                      disabled={uploading} 
                      className="hidden" 
                    />
                  </label>

                  {uploading && (
                    <div className="absolute inset-0 bg-black/75 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  )}
                </div>
                <p className="text-[9px] text-muted-foreground mt-1.5 text-center">Clique na imagem para enviar (JPEG/PNG, máx. 5MB)</p>
              </div>

              {/* Data Fields */}
              <div className="md:col-span-8 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="editTitle" className="text-[10px] font-bold text-foreground uppercase tracking-wider">Título da Foto</label>
                    <input
                      id="editTitle"
                      type="text"
                      value={editingImage.title || ''}
                      onChange={(e) => setEditingImage({ ...editingImage, title: e.target.value })}
                      disabled={isPending}
                      className="w-full px-3.5 py-2.5 bg-secondary/30 border border-border/80 focus:border-primary rounded text-xs text-foreground outline-none transition-colors"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="editCategory" className="text-[10px] font-bold text-foreground uppercase tracking-wider">Categoria</label>
                    <select
                      id="editCategory"
                      value={editingImage.category || 'Corte'}
                      onChange={(e) => setEditingImage({ ...editingImage, category: e.target.value })}
                      disabled={isPending}
                      className="w-full px-3.5 py-2.5 bg-secondary/30 border border-border/80 focus:border-primary rounded text-xs text-foreground outline-none transition-colors"
                    >
                      <option value="Corte">Corte</option>
                      <option value="Barba">Barba</option>
                      <option value="Cabelo">Cabelo</option>
                      <option value="Química">Química</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="editDesc" className="text-[10px] font-bold text-foreground uppercase tracking-wider">Descrição / Detalhes (Opcional)</label>
                  <textarea
                    id="editDesc"
                    rows={2}
                    value={editingImage.description || ''}
                    onChange={(e) => setEditingImage({ ...editingImage, description: e.target.value })}
                    disabled={isPending}
                    className="w-full px-3.5 py-2.5 bg-secondary/30 border border-border/80 focus:border-primary rounded text-xs text-foreground outline-none transition-colors"
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <GradientButton type="button" variant="variant" onClick={() => setEditingImage(null)} className="text-xs h-9 px-4">
                    Cancelar
                  </GradientButton>
                  <GradientButton type="submit" disabled={isPending || uploading} className="text-xs h-9 px-4 gap-1.5">
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Salvar Alterações
                  </GradientButton>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 pt-2">
          {images.length > 0 ? (
            images.map((img) => (
              <div 
                key={img.id}
                className="relative aspect-square bg-secondary/35 rounded-xl border border-border overflow-hidden group flex flex-col justify-end p-4 shadow-lg"
              >
                {/* Thumbnail Image Preview */}
                {img.url ? (
                  <Image 
                    src={img.url} 
                    alt={img.title || img.description || 'Imagem da galeria'} 
                    fill 
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-primary/20">
                    <Camera className="w-12 h-12" />
                  </div>
                )}

                {/* Dark overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10" />

                {/* Tag & Info overlay */}
                <div className="relative z-20 space-y-1.5 w-full">
                  <span className="inline-block px-2 py-0.5 rounded bg-primary/80 text-primary-foreground text-[8px] font-bold uppercase tracking-wider select-none">
                    {img.category || 'Corte'}
                  </span>
                  
                  <h4 className="font-serif font-bold text-sm text-foreground truncate">{img.title || 'Sem título'}</h4>
                  
                  {img.description && (
                    <p className="text-[10px] text-muted-foreground truncate leading-snug">{img.description}</p>
                  )}

                  <div className="flex gap-2 items-center pt-1 border-t border-border/20 mt-1">
                    <button
                      onClick={() => handleEditClick(img)}
                      disabled={isPending}
                      className="flex-1 py-1.5 bg-secondary hover:bg-muted text-foreground text-[10px] font-semibold rounded flex items-center justify-center gap-1 shadow cursor-pointer transition-all"
                    >
                      <Edit2 className="w-3 h-3" /> Editar
                    </button>
                    <button
                      onClick={() => handleDelete(img)}
                      disabled={isPending}
                      className="p-1.5 bg-destructive/80 hover:bg-destructive text-white rounded shadow cursor-pointer transition-all"
                      title="Excluir imagem"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full p-12 text-center text-muted-foreground italic bg-secondary/10 border border-border rounded-lg shadow flex flex-col items-center justify-center gap-2">
              <ImageIcon className="w-12 h-12 text-primary/10" />
              <p className="text-xs">A galeria de fotos está vazia. Adicione novas imagens para exibição.</p>
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
