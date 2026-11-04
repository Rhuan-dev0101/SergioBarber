'use client'

import React, { useEffect, useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { 
  Plus, Trash2, AlertCircle, CheckCircle2, 
  Loader2, X, Camera, Edit2, ImageIcon, Save, Crop, Upload, Layers
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { DashboardSidebar } from '@/components/DashboardSidebar'
import { 
  addGalleryImageAction, 
  updateGalleryImageAction, 
  deleteGalleryImageAction 
} from './actions'
import { GradientButton } from '@/components/ui/gradient-button'
import dynamic from 'next/dynamic'
import { getCroppedImg, PixelCrop } from '@/lib/cropUtils'

interface BatchQueueItem {
  id: string
  file: File
  croppedFile?: File
  previewUrl: string
  croppedPreviewUrl?: string
  title: string
  category: string
  description: string
  crop: { x: number; y: number }
  zoom: number
  croppedAreaPixels: PixelCrop | null
  status: 'pending' | 'uploading' | 'done' | 'error'
  errorMessage?: string
}

// react-easy-crop so e' baixado quando o usuario abre o recorte.
const ImageCropModal = dynamic(() => import('@/components/ImageCropModal').then(m => m.ImageCropModal), { ssr: false })

export default function PainelGaleria() {
  const router = useRouter()
  const [images, setImages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Batch Queue state
  const [batchQueue, setBatchQueue] = useState<BatchQueueItem[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string>('')

  // Crop Modal state
  const [croppingItem, setCroppingItem] = useState<{
    type: 'batch' | 'edit'
    id?: string
    imageSrc: string
    crop?: { x: number; y: number }
    zoom?: number
  } | null>(null)

  // Edit single photo state
  const [editingImage, setEditingImage] = useState<any | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)
  const [editCroppedFile, setEditCroppedFile] = useState<File | null>(null)

  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isPending, startTransition] = useTransition()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const editFileInputRef = useRef<HTMLInputElement>(null)

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
      console.error('Error fetching gallery:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGallery()
  }, [])

  // Clean title from filename
  const formatTitleFromFilename = (filename: string) => {
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
    return nameWithoutExt
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
  }

  // Handle selecting multiple files for batch upload
  const handleBatchFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('')
    setSuccessMsg('')
    const files = e.target.files
    if (!files || files.length === 0) return

    const newItems: BatchQueueItem[] = []
    const oversizedFiles: string[] = []

    Array.from(files).forEach((file) => {
      // Limit check: 20MB
      if (file.size > 20 * 1024 * 1024) {
        oversizedFiles.push(file.name)
        return
      }

      const id = `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
      const objectUrl = URL.createObjectURL(file)

      newItems.push({
        id,
        file,
        previewUrl: objectUrl,
        croppedPreviewUrl: objectUrl,
        title: formatTitleFromFilename(file.name),
        category: 'Corte',
        description: '',
        crop: { x: 0, y: 0 },
        zoom: 1,
        croppedAreaPixels: null,
        status: 'pending'
      })
    })

    if (oversizedFiles.length > 0) {
      setErrorMsg(`Algumas fotos excedem o limite máximo de 20MB e foram ignoradas: ${oversizedFiles.join(', ')}`)
    }

    if (newItems.length > 0) {
      setBatchQueue((prev) => [...prev, ...newItems])
      setShowAddForm(true)
    }

    // Reset input value
    if (e.target) e.target.value = ''
  }

  // Remove single item from queue
  const handleRemoveFromQueue = (id: string) => {
    setBatchQueue((prev) => {
      const filtered = prev.filter((item) => item.id !== id)
      if (filtered.length === 0) {
        setShowAddForm(false)
      }
      return filtered
    })
  }

  // Update item field in queue
  const handleUpdateQueueItem = (id: string, field: keyof BatchQueueItem, value: any) => {
    setBatchQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    )
  }

  // Open Crop Modal for a queue item or edit item
  const openCropModalForBatch = (item: BatchQueueItem) => {
    setCroppingItem({
      type: 'batch',
      id: item.id,
      imageSrc: item.previewUrl,
      crop: item.crop,
      zoom: item.zoom
    })
  }

  // Open Crop Modal for single edit photo
  const openCropModalForEdit = () => {
    if (!editingImage?.previewUrl && !editingImage?.url) return
    setCroppingItem({
      type: 'edit',
      imageSrc: editingImage.previewUrl || editingImage.url,
      crop: editingImage.crop || { x: 0, y: 0 },
      zoom: editingImage.zoom || 1
    })
  }

  // Confirm crop from ImageCropModal
  const handleConfirmCrop = async (
    pixelCrop: PixelCrop, 
    crop: { x: number; y: number }, 
    zoom: number
  ) => {
    if (!croppingItem) return

    try {
      // Generate cropped File using react-easy-crop's pixelCrop
      const croppedFile = await getCroppedImg(
        croppingItem.imageSrc, 
        pixelCrop, 
        'cropped-image.jpg'
      )
      const croppedUrl = URL.createObjectURL(croppedFile)

      if (croppingItem.type === 'batch' && croppingItem.id) {
        setBatchQueue((prev) =>
          prev.map((item) => {
            if (item.id === croppingItem.id) {
              return {
                ...item,
                crop,
                zoom,
                croppedAreaPixels: pixelCrop,
                croppedFile: croppedFile,
                croppedPreviewUrl: croppedUrl
              }
            }
            return item
          })
        )
      } else if (croppingItem.type === 'edit') {
        setEditCroppedFile(croppedFile)
        setEditingImage((prev: any) => ({
          ...prev,
          crop,
          zoom,
          croppedAreaPixels: pixelCrop,
          previewUrl: croppedUrl
        }))
      }
    } catch (err) {
      console.error('Error generating cropped preview:', err)
    } finally {
      setCroppingItem(null)
    }
  }

  // Submit Batch Upload ("Salvar Todas")
  const handleSaveAllBatch = async () => {
    setErrorMsg('')
    setSuccessMsg('')

    if (batchQueue.length === 0) return

    // Check if any title is missing
    const missingTitle = batchQueue.find((item) => !item.title.trim())
    if (missingTitle) {
      setErrorMsg('Todas as fotos na fila precisam ter um Título preenchido antes de salvar.')
      return
    }

    setUploading(true)
    let successCount = 0

    try {
      for (let i = 0; i < batchQueue.length; i++) {
        const item = batchQueue[i]
        setUploadProgress(`Enviando foto ${i + 1} de ${batchQueue.length}...`)
        
        handleUpdateQueueItem(item.id, 'status', 'uploading')

        // 1. Obtain file to upload (use croppedFile if generated during modal confirm, else item.file)
        let fileToUpload = item.croppedFile || item.file
        if (!item.croppedFile && item.croppedAreaPixels) {
          try {
            fileToUpload = await getCroppedImg(
              item.previewUrl, 
              item.croppedAreaPixels, 
              item.file.name
            )
          } catch (cropErr) {
            console.warn('Could not crop image before upload, falling back to original:', cropErr)
          }
        }

        // 2. Upload to Supabase Storage
        const fileExt = fileToUpload.name.split('.').pop() || 'jpg'
        const fileName = `gallery-${crypto.randomUUID()}.${fileExt}`
        const filePath = `images/${fileName}`

        const { error: storageError } = await supabase.storage
          .from('gallery-photos')
          .upload(filePath, fileToUpload, {
            cacheControl: '3600',
            upsert: true
          })

        if (storageError) {
          console.error('Error uploading', item.title, ':', storageError)
          handleUpdateQueueItem(item.id, 'status', 'error')
          handleUpdateQueueItem(item.id, 'errorMessage', storageError.message)
          continue
        }

        // 3. Get Public URL
        const { data: { publicUrl } } = supabase.storage
          .from('gallery-photos')
          .getPublicUrl(filePath)

        // 4. Save metadata to DB via Server Action
        const dbRes = await addGalleryImageAction(publicUrl, item.title, item.category, item.description)

        if (!dbRes.success) {
          console.error('Error adding DB record for', item.title, ':', dbRes.message)
          handleUpdateQueueItem(item.id, 'status', 'error')
          handleUpdateQueueItem(item.id, 'errorMessage', dbRes.message)
        } else {
          handleUpdateQueueItem(item.id, 'status', 'done')
          successCount++
        }
      }

      if (successCount === batchQueue.length) {
        setSuccessMsg(`Todas as ${successCount} fotos foram enviadas e cadastradas com sucesso!`)
        setBatchQueue([])
        setShowAddForm(false)
      } else {
        setSuccessMsg(`${successCount} de ${batchQueue.length} fotos foram salvas com sucesso. Verifique os itens com erro na fila.`)
      }

      loadGallery()
    } catch (err: any) {
      console.error('Batch upload error:', err)
      setErrorMsg(err.message || 'Erro durante o envio em lote.')
    } finally {
      setUploading(false)
      setUploadProgress('')
    }
  }

  // Handle single photo upload for edit replacement
  const handleEditFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('')
    setSuccessMsg('')
    if (!e.target.files || e.target.files.length === 0) return

    const file = e.target.files[0]
    if (file.size > 20 * 1024 * 1024) {
      setErrorMsg('A imagem excede o limite máximo de 20MB.')
      return
    }

    const previewUrl = URL.createObjectURL(file)
    setEditCroppedFile(file)
    setEditingImage((prev: any) => ({
      ...prev,
      previewUrl,
      newFile: file,
      croppedAreaPixels: null
    }))
  }

  // Submit edit single image details
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingImage) return

    setErrorMsg('')
    setSuccessMsg('')

    startTransition(async () => {
      try {
        let finalUrl = editingImage.url

        // Upload replacement image if new file/crop was provided
        if (editingImage.newFile || editCroppedFile) {
          setUploading(true)
          let fileToUpload = editCroppedFile || editingImage.newFile

          if (!editCroppedFile && editingImage.croppedAreaPixels && editingImage.previewUrl) {
            try {
              fileToUpload = await getCroppedImg(
                editingImage.previewUrl, 
                editingImage.croppedAreaPixels, 
                fileToUpload.name
              )
            } catch (cErr) {
              console.warn('Could not crop edit file, using original:', cErr)
            }
          }

          const fileExt = fileToUpload.name.split('.').pop() || 'jpg'
          const fileName = `gallery-${crypto.randomUUID()}.${fileExt}`
          const filePath = `images/${fileName}`

          const { error: storageError } = await supabase.storage
            .from('gallery-photos')
            .upload(filePath, fileToUpload, {
              cacheControl: '3600',
              upsert: true
            })

          if (storageError) {
            throw new Error(`Erro ao enviar foto: ${storageError.message}`)
          }

          const { data: { publicUrl } } = supabase.storage
            .from('gallery-photos')
            .getPublicUrl(filePath)

          finalUrl = publicUrl
        }

        const res = await updateGalleryImageAction(
          editingImage.id,
          finalUrl,
          editingImage.title || '',
          editingImage.category || 'Corte',
          editingImage.description || ''
        )

        if (!res.success) {
          setErrorMsg(res.message)
        } else {
          setSuccessMsg(res.message)
          setEditingImage(null)
          setEditCroppedFile(null)
          loadGallery()
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Erro ao atualizar a imagem.')
      } finally {
        setUploading(false)
      }
    })
  }

  // Delete image
  const handleDelete = (img: any) => {
    setErrorMsg('')
    setSuccessMsg('')

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
    setDeleteTarget(null)
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
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/40 pb-4">
          <div>
            <h1 className="text-2xl font-serif font-bold text-foreground">Gerenciar Galeria</h1>
            <p className="text-xs text-muted-foreground">Adicione fotos em lote, edite títulos/descrições e ajuste o enquadramento de corte.</p>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            {/* Hidden Multiple File Input */}
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              multiple 
              onChange={handleBatchFileSelect}
              className="hidden" 
            />

            {!editingImage && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full sm:w-auto px-4 py-2.5 bg-primary hover:bg-primary-hover text-primary-foreground font-bold rounded text-xs flex items-center justify-center gap-2 shadow cursor-pointer transition-all disabled:opacity-50"
              >
                <Upload className="w-4 h-4 text-primary-foreground" />
                Adicionar Fotos (Lote)
              </button>
            )}
          </div>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2.5 text-xs text-destructive max-w-4xl shadow-sm">
            <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-start gap-2.5 text-xs text-emerald-500 max-w-4xl shadow-sm">
            <CheckCircle2 className="w-4.5 h-4.5 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* BATCH UPLOAD QUEUE PANEL */}
        {showAddForm && batchQueue.length > 0 && (
          <div className="p-6 bg-secondary/15 rounded-xl border border-border space-y-6 max-w-4xl shadow-2xl animate-in slide-in-from-top duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-border/40 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-primary" />
                  <h3 className="font-serif font-bold text-base text-foreground">Fila de Envio Em Lote ({batchQueue.length} {batchQueue.length === 1 ? 'foto' : 'fotos'})</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Preencha o título e detalhes individuais para cada foto e clique em &quot;Ajustar Corte&quot; para reposicionar a imagem no quadrado.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="px-3 py-1.5 bg-secondary hover:bg-muted text-foreground text-xs font-semibold rounded flex items-center gap-1.5 border border-border/60 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Mais
                </button>
                <button aria-label="Fechar"
                  type="button"
                  onClick={() => {
                    setBatchQueue([])
                    setShowAddForm(false)
                  }}
                  disabled={uploading}
                  className="text-muted-foreground hover:text-foreground p-1.5 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Queue List Items */}
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
              {batchQueue.map((item, index) => (
                <div 
                  key={item.id}
                  className="p-4 bg-background/60 rounded-lg border border-border/80 grid grid-cols-1 md:grid-cols-12 gap-4 items-start relative group"
                >
                  {/* Item Image Preview & Interactive Crop Trigger */}
                  <div className="md:col-span-3 flex flex-col items-center">
                    <div className="relative w-full aspect-square rounded-lg border border-border overflow-hidden bg-secondary/40 group/img select-none">
                      <Image 
                        src={item.croppedPreviewUrl || item.previewUrl} 
                        alt="Preview" 
                        fill
                        className="object-cover"
                      />

                      {/* Interactive Crop Button Overlay */}
                      <button
                        type="button"
                        onClick={() => openCropModalForBatch(item)}
                        disabled={uploading}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center text-white text-[11px] font-semibold gap-1.5 cursor-pointer"
                      >
                        <Crop className="w-5 h-5 text-primary" />
                        <span>Ajustar Corte</span>
                      </button>

                      {/* Status indicator */}
                      {item.status === 'uploading' && (
                        <div className="absolute inset-0 bg-black/75 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                      )}
                      {item.status === 'done' && (
                        <div className="absolute top-2 right-2 bg-emerald-500 text-white rounded-full p-1 shadow">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => openCropModalForBatch(item)}
                      disabled={uploading}
                      className="mt-2 text-[11px] text-primary hover:underline flex items-center gap-1 font-semibold"
                    >
                      <Crop className="w-3 h-3" /> Reposicionar / Cortar
                    </button>
                  </div>

                  {/* Item Fields */}
                  <div className="md:col-span-8 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-7 space-y-1">
                        <label className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                          Título da Foto <span className="text-destructive">*</span>
                        </label>
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => handleUpdateQueueItem(item.id, 'title', e.target.value)}
                          disabled={uploading}
                          placeholder="Ex: Corte Fade com Barba Desenhada"
                          className="w-full px-3 py-2 bg-secondary/30 border border-border/80 focus:border-primary rounded text-base text-foreground outline-none transition-colors"
                          required
                        />
                      </div>

                      <div className="sm:col-span-5 space-y-1">
                        <label className="text-[10px] font-bold text-foreground uppercase tracking-wider">Categoria</label>
                        <select
                          value={item.category}
                          onChange={(e) => handleUpdateQueueItem(item.id, 'category', e.target.value)}
                          disabled={uploading}
                          className="w-full px-3 py-2 bg-secondary/30 border border-border/80 focus:border-primary rounded text-base text-foreground outline-none transition-colors"
                        >
                          <option value="Corte">Corte</option>
                          <option value="Barba">Barba</option>
                          <option value="Cabelo">Cabelo</option>
                          <option value="Química">Química</option>
                          <option value="Outros">Outros</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-foreground uppercase tracking-wider">Descrição / Detalhes (Opcional)</label>
                      <textarea
                        rows={2}
                        value={item.description}
                        onChange={(e) => handleUpdateQueueItem(item.id, 'description', e.target.value)}
                        disabled={uploading}
                        placeholder="Ex: Degradê limpo com tesoura no topo e barba alinhada."
                        className="w-full px-3 py-2 bg-secondary/30 border border-border/80 focus:border-primary rounded text-base text-foreground outline-none transition-colors"
                      />
                    </div>

                    {item.errorMessage && (
                      <p className="text-[11px] text-destructive font-medium">{item.errorMessage}</p>
                    )}
                  </div>

                  {/* Remove Button */}
                  <div className="md:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleRemoveFromQueue(item.id)}
                      disabled={uploading}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                      title="Remover foto da fila"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Actions: Single "Salvar Todas" button */}
            <div className="flex flex-col sm:flex-row justify-between items-center pt-4 border-t border-border/40 gap-4">
              <div className="text-xs text-muted-foreground">
                {uploading ? (
                  <span className="flex items-center gap-2 text-primary font-semibold">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {uploadProgress || 'Processando fotos...'}
                  </span>
                ) : (
                  <span>Fotos na fila: <strong>{batchQueue.length}</strong> (Limite máximo: 20MB cada)</span>
                )}
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <GradientButton
                  type="button"
                  variant="variant"
                  onClick={() => {
                    setBatchQueue([])
                    setShowAddForm(false)
                  }}
                  disabled={uploading}
                  className="text-xs h-9 px-4"
                >
                  Cancelar Tudo
                </GradientButton>

                <GradientButton
                  type="button"
                  onClick={handleSaveAllBatch}
                  disabled={uploading || batchQueue.length === 0}
                  className="text-xs h-9 px-6 gap-2 font-bold"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Salvar Todas ({batchQueue.length})
                </GradientButton>
              </div>
            </div>
          </div>
        )}

        {/* EDIT SINGLE PHOTO MODAL/FORM */}
        {editingImage && (
          <form onSubmit={handleEditSubmit} className="p-6 bg-secondary/15 rounded-xl border border-border space-y-4 max-w-2xl shadow-2xl animate-in slide-in-from-top duration-200">
            <div className="flex justify-between items-center pb-2 border-b border-border/40">
              <h3 className="font-serif font-bold text-sm text-foreground uppercase tracking-wider">Editar Detalhes da Foto</h3>
              <button aria-label="Fechar" 
                type="button" 
                onClick={() => {
                  setEditingImage(null)
                  setEditCroppedFile(null)
                }} 
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Photo Area */}
              <div className="md:col-span-4 flex flex-col items-center">
                <div className="relative w-full aspect-square rounded-lg border border-border/80 bg-secondary/30 flex items-center justify-center overflow-hidden group select-none">
                  <Image 
                    src={editingImage.previewUrl || editingImage.url} 
                    alt="Preview" 
                    fill 
                    className="object-cover"
                  />

                  <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center cursor-pointer text-white text-[10px] font-semibold gap-1">
                    <Camera size={18} className="text-primary" />
                    <span>Substituir Foto</span>
                    <input 
                      ref={editFileInputRef}
                      type="file" 
                      accept="image/*" 
                      onChange={handleEditFileSelect} 
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

                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    disabled={uploading}
                    className="text-[10px] text-muted-foreground hover:text-foreground underline"
                  >
                    Substituir (máx. 20MB)
                  </button>

                  <button
                    type="button"
                    onClick={openCropModalForEdit}
                    disabled={uploading}
                    className="text-[10px] text-primary hover:underline flex items-center gap-0.5 font-semibold"
                  >
                    <Crop className="w-3 h-3" /> Cortar
                  </button>
                </div>
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
                      disabled={isPending || uploading}
                      className="w-full px-3.5 py-2.5 bg-secondary/30 border border-border/80 focus:border-primary rounded text-base text-foreground outline-none transition-colors"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="editCategory" className="text-[10px] font-bold text-foreground uppercase tracking-wider">Categoria</label>
                    <select
                      id="editCategory"
                      value={editingImage.category || 'Corte'}
                      onChange={(e) => setEditingImage({ ...editingImage, category: e.target.value })}
                      disabled={isPending || uploading}
                      className="w-full px-3.5 py-2.5 bg-secondary/30 border border-border/80 focus:border-primary rounded text-base text-foreground outline-none transition-colors"
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
                    disabled={isPending || uploading}
                    className="w-full px-3.5 py-2.5 bg-secondary/30 border border-border/80 focus:border-primary rounded text-base text-foreground outline-none transition-colors"
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <GradientButton 
                    type="button" 
                    variant="variant" 
                    onClick={() => {
                      setEditingImage(null)
                      setEditCroppedFile(null)
                    }} 
                    className="text-xs h-9 px-4"
                  >
                    Cancelar
                  </GradientButton>
                  <GradientButton type="submit" disabled={isPending || uploading} className="text-xs h-9 px-4 gap-1.5">
                    {isPending || uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Salvar Alterações
                  </GradientButton>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* GALLERY GRID */}
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
                      onClick={() => {
                        setEditingImage(img)
                        setShowAddForm(false)
                        setErrorMsg('')
                        setSuccessMsg('')
                      }}
                      disabled={isPending || uploading}
                      className="flex-1 py-1.5 bg-secondary hover:bg-muted text-foreground text-[10px] font-semibold rounded flex items-center justify-center gap-1 shadow cursor-pointer transition-all"
                    >
                      <Edit2 className="w-3 h-3" /> Editar
                    </button>
                    <button
                      onClick={() => setDeleteTarget(img)}
                      disabled={isPending || uploading}
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
              <p className="text-xs">A galeria de fotos está vazia. Clique em &quot;Adicionar Fotos (Lote)&quot; para cadastrar imagens.</p>
            </div>
          )}
        </div>

      </main>

      {/* REUSABLE IMAGE CROP MODAL */}
      {croppingItem && <ImageCropModal
        isOpen
        imageSrc={croppingItem?.imageSrc || ''}
        initialCrop={croppingItem?.crop}
        initialZoom={croppingItem?.zoom}
        onClose={() => setCroppingItem(null)}
        onConfirm={handleConfirmCrop}
      />}

      {/* DELETE CONFIRM MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="glass max-w-sm w-full rounded-lg border border-border shadow-2xl p-6 relative flex flex-col space-y-6">
            <div className="space-y-2 text-left">
              <h3 className="text-lg font-serif font-bold text-rose-500 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-500" />
                Excluir Imagem?
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Deseja realmente excluir &quot;{deleteTarget.title || 'esta imagem'}&quot; da galeria? Esta ação não poderá ser desfeita.
              </p>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isPending}
                className="px-4 py-2 bg-secondary hover:bg-muted text-foreground border border-border font-bold rounded text-xs transition-all cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteTarget)}
                disabled={isPending}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <Trash2 className="w-3.5 h-3.5 text-white" />}
                Sim, excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
