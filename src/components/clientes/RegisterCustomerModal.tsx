'use client'

import React, { useState } from 'react'
import { User, Mail, Phone, X, CheckCircle2, Loader2, Copy, Check } from 'lucide-react'
import { registerCustomerManuallyAction } from '@/app/painel/clientes/actions'

interface RegisterCustomerModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function RegisterCustomerModal({ isOpen, onClose, onSuccess }: RegisterCustomerModalProps) {
  const [regFullName, setRegFullName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regAcceptTerms, setRegAcceptTerms] = useState(false)
  const [regErrorMsg, setRegErrorMsg] = useState('')
  const [regSuccessData, setRegSuccessData] = useState<any>(null)
  const [regPending, setRegPending] = useState(false)

  const handleClose = () => {
    setRegFullName('')
    setRegEmail('')
    setRegPhone('')
    setRegAcceptTerms(false)
    setRegErrorMsg('')
    setRegSuccessData(null)
    onClose()
  }

  const handleManualRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegErrorMsg('')

    if (!regFullName || !regEmail || !regPhone) {
      setRegErrorMsg('Por favor, preencha todos os campos obrigatórios.')
      return
    }

    if (!regAcceptTerms) {
      setRegErrorMsg('Você deve confirmar que explicou os termos ao cliente.')
      return
    }

    setRegPending(true)
    try {
      const res = await registerCustomerManuallyAction({
        fullName: regFullName,
        email: regEmail,
        phone: regPhone
      })

      if (!res.success) {
        setRegErrorMsg(res.message)
      } else {
        setRegSuccessData({
          email: regEmail,
          fullName: regFullName
        })
        onSuccess()
      }
    } catch (err: any) {
      setRegErrorMsg(err.message || 'Erro inesperado ao cadastrar cliente.')
    } finally {
      setRegPending(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 animate-in fade-in duration-150">
      <div className="bg-card border border-border/80 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
        <div className="flex justify-between items-center pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-foreground">Cadastrar Cliente Manualmente</h3>
              <p className="text-[11px] text-muted-foreground">Adicione um novo cliente diretamente pelo painel</p>
            </div>
          </div>
          <button onClick={handleClose} aria-label="Fechar" className="p-1 text-muted-foreground hover:text-foreground rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {regErrorMsg && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive font-semibold">
            {regErrorMsg}
          </div>
        )}

        {regSuccessData ? (
          <div className="space-y-4 text-center py-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-500/20">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-serif font-bold text-base text-foreground">Cliente Cadastrado com Sucesso!</h4>
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">{regSuccessData.fullName}</strong> foi adicionado ao sistema.
              </p>
            </div>

            <button
              onClick={handleClose}
              className="w-full py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-md cursor-pointer"
            >
              Concluir
            </button>
          </div>
        ) : (
          <form onSubmit={handleManualRegister} className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Nome Completo *</label>
              <input
                type="text"
                placeholder="Ex: João da Silva"
                value={regFullName}
                onChange={(e) => setRegFullName(e.target.value)}
                className="w-full px-3 py-2 bg-secondary/50 border border-border focus:border-primary rounded-xl text-xs text-foreground outline-none"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">E-mail *</label>
              <input
                type="email"
                placeholder="Ex: joao@email.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className="w-full px-3 py-2 bg-secondary/50 border border-border focus:border-primary rounded-xl text-xs text-foreground outline-none"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Telefone / WhatsApp *</label>
              <input
                type="tel"
                placeholder="Ex: (11) 98765-4321"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                className="w-full px-3 py-2 bg-secondary/50 border border-border focus:border-primary rounded-xl text-xs text-foreground outline-none"
                required
              />
            </div>

            <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={regAcceptTerms}
                onChange={(e) => setRegAcceptTerms(e.target.checked)}
                className="mt-0.5 rounded accent-primary w-4 h-4"
              />
              <span>Confirmo que o cliente solicitou o cadastro.</span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={regPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={regPending}
                className="px-5 py-2 bg-primary text-primary-foreground font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
              >
                {regPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cadastrar Cliente'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
