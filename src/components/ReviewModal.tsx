'use client'

import React, { useState } from 'react'
import { Star, X, Loader2, CheckCircle2, AlertCircle, MessageSquare, Camera, Image as ImageIcon, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface ReviewModalProps {
  isOpen: boolean
  onClose: () => void
  appointment: {
    id: string
    barber_id: string
    barberName: string
    serviceName: string
    dateFormatted?: string
  } | null
  onSuccess: () => void
}

export function ReviewModal({ isOpen, onClose, appointment, onSuccess }: ReviewModalProps) {
  const [rating, setRating] = useState<number>(5)
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [comment, setComment] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  if (!isOpen || !appointment) return null

  const supabase = createClient()

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Por favor, selecione um arquivo de imagem válido (JPG, PNG, WEBP).')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('A imagem deve ter no máximo 5MB.')
      return
    }

    setErrorMsg('')
    setPhotoFile(file)
    const previewUrl = URL.createObjectURL(file)
    setPhotoPreview(previewUrl)
  }

  const handleRemovePhoto = () => {
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
    }
    setPhotoFile(null)
    setPhotoPreview(null)
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = error => reject(error)
    })
  }

  const uploadPhoto = async (file: File, userId: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop() || 'jpg'
      const filePath = `reviews/${userId}_${Date.now()}.${fileExt}`

      // Try uploading to 'review-photos' bucket first
      const { data, error } = await supabase.storage
        .from('review-photos')
        .upload(filePath, file, { cacheControl: '3600', upsert: true })

      if (error) {
        // Fallback try 'gallery-photos' bucket
        const fallbackRes = await supabase.storage
          .from('gallery-photos')
          .upload(filePath, file, { cacheControl: '3600', upsert: true })

        if (!fallbackRes.error && fallbackRes.data) {
          const { data: { publicUrl } } = supabase.storage
            .from('gallery-photos')
            .getPublicUrl(filePath)
          return publicUrl
        }

        // If storage bucket is not configured, convert to base64
        console.warn('Storage bucket upload failed, using base64 fallback:', error)
        return await fileToBase64(file)
      }

      const { data: { publicUrl } } = supabase.storage
        .from('review-photos')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (err) {
      console.warn('Error during photo upload, fallback to base64:', err)
      return await fileToBase64(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rating || rating < 1 || rating > 5) {
      setErrorMsg('Por favor, selecione uma nota de 1 a 5 estrelas.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setErrorMsg('Sessão expirada. Faça login novamente.')
        setIsSubmitting(false)
        return
      }

      let uploadedPhotoUrl: string | null = null
      if (photoFile) {
        uploadedPhotoUrl = await uploadPhoto(photoFile, session.user.id)
      }

      const { error } = await supabase
        .from('reviews')
        .insert({
          appointment_id: appointment.id,
          customer_id: session.user.id,
          barber_id: appointment.barber_id,
          rating,
          comment: comment.trim() || null,
          photo_url: uploadedPhotoUrl,
          status: 'pending'
        })

      if (error) {
        // Postgres unique violation code 23505
        if (error.code === '23505' || error.message.includes('unique') || error.message.includes('duplicate')) {
          setErrorMsg('Este agendamento já foi avaliado anteriormente.')
        } else {
          setErrorMsg(error.message || 'Erro ao enviar a avaliação. Tente novamente.')
        }
        setIsSubmitting(false)
        return
      }

      setSuccessMsg('Avaliação enviada com sucesso! Obrigado pelo seu feedback.')
      setTimeout(() => {
        onSuccess()
        onClose()
        setComment('')
        setRating(5)
        handleRemovePhoto()
        setSuccessMsg('')
      }, 1500)

    } catch (err: any) {
      console.error('Erro ao enviar avaliação:', err)
      setErrorMsg('Erro inesperado ao conectar com o servidor.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 pb-4">
          <div className="space-y-0.5">
            <h3 className="text-lg font-serif font-bold text-foreground flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
              Avaliar Osanchez Barbearia
            </h3>
            <p className="text-xs text-muted-foreground">
              {appointment.serviceName} com <strong className="text-foreground">{appointment.barberName}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Fechar"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2 text-xs text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Star Rating Selector */}
          <div className="space-y-2 text-center bg-secondary/20 p-4 rounded-xl border border-border/40">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
              Sua Nota (Obrigatório)
            </label>
            <div className="flex items-center justify-center gap-2 py-1">
              {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = (hoverRating || rating) >= star
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 text-amber-400 hover:scale-125 transition-transform focus:outline-none"
                    aria-label={`Nota ${star} de 5`}
                  >
                    <Star
                      className={`w-8 h-8 ${
                        isFilled
                          ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                          : 'text-muted-foreground/30'
                      }`}
                    />
                  </button>
                )
              })}
            </div>
            <p className="text-xs font-bold text-amber-400">
              {rating === 5 && 'Excelente ⭐⭐⭐⭐⭐'}
              {rating === 4 && 'Muito Bom ⭐⭐⭐⭐'}
              {rating === 3 && 'Bom ⭐⭐⭐'}
              {rating === 2 && 'Regular ⭐⭐'}
              {rating === 1 && 'Ruim ⭐'}
            </p>
          </div>

          {/* Comment Textarea */}
          <div className="space-y-1.5">
            <label htmlFor="comment" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-primary" />
              Conte como foi sua experiência <span className="text-[10px] text-muted-foreground font-normal">(Opcional)</span>
            </label>
            <textarea
              id="comment"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Escreva aqui detalhes do corte, atendimento ou ambiente..."
              maxLength={500}
              className="w-full p-3 rounded-xl bg-secondary/40 border border-border text-base text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
            <div className="text-[10px] text-muted-foreground text-right">
              {comment.length}/500 caracteres
            </div>
          </div>

          {/* Optional Photo Attachment */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-primary" />
                Adicionar Foto do Corte <span className="text-[10px] text-muted-foreground font-normal">(Opcional)</span>
              </span>
            </label>

            {photoPreview ? (
              <div className="relative rounded-xl overflow-hidden border border-border/80 bg-black/40 group max-h-48 flex items-center justify-center">
                <img 
                  src={photoPreview} 
                  alt="Pré-visualização do corte" 
                  className="max-h-48 w-full object-contain rounded-xl"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="p-2 rounded-full bg-destructive text-white hover:bg-destructive/90 transition-all shadow-md text-xs font-semibold flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remover Foto
                  </button>
                </div>
              </div>
            ) : (
              <label className="border-2 border-dashed border-border/70 hover:border-primary/50 bg-secondary/20 hover:bg-secondary/40 rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all text-center">
                <ImageIcon className="w-6 h-6 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">Clique para enviar uma foto do corte</span>
                <span className="text-[10px] text-muted-foreground">Formats suportados: JPG, PNG ou WEBP (máx 5MB)</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handlePhotoChange} 
                  className="hidden" 
                />
              </label>
            )}
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/40">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg shadow-md flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : (
                <span>Enviar Avaliação</span>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}

