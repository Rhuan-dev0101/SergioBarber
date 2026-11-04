'use client'

import React, { useState } from 'react'
import { User, Mail, X, Loader2, Scissors } from 'lucide-react'
import { createBarberAction } from '@/app/painel/funcionarios/actions'

interface AddBarberModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (msg: string) => void
}

export function AddBarberModal({ isOpen, onClose, onSuccess }: AddBarberModalProps) {
  const [addName, setAddName] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [pending, setPending] = useState(false)

  const handleClose = () => {
    setAddName('')
    setAddEmail('')
    setErrorMsg('')
    onClose()
  }

  const handleCreateBarber = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!addName || !addEmail) {
      setErrorMsg('Preencha o nome e o e-mail do barbeiro.')
      return
    }

    setPending(true)
    try {
      const res = await createBarberAction(addName, addEmail)
      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        onSuccess(res.message)
        handleClose()
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro inesperado ao adicionar barbeiro.')
    } finally {
      setPending(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 animate-in fade-in duration-150">
      <div className="bg-card border border-border/80 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
        <div className="flex justify-between items-center pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-foreground">Novo Barbeiro</h3>
              <p className="text-[11px] text-muted-foreground">Cadastre um novo profissional na equipe</p>
            </div>
          </div>
          <button onClick={handleClose} aria-label="Fechar" className="p-1 text-muted-foreground hover:text-foreground rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive font-semibold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleCreateBarber} className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Nome Completo *</label>
            <input
              type="text"
              placeholder="Ex: Enzo Gabriel"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              className="w-full px-3 py-2 bg-secondary/50 border border-border focus:border-primary rounded-xl text-xs text-foreground outline-none"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">E-mail *</label>
            <input
              type="email"
              placeholder="Ex: enzo@barbearia.com"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              className="w-full px-3 py-2 bg-secondary/50 border border-border focus:border-primary rounded-xl text-xs text-foreground outline-none"
              required
            />
          </div>

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
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Adicionar Barbeiro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
