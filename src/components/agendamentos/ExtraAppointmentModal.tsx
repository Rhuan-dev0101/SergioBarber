'use client'

import React, { useState, useEffect, useTransition } from 'react'
import {
  User, X, Loader2, DollarSign, Wallet, Sparkles, Clock, Zap, CheckCircle2
} from 'lucide-react'
import { CustomServiceSelect, CustomBarberSelect, CustomGenericSelect, CustomCustomerSelect } from '@/components/CustomSelect'
import { createExtraAppointmentAction } from '@/app/painel/agendamentos/actions'

interface ExtraAppointmentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (message: string) => void
  barbers: any[]
  services: any[]
  customers: any[]
  defaultDate: string
  defaultBarberId: string
  userRole: string | null
}

export function ExtraAppointmentModal({
  isOpen,
  onClose,
  onSuccess,
  barbers,
  services,
  customers,
  defaultDate,
  defaultBarberId,
  userRole,
}: ExtraAppointmentModalProps) {
  const [isPending, startTransition] = useTransition()

  // Local modal form state
  const [extraClientName, setExtraClientName] = useState('')
  const [extraCustomerId, setExtraCustomerId] = useState<string>('')
  const [extraIsRegistered, setExtraIsRegistered] = useState<boolean>(true)
  const [extraBarberId, setExtraBarberId] = useState('')
  const [extraServiceId, setExtraServiceId] = useState('')
  const [extraDate, setExtraDate] = useState('')
  const [extraTime, setExtraTime] = useState('')
  const [extraNotes, setExtraNotes] = useState('')
  const [extraPaymentMethod, setExtraPaymentMethod] = useState('cash')
  const [extraIsPaid, setExtraIsPaid] = useState(true)
  const [extraPrice, setExtraPrice] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState('')

  // Initialize defaults when modal opens
  useEffect(() => {
    if (isOpen) {
      setExtraBarberId(defaultBarberId)
      setExtraDate(defaultDate)
      // Pre-fill with current time
      const now = new Date()
      const h = String(now.getHours()).padStart(2, '0')
      const m = String(now.getMinutes()).padStart(2, '0')
      setExtraTime(`${h}:${m}`)
      setExtraIsPaid(true)
      setExtraPaymentMethod('cash')
      setErrorMsg('')
    }
  }, [isOpen, defaultBarberId, defaultDate])

  const handleClose = () => {
    setExtraClientName('')
    setExtraCustomerId('')
    setExtraIsRegistered(true)
    setExtraBarberId('')
    setExtraServiceId('')
    setExtraDate('')
    setExtraTime('')
    setExtraNotes('')
    setExtraPaymentMethod('cash')
    setExtraIsPaid(true)
    setExtraPrice('')
    setErrorMsg('')
    onClose()
  }

  const handleCreateExtra = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    const selectedCust = customers.find(c => c.id === extraCustomerId)
    const finalClientName = extraIsRegistered ? (selectedCust?.full_name || extraClientName) : extraClientName

    if ((extraIsRegistered && !extraCustomerId) || (!extraIsRegistered && !extraClientName.trim()) || !extraBarberId || !extraServiceId || !extraDate || !extraTime) {
      setErrorMsg('Preencha todos os campos obrigatórios.')
      return
    }

    const priceOverride = extraPrice !== '' ? parseFloat(extraPrice) : null

    startTransition(async () => {
      const res = await createExtraAppointmentAction(
        finalClientName,
        extraBarberId,
        extraServiceId,
        extraDate,
        extraTime,
        extraNotes,
        extraIsPaid ? extraPaymentMethod : 'cash',
        extraIsPaid,
        priceOverride,
        extraIsRegistered ? extraCustomerId : null
      )

      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        onSuccess(res.message)
        handleClose()
      }
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border-2 border-dashed border-amber-500/40 rounded-2xl p-6 sm:p-8 w-full max-w-md space-y-5 relative shadow-2xl max-h-[90vh] overflow-y-auto">
        
        {/* Error message */}
        {errorMsg && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-amber-500/20">
          <h3 className="font-serif font-bold text-lg text-foreground flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Atendimento Extra
          </h3>
          <button
            onClick={handleClose}
            aria-label="Fechar"
            className="text-muted-foreground hover:text-foreground p-1.5 hover:bg-secondary rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-[11px] text-amber-400/80 bg-amber-500/5 border border-amber-500/20 rounded-lg p-2.5 flex items-start gap-2">
          <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <span>Este atendimento <strong>ignora validações de horário e data (incluindo datas/horários passados)</strong> — ideal para encaixes fora do expediente, almoço ou <strong>registro retroativo de atendimentos esquecidos</strong>.</span>
        </p>

        <form onSubmit={handleCreateExtra} className="space-y-4">
          {/* Customer Selector */}
          <div className="space-y-2.5 bg-secondary/30 p-3.5 rounded-xl border border-border/60">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <span className="text-[11px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Cliente
              </span>
              <div className="flex items-center gap-1 bg-background p-0.5 rounded-lg border border-border/60">
                <button
                  type="button"
                  onClick={() => {
                    setExtraIsRegistered(true)
                    setExtraClientName('')
                  }}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                    extraIsRegistered
                      ? 'bg-amber-500/20 text-amber-400 shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Cadastrado
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExtraIsRegistered(false)
                    setExtraCustomerId('')
                  }}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                    !extraIsRegistered
                      ? 'bg-amber-500/20 text-amber-400 shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Sem Cadastro
                </button>
              </div>
            </div>

            {extraIsRegistered ? (
              <CustomCustomerSelect
                customers={customers}
                selectedId={extraCustomerId}
                onSelect={(id, name) => {
                  setExtraCustomerId(id)
                  setExtraClientName(name)
                }}
                disabled={isPending}
              />
            ) : (
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Nome do cliente (ex: Seu Zé)..."
                  value={extraClientName}
                  onChange={(e) => setExtraClientName(e.target.value)}
                  disabled={isPending}
                  className="w-full pl-10 pr-4 py-2.5 bg-secondary/60 border border-border focus:border-amber-500 rounded-xl text-sm outline-none text-foreground placeholder:text-muted-foreground"
                  required={!extraIsRegistered}
                />
              </div>
            )}
          </div>

          {/* Barber */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Barbeiro</label>
            <CustomBarberSelect
              barbers={barbers}
              selectedId={extraBarberId}
              onSelect={setExtraBarberId}
              disabled={isPending || userRole === 'barber'}
            />
          </div>

          {/* Service */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Serviço</label>
            <CustomServiceSelect
              services={services}
              selectedId={extraServiceId}
              onSelect={(id) => {
                setExtraServiceId(id)
                const svc = services.find(s => s.id === id)
                if (svc) setExtraPrice(String(svc.price))
              }}
              disabled={isPending}
            />
          </div>

          {/* Editable Price */}
          {extraServiceId && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Valor (R$)</label>
              <div className="relative">
                <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={extraPrice}
                  onChange={(e) => setExtraPrice(e.target.value)}
                  disabled={isPending}
                  className="w-full pl-10 pr-4 py-2.5 bg-secondary/60 border border-border focus:border-amber-500 rounded-xl text-sm outline-none text-foreground font-bold"
                  placeholder="Preço do serviço"
                />
              </div>
            </div>
          )}

          {/* Date & Time (side by side) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Data</label>
              <input
                type="date"
                value={extraDate}
                onChange={(e) => setExtraDate(e.target.value)}
                disabled={isPending}
                className="w-full px-3 py-2.5 bg-secondary/60 border border-border focus:border-amber-500 rounded-xl text-sm text-foreground outline-none cursor-pointer"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Hora</label>
              <input
                type="time"
                value={extraTime}
                onChange={(e) => setExtraTime(e.target.value)}
                disabled={isPending}
                className="w-full px-3 py-2.5 bg-secondary/60 border border-border focus:border-amber-500 rounded-xl text-sm text-foreground outline-none cursor-pointer"
                required
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Observação (opcional)</label>
            <textarea
              placeholder="Ex: atendido durante o almoço, cliente chegou sem marcar..."
              value={extraNotes}
              onChange={(e) => setExtraNotes(e.target.value)}
              disabled={isPending}
              rows={2}
              className="w-full p-3 bg-secondary/50 border border-border focus:border-amber-500 rounded-xl text-xs text-foreground placeholder:text-muted-foreground/60 outline-none resize-none"
            />
          </div>

          {/* Paid Toggle */}
          <div className="space-y-3 bg-secondary/30 p-3.5 rounded-xl border border-border/60">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs font-bold text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Já foi pago
              </span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={extraIsPaid}
                  onChange={(e) => setExtraIsPaid(e.target.checked)}
                  disabled={isPending}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-secondary rounded-full peer peer-checked:bg-emerald-600 transition-colors border border-border peer-checked:border-emerald-500 cursor-pointer" />
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
              </div>
            </label>

            {extraIsPaid && (
              <div className="space-y-1.5 pt-1 border-t border-border/40">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Forma de Pagamento</label>
                <CustomGenericSelect
                  options={[
                    { value: 'cash', label: 'Dinheiro', icon: <DollarSign className="w-4 h-4 text-emerald-400" /> },
                    { value: 'card', label: 'Cartão', icon: <Wallet className="w-4 h-4 text-sky-400" /> },
                    { value: 'pix', label: 'Pix', icon: <Sparkles className="w-4 h-4 text-amber-400" /> },
                  ]}
                  selectedValue={extraPaymentMethod}
                  onSelect={setExtraPaymentMethod}
                  disabled={isPending}
                />
              </div>
            )}

            {!extraIsPaid && (
              <p className="text-[10px] text-amber-400/70 italic flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-amber-400" />
                Aparecerá no Checkout do Dia para pagamento posterior.
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:via-amber-400 hover:to-amber-500 text-black font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50 active:scale-[0.98]"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Registrar Atendimento Extra
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
