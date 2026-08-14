'use client'

import React, { useState, useEffect } from 'react'
import { Scissors, Edit2, X, Loader2 } from 'lucide-react'
import { updateBarberServiceAction } from '@/app/painel/meus-servicos/actions'

interface EditServiceModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (msg: string) => void
  barberId: string
  editingService: any | null
}

export function EditServiceModal({
  isOpen,
  onClose,
  onSuccess,
  barberId,
  editingService,
}: EditServiceModalProps) {
  const [editPrice, setEditPrice] = useState('50.00')
  const [editDuration, setEditDuration] = useState('60')
  const [editDescription, setEditDescription] = useState('')
  const [editIsActive, setEditIsActive] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (editingService) {
      setEditPrice(String(editingService.price || '50.00'))
      setEditDuration(String(editingService.duration || '60'))
      setEditDescription(editingService.description || '')
      setEditIsActive(editingService.is_active !== false)
      setErrorMsg('')
    }
  }, [editingService])

  const handleClose = () => {
    setErrorMsg('')
    onClose()
  }

  const handleUpdateService = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingService) return
    setErrorMsg('')

    if (!editPrice || !editDuration) {
      setErrorMsg('Preencha preço e duração.')
      return
    }

    setPending(true)
    try {
      const res = await updateBarberServiceAction(
        editingService.id,
        parseFloat(editPrice),
        parseInt(editDuration, 10),
        editIsActive,
        editDescription.trim() || null
      )

      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        onSuccess(res.message)
        handleClose()
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro inesperado ao atualizar serviço.')
    } finally {
      setPending(false)
    }
  }

  if (!isOpen || !editingService) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-card border border-border/80 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
        <div className="flex justify-between items-center pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Edit2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-foreground">Editar Serviço</h3>
              <p className="text-[11px] text-muted-foreground">{editingService.services?.name}</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1 text-muted-foreground hover:text-foreground rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive font-semibold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleUpdateService} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Preço (R$) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                className="w-full px-3 py-2 bg-secondary/50 border border-border focus:border-primary rounded-xl text-xs text-foreground outline-none font-bold"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Duração (min) *</label>
              <input
                type="number"
                step="5"
                min="5"
                value={editDuration}
                onChange={(e) => setEditDuration(e.target.value)}
                className="w-full px-3 py-2 bg-secondary/50 border border-border focus:border-primary rounded-xl text-xs text-foreground outline-none font-bold"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Descrição Personalizada</label>
            <textarea
              placeholder="Descrição para seus clientes..."
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={2}
              className="w-full p-2.5 bg-secondary/50 border border-border focus:border-primary rounded-xl text-xs text-foreground outline-none resize-none"
            />
          </div>

          <label className="flex items-center justify-between cursor-pointer p-3 bg-secondary/30 rounded-xl border border-border/40">
            <span className="text-xs font-semibold text-foreground">Serviço Ativo no Meu Perfil</span>
            <input
              type="checkbox"
              checked={editIsActive}
              onChange={(e) => setEditIsActive(e.target.checked)}
              className="w-4 h-4 rounded accent-primary cursor-pointer"
            />
          </label>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={pending}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="px-5 py-2 bg-primary text-primary-foreground font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
            >
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
