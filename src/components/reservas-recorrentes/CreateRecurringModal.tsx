'use client'

import React, { useState, useEffect } from 'react'
import { Repeat, X, Loader2, Calendar } from 'lucide-react'
import { CustomCustomerSelect, CustomBarberSelect } from '@/components/CustomSelect'
import { createRecurringReservationAction } from '@/app/painel/reservas-recorrentes/actions'

interface CreateRecurringModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (msg: string) => void
  barbers: any[]
  customers: any[]
  userRole: string | null
}

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export function CreateRecurringModal({
  isOpen,
  onClose,
  onSuccess,
  barbers,
  customers,
  userRole,
}: CreateRecurringModalProps) {
  const [formBarberId, setFormBarberId] = useState('')
  const [formDayOfWeek, setFormDayOfWeek] = useState<number | ''>('')
  const [formTimeSlot, setFormTimeSlot] = useState('')
  const [formIntervalWeeks, setFormIntervalWeeks] = useState<1 | 2>(1)
  const [formStartDate, setFormStartDate] = useState('')
  const [formCustomerMode, setFormCustomerMode] = useState<'registered' | 'unregistered'>('registered')
  const [formCustomerId, setFormCustomerId] = useState('')
  const [formCustomerName, setFormCustomerName] = useState('')
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [pending, setPending] = useState(false)

  // Pre-fill start date with next occurrence of chosen day of week
  useEffect(() => {
    if (formDayOfWeek === '' || formDayOfWeek === null) return
    const today = new Date()
    const currentDay = today.getDay()
    let daysUntil = (Number(formDayOfWeek) - currentDay + 7) % 7
    if (daysUntil === 0) daysUntil = 0
    const targetDate = new Date(today)
    targetDate.setDate(today.getDate() + daysUntil)
    const y = targetDate.getFullYear()
    const m = String(targetDate.getMonth() + 1).padStart(2, '0')
    const d = String(targetDate.getDate()).padStart(2, '0')
    setFormStartDate(`${y}-${m}-${d}`)
  }, [formDayOfWeek])

  // Fetch available slots when barber and date change
  useEffect(() => {
    if (!formBarberId || !formStartDate) {
      setAvailableSlots([])
      return
    }

    async function loadSlots() {
      setLoadingSlots(true)
      try {
        const res = await fetch(`/api/booking/slots?barberId=${formBarberId}&dateStr=${formStartDate}&duration=60&allowPast=true`)
        const data = await res.json()
        setAvailableSlots(data.slots || [])
      } catch (err) {
        console.error('Error fetching slots for recurring modal:', err)
        setAvailableSlots([])
      } finally {
        setLoadingSlots(false)
      }
    }
    loadSlots()
  }, [formBarberId, formStartDate])

  const handleClose = () => {
    setFormBarberId('')
    setFormDayOfWeek('')
    setFormTimeSlot('')
    setFormIntervalWeeks(1)
    setFormStartDate('')
    setFormCustomerMode('registered')
    setFormCustomerId('')
    setFormCustomerName('')
    setErrorMsg('')
    onClose()
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!formBarberId || formDayOfWeek === '' || !formTimeSlot || !formStartDate) {
      setErrorMsg('Preencha todos os campos obrigatórios.')
      return
    }

    if (formCustomerMode === 'registered' && !formCustomerId) {
      setErrorMsg('Selecione um cliente cadastrado.')
      return
    }

    if (formCustomerMode === 'unregistered' && !formCustomerName.trim()) {
      setErrorMsg('Digite o nome do cliente.')
      return
    }

    setPending(true)
    try {
      const selectedCust = customers.find(c => c.id === formCustomerId)
      const custName = formCustomerMode === 'registered' ? (selectedCust?.full_name || formCustomerName) : formCustomerName
      const res = await createRecurringReservationAction(
        formBarberId,
        Number(formDayOfWeek),
        formTimeSlot,
        formIntervalWeeks,
        formStartDate,
        formCustomerMode === 'registered' ? formCustomerId : null,
        custName
      )

      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        onSuccess(res.message)
        handleClose()
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao criar reserva recorrente.')
    } finally {
      setPending(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-card border border-border/80 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-foreground">Nova Reserva Recorrente</h3>
              <p className="text-[11px] text-muted-foreground">Fixar horário permanente no calendário</p>
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

        <form onSubmit={handleCreateSubmit} className="space-y-3">
          {/* Customer Selection */}
          <div className="space-y-2 bg-secondary/30 p-3 rounded-xl border border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-bold text-cyan-400 tracking-wider">Cliente</span>
              <div className="flex items-center gap-1 bg-background p-0.5 rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => setFormCustomerMode('registered')}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded ${formCustomerMode === 'registered' ? 'bg-cyan-500/20 text-cyan-300' : 'text-muted-foreground'}`}
                >
                  Cadastrado
                </button>
                <button
                  type="button"
                  onClick={() => setFormCustomerMode('unregistered')}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded ${formCustomerMode === 'unregistered' ? 'bg-cyan-500/20 text-cyan-300' : 'text-muted-foreground'}`}
                >
                  Sem Cadastro
                </button>
              </div>
            </div>

            {formCustomerMode === 'registered' ? (
              <CustomCustomerSelect
                customers={customers}
                selectedId={formCustomerId}
                onSelect={(id, name) => {
                  setFormCustomerId(id)
                  setFormCustomerName(name)
                }}
                disabled={pending}
              />
            ) : (
              <input
                type="text"
                placeholder="Nome do cliente (ex: Seu Zé)..."
                value={formCustomerName}
                onChange={(e) => setFormCustomerName(e.target.value)}
                className="w-full px-3 py-2 bg-secondary/60 border border-border focus:border-cyan-500 rounded-xl text-xs text-foreground outline-none"
                required={formCustomerMode === 'unregistered'}
              />
            )}
          </div>

          {/* Barber Selection */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Barbeiro *</label>
            <CustomBarberSelect
              barbers={barbers}
              selectedId={formBarberId}
              onSelect={setFormBarberId}
              disabled={pending || userRole === 'barber'}
            />
          </div>

          {/* Day of Week */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Dia da Semana *</label>
            <select
              value={formDayOfWeek}
              onChange={(e) => setFormDayOfWeek(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 bg-secondary/50 border border-border focus:border-cyan-500 rounded-xl text-xs text-foreground outline-none cursor-pointer"
              required
            >
              <option value="">Selecione o dia da semana...</option>
              {DAY_NAMES.map((name, idx) => (
                <option key={idx} value={idx}>{name}</option>
              ))}
            </select>
          </div>

          {/* Frequency & Start Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Frequência *</label>
              <select
                value={formIntervalWeeks}
                onChange={(e) => setFormIntervalWeeks(Number(e.target.value) as 1 | 2)}
                className="w-full px-3 py-2 bg-secondary/50 border border-border focus:border-cyan-500 rounded-xl text-xs text-foreground outline-none cursor-pointer font-bold"
              >
                <option value={1}>Toda Semana (Semanal)</option>
                <option value={2}>A cada 2 semanas (Quinzenal)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Início em *</label>
              <input
                type="date"
                value={formStartDate}
                onChange={(e) => setFormStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-secondary/50 border border-border focus:border-cyan-500 rounded-xl text-xs text-foreground outline-none cursor-pointer"
                required
              />
            </div>
          </div>

          {/* Time slot selector */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Horário Fixo *</label>
            {loadingSlots ? (
              <div className="p-2 bg-secondary/30 rounded-xl text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" /> Carregando horários...
              </div>
            ) : availableSlots.length > 0 ? (
              <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto p-1 bg-secondary/20 rounded-xl border border-border/50">
                {availableSlots.map(t => {
                  const isSel = formTimeSlot === t
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormTimeSlot(t)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                        isSel ? 'bg-cyan-500 text-black border-cyan-400 shadow-sm' : 'bg-secondary/60 hover:bg-secondary border-border text-foreground'
                      }`}
                    >
                      {t}
                    </button>
                  )
                })}
              </div>
            ) : (
              <input
                type="time"
                value={formTimeSlot}
                onChange={(e) => setFormTimeSlot(e.target.value)}
                className="w-full px-3 py-2 bg-secondary/50 border border-border focus:border-cyan-500 rounded-xl text-xs text-foreground outline-none cursor-pointer"
                required
              />
            )}
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
              className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-black font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
            >
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Reserva Recorrente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
