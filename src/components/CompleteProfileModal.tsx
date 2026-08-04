'use client'

import React, { useState, useTransition } from 'react'
import { AlertCircle, Loader2, User } from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface CompleteProfileModalProps {
  isOpen: boolean
  initialFullName?: string
  isBlocking?: boolean
  onClose?: () => void
  onComplete: (fullName: string, phone: string) => void
}

export function CompleteProfileModal({
  isOpen,
  initialFullName = '',
  isBlocking = false,
  onClose,
  onComplete
}: CompleteProfileModalProps) {
  const [fullName, setFullName] = useState(initialFullName)
  const [phone, setPhone] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isPending, startTransition] = useTransition()

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    const nameParts = fullName.trim().split(/\s+/)
    if (nameParts.length < 2) {
      setErrorMsg('Por favor, insira seu nome completo (nome e sobrenome).')
      return
    }

    // Phone validation DDI+DDD+número
    let cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 10 || cleaned.length === 11) {
      cleaned = '55' + cleaned
    }

    if (cleaned.length !== 12 && cleaned.length !== 13) {
      setErrorMsg('Por favor, insira um telefone válido com DDI e DDD (Ex: 55 11 99999-9999).')
      return
    }

    startTransition(async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          setErrorMsg('Sessão expirada. Faça login novamente.')
          return
        }

        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: fullName.trim(),
            phone: cleaned,
            updated_at: new Date().toISOString()
          })
          .eq('id', session.user.id)

        if (error) {
          console.error('Error completing profile:', error)
          setErrorMsg('Erro ao atualizar seu perfil. Tente novamente.')
        } else {
          onComplete(fullName.trim(), cleaned)
        }
      } catch (err) {
        console.error('Exception in CompleteProfileModal:', err)
        setErrorMsg('Erro interno no servidor.')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass max-w-md w-full rounded-lg border border-border shadow-2xl p-6 sm:p-8 relative flex flex-col space-y-5 animate-in fade-in duration-300">
        
        {!isBlocking && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground cursor-pointer text-xl font-bold font-serif"
          >
            &times;
          </button>
        )}

        <div className="border-b border-border/40 pb-3 text-center sm:text-left">
          <h3 className="text-base sm:text-lg font-serif font-bold text-foreground flex items-center justify-center sm:justify-start gap-2">
            <User className="w-5 h-5 text-primary" />
            Completar Cadastro
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Precisamos de mais algumas informações para finalizar seu cadastro.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded flex items-start gap-2 text-xs text-destructive">
            <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome Completo */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider" htmlFor="compFullName">
              Nome Completo
            </label>
            <input
              type="text"
              id="compFullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={isPending}
              placeholder="Nome e sobrenome"
              className="w-full p-2.5 bg-secondary border border-border focus:border-primary rounded text-base outline-none text-foreground"
            />
          </div>

          {/* Telefone */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider" htmlFor="compPhone">
              Telefone (WhatsApp)
            </label>
            <input
              type="tel"
              id="compPhone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              disabled={isPending}
              placeholder="Ex: 5511999999999"
              className="w-full p-2.5 bg-secondary border border-border focus:border-primary rounded text-base outline-none text-foreground"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-2.5 bg-primary hover:bg-primary-hover text-primary-foreground font-bold rounded text-xs transition-all shadow flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 mt-2"
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-foreground" />}
            Salvar e Prosseguir
          </button>
        </form>
      </div>
    </div>
  )
}
