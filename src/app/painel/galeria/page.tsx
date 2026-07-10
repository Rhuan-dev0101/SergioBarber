'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Scissors, Plus, Trash2, AlertCircle, CheckCircle2, 
  Loader2, X, Camera, Link as LinkIcon 
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { DashboardSidebar } from '@/components/DashboardSidebar'
import { addGalleryImageAction, deleteGalleryImageAction } from './actions'

export default function PainelGaleria() {
  const router = useRouter()
  const [images, setImages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Form states
  const [imageUrl, setImageUrl] = useState('')
  const [description, setDescription] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!imageUrl) {
      setErrorMsg('A URL da imagem é obrigatória.')
      return
    }

    startTransition(async () => {
      const res = await addGalleryImageAction(imageUrl, description)
      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg(res.message)
        setImageUrl('')
        setDescription('')
        setShowAddForm(false)
        loadGallery()
      }
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm('Deseja realmente remover esta imagem da galeria?')) return
    setErrorMsg('')
    setSuccessMsg('')

    startTransition(async () => {
      const res = await deleteGalleryImageAction(id)
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
            <p className="text-xs text-muted-foreground">Adicione e remova fotos de cortes exibidas na página pública</p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="w-full sm:w-auto px-4 py-2.5 bg-primary hover:bg-primary-hover text-primary-foreground font-bold rounded text-xs flex items-center justify-center gap-1.5 shadow"
          >
            <Plus className="w-4 h-4 text-primary-foreground" />
            Adicionar Imagem
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded flex items-start gap-2 text-xs text-destructive">
            <AlertCircle className="w-4.5 h-4.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded flex items-start gap-2 text-xs text-emerald-500">
            <CheckCircle2 className="w-4.5 h-4.5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Add image form drawer */}
        {showAddForm && (
          <form onSubmit={handleSubmit} className="p-5 bg-secondary/15 rounded-lg border border-border space-y-4 max-w-xl animate-in slide-in-from-top duration-200">
            <div className="flex justify-between items-center pb-2 border-b border-border/40">
              <h3 className="font-semibold text-xs text-foreground uppercase tracking-wider">Nova Imagem</h3>
              <button type="button" onClick={() => setShowAddForm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="imgUrl" className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <LinkIcon className="w-3.5 h-3.5 text-primary" /> URL da Imagem
              </label>
              <input
                id="imgUrl"
                type="url"
                placeholder="https://exemplo.com/corte.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                disabled={isPending}
                className="w-full px-3 py-2 bg-secondary border border-border focus:border-primary rounded text-xs text-foreground outline-none"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="imgDesc" className="text-xs font-semibold text-muted-foreground uppercase">Legenda / Descrição</label>
              <input
                id="imgDesc"
                type="text"
                placeholder="Ex: Degradê com mechas platinadas"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isPending}
                className="w-full px-3 py-2 bg-secondary border border-border focus:border-primary rounded text-xs text-foreground outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold rounded shadow transition-all cursor-pointer flex items-center gap-1.5 ml-auto"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-foreground" /> : <Plus className="w-3.5 h-3.5 text-primary-foreground" />}
              Adicionar à Galeria
            </button>
          </form>
        )}

        {/* Gallery Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {images.length > 0 ? (
            images.map((img) => (
              <div 
                key={img.id}
                className="relative aspect-square bg-secondary/30 rounded-lg border border-border overflow-hidden group flex flex-col justify-end p-3"
              >
                <div className="absolute inset-0 flex items-center justify-center text-primary/10">
                  <Camera className="w-12 h-12" />
                </div>
                <div className="relative z-10 flex justify-between items-end gap-2 w-full">
                  <span className="text-[10px] text-foreground font-semibold bg-black/75 px-2 py-0.5 rounded truncate flex-grow">
                    {img.description || 'Sem legenda'}
                  </span>
                  
                  <button
                    onClick={() => handleDelete(img.id)}
                    disabled={isPending}
                    className="p-1 bg-destructive/90 hover:bg-destructive text-white rounded cursor-pointer transition-all shadow"
                    title="Excluir imagem"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-2 sm:col-span-4 p-12 text-center text-muted-foreground italic bg-secondary/10 border border-border rounded-lg">
              A galeria de fotos está vazia. Adicione novas imagens para exibição.
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
