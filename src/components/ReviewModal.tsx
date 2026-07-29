'use client'

import React, { useState } from 'react'
import { Star, X, Loader2, CheckCircle2, AlertCircle, MessageSquare } from 'lucide-react'
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  if (!isOpen || !appointment) return null

  const supabase = createClient()

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

      const { error } = await supabase
        .from('reviews')
        .insert({
          appointment_id: appointment.id,
          customer_id: session.user.id,
          barber_id: appointment.barber_id,
          rating,
          comment: comment.trim() || null,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-card border border-border/80 rounded-xl shadow-2xl overflow-hidden p-6 space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 pb-4">
          <div className="space-y-0.5">
            <h3 className="text-lg font-serif font-bold text-foreground">Avaliar Atendimento</h3>
            <p className="text-xs text-muted-foreground">
              {appointment.serviceName} com <strong className="text-foreground">{appointment.barberName}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {errorMsg && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-md flex items-center gap-2 text-xs text-emerald-500">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Star Rating Selector */}
          <div className="space-y-2 text-center">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
              Sua Nota (Obrigatório)
            </label>
            <div className="flex items-center justify-center gap-2 py-2">
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
            <p className="text-[11px] font-medium text-amber-400">
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
              className="w-full p-3 rounded-lg bg-secondary/40 border border-border text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
            <div className="text-[10px] text-muted-foreground text-right">
              {comment.length}/500 caracteres
            </div>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border/40">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary rounded-md transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-primary-foreground bg-primary hover:bg-primary-hover rounded-md shadow-md flex items-center gap-1.5 transition-all disabled:opacity-50"
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
