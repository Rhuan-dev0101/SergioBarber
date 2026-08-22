'use client'

import React, { useState, useEffect, useTransition } from 'react'
import {
  Scissors, Clock, User, X, Loader2, Check, DollarSign, Wallet, Sparkles, Crown
} from 'lucide-react'
import { CustomServiceSelect, CustomBarberSelect, CustomGenericSelect, CustomCustomerSelect } from '@/components/CustomSelect'
import { CreatePackageForm } from '@/components/CreatePackageForm'
import { createWalkInAppointmentAction } from '@/app/painel/agendamentos/actions'

interface WalkInModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (message: string) => void
  barbers: any[]
  services: any[]
  customers: any[]
  defaultDate: string
  defaultBarberId: string
  defaultTime: string
  userRole: string | null
  currentUser: any
}

export function WalkInModal({
  isOpen,
  onClose,
  onSuccess,
  barbers,
  services,
  customers,
  defaultDate,
  defaultBarberId,
  defaultTime,
  userRole,
  currentUser,
}: WalkInModalProps) {
  const [isPending, startTransition] = useTransition()

  // Local modal form state
  const [modalTab, setModalTab] = useState<'avulso' | 'pacote'>('avulso')
  const [clientName, setClientName] = useState('')
  const [selectedBarberId, setSelectedBarberId] = useState('')
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [walkInDate, setWalkInDate] = useState('')
  const [walkInTime, setWalkInTime] = useState('')
  const [walkInNotes, setWalkInNotes] = useState('')
  const [walkInPaymentMethod, setWalkInPaymentMethod] = useState('cash')
  const [walkInCustomerId, setWalkInCustomerId] = useState<string>('')
  const [walkInIsRegistered, setWalkInIsRegistered] = useState<boolean>(true)
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Initialize defaults when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedBarberId(defaultBarberId)
      setWalkInDate(defaultDate)
      setWalkInTime(defaultTime)
      setErrorMsg('')
    }
  }, [isOpen, defaultBarberId, defaultDate, defaultTime])

  // Load slots for walk-in form
  useEffect(() => {
    if (!isOpen || !selectedBarberId || !selectedServiceId || !walkInDate) {
      setAvailableSlots([])
      return
    }

    async function loadSlots() {
      setLoadingSlots(true)
      const service = services.find(s => s.id === selectedServiceId)
      if (!service) {
        setLoadingSlots(false)
        return
      }

      try {
        const res = await fetch(`/api/booking/slots?barberId=${selectedBarberId}&dateStr=${walkInDate}&duration=${service.duration}&allowPast=true`)
        const data = await res.json()
        let fetchedSlots: string[] = data.slots || []

        if (defaultTime && !fetchedSlots.includes(defaultTime)) {
          fetchedSlots.push(defaultTime)
          fetchedSlots.sort()
        }

        setAvailableSlots(fetchedSlots)

        if (defaultTime && fetchedSlots.includes(defaultTime)) {
          setWalkInTime(defaultTime)
        } else if (fetchedSlots.length > 0 && !fetchedSlots.includes(walkInTime)) {
          setWalkInTime(fetchedSlots[0])
        }
      } catch (error) {
        console.error('Error fetching slots:', error)
      } finally {
        setLoadingSlots(false)
      }
    }
    loadSlots()
  }, [isOpen, selectedBarberId, selectedServiceId, walkInDate, services])

  const handleClose = () => {
    setClientName('')
    setWalkInCustomerId('')
    setSelectedBarberId('')
    setSelectedServiceId('')
    setWalkInDate('')
    setWalkInTime('')
    setWalkInNotes('')
    setWalkInPaymentMethod('cash')
    setModalTab('avulso')
    setErrorMsg('')
    onClose()
  }

  const handleCreateWalkIn = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    const selectedCust = customers.find(c => c.id === walkInCustomerId)
    const finalClientName = walkInIsRegistered ? (selectedCust?.full_name || clientName) : clientName

    if ((walkInIsRegistered && !walkInCustomerId) || (!walkInIsRegistered && !clientName.trim()) || !selectedBarberId || !selectedServiceId || !walkInDate || !walkInTime) {
      setErrorMsg('Todos os campos são obrigatórios. Selecione o cliente ou digite o nome.')
      return
    }

    startTransition(async () => {
      const res = await createWalkInAppointmentAction(
        finalClientName,
        selectedBarberId,
        selectedServiceId,
        walkInDate,
        walkInTime,
        walkInNotes,
        walkInPaymentMethod,
        walkInIsRegistered ? walkInCustomerId : null
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
      <div className={`bg-card border border-border/80 rounded-2xl p-6 sm:p-8 w-full space-y-5 relative shadow-2xl max-h-[90vh] overflow-y-auto transition-all ${
        modalTab === 'pacote' ? 'max-w-xl' : 'max-w-md'
      }`}>
        
        {/* Error message */}
        {errorMsg && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Header & Segmented Tab Controls */}
        <div className="space-y-3 pb-3 border-b border-border/40">
          <div className="flex justify-between items-center">
            <h3 className="font-serif font-bold text-lg text-foreground flex items-center gap-2">
              {modalTab === 'avulso' ? (
                <><Scissors className="w-5 h-5 text-primary rotate-45" /> Novo Agendamento Presencial</>
              ) : (
                <><Crown className="w-5 h-5 text-primary" /> Novo Pacote Mensal VIP</>
              )}
            </h3>
            <button
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground p-1.5 hover:bg-secondary rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Segmented Tab Selector */}
          <div className="flex items-center gap-1.5 bg-secondary/60 p-1 rounded-xl border border-border/60">
            <button
              type="button"
              onClick={() => setModalTab('avulso')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                modalTab === 'avulso'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Horário Avulso</span>
            </button>
            <button
              type="button"
              onClick={() => setModalTab('pacote')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                modalTab === 'pacote'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              <span>Pacote Mensal</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Horário Avulso (Single Walk-in Appointment) */}
        {modalTab === 'avulso' && (
          <form onSubmit={handleCreateWalkIn} className="space-y-4">
            {/* Customer Selector with Segmented Tabs */}
            <div className="space-y-2.5 bg-secondary/30 p-3.5 rounded-xl border border-border/60">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="text-[11px] uppercase font-bold text-primary tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Cliente
                </span>
                <div className="flex items-center gap-1 bg-background p-0.5 rounded-lg border border-border/60">
                  <button
                    type="button"
                    onClick={() => {
                      setWalkInIsRegistered(true)
                      setClientName('')
                    }}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                      walkInIsRegistered
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Cliente Cadastrado
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWalkInIsRegistered(false)
                      setWalkInCustomerId('')
                    }}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                      !walkInIsRegistered
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Sem Cadastro / Presencial
                  </button>
                </div>
              </div>

              {walkInIsRegistered ? (
                <CustomCustomerSelect
                  customers={customers}
                  selectedId={walkInCustomerId}
                  onSelect={(id, name) => {
                    setWalkInCustomerId(id)
                    setClientName(name)
                  }}
                  disabled={isPending}
                />
              ) : (
                <div className="space-y-1">
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Nome completo do cliente ou apelido (ex: Seu Zé, Beiço)..."
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      disabled={isPending}
                      className="w-full pl-10 pr-4 py-2.5 bg-secondary/60 border border-border focus:border-primary rounded-xl text-sm outline-none text-foreground placeholder:text-muted-foreground"
                      required={!walkInIsRegistered}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground italic pl-1">
                    Digite o nome ou apelido para agendamentos rápidos sem cadastro prévio.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Barbeiro</label>
              <CustomBarberSelect
                barbers={barbers}
                selectedId={selectedBarberId}
                onSelect={setSelectedBarberId}
                disabled={isPending || userRole === 'barber'}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Serviço</label>
              <CustomServiceSelect
                services={services}
                selectedId={selectedServiceId}
                onSelect={setSelectedServiceId}
                disabled={isPending}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="wDate" className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Data</label>
              <input
                id="wDate"
                type="date"
                value={walkInDate}
                onChange={(e) => setWalkInDate(e.target.value)}
                disabled={isPending}
                className="w-full px-4 py-3 bg-secondary/60 border border-border focus:border-primary rounded-xl text-base text-foreground outline-none cursor-pointer"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Horários Disponíveis</label>
              {loadingSlots ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-3 bg-secondary/30 rounded-xl px-4 border border-border/40">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" /> Carregando horários livres...
                </div>
              ) : availableSlots.length > 0 ? (
                <div className="grid grid-cols-4 gap-2 max-h-44 overflow-y-auto p-1 bg-secondary/20 rounded-xl border border-border/50">
                  {availableSlots.map(t => {
                    const isSelected = walkInTime === t
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setWalkInTime(t)}
                        disabled={isPending}
                        className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-amber-500/20 scale-105'
                            : 'bg-secondary/60 hover:bg-secondary/90 border-border text-foreground'
                        }`}
                      >
                        <Clock className="w-3 h-3 shrink-0" />
                        <span>{t}</span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic bg-secondary/40 p-3 rounded-xl border border-border/60">
                  Selecione barbeiro, serviço e data para carregar horários disponíveis.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Forma de Pagamento (Presencial)</label>
              <CustomGenericSelect
                options={[
                  { value: 'cash', label: 'Dinheiro', icon: <DollarSign className="w-4 h-4 text-emerald-400" /> },
                  { value: 'card', label: 'Cartão (Débito / Crédito)', icon: <Wallet className="w-4 h-4 text-sky-400" /> },
                  { value: 'pix', label: 'Pix (No local)', icon: <Sparkles className="w-4 h-4 text-amber-400" /> },
                  { value: 'other', label: 'Outro', icon: <Scissors className="w-4 h-4 text-purple-400" /> }
                ]}
                selectedValue={walkInPaymentMethod}
                onSelect={setWalkInPaymentMethod}
                disabled={isPending}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="wNotes" className="text-xs font-semibold text-muted-foreground uppercase">Observações Extras</label>
              <textarea
                id="wNotes"
                placeholder="Ex: Prefere corte tesoura, cliente novo..."
                value={walkInNotes}
                onChange={(e) => setWalkInNotes(e.target.value)}
                disabled={isPending}
                rows={2}
                className="w-full p-3 bg-secondary/50 border border-border focus:border-primary rounded-xl text-xs text-foreground placeholder:text-muted-foreground/60 outline-none resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isPending || (availableSlots.length > 0 && !walkInTime)}
              className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  Confirmar Agendamento Presencial
                  <Check className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Tab 2: Pacote Mensal VIP */}
        {modalTab === 'pacote' && (
          <CreatePackageForm
            initialBarberId={selectedBarberId}
            initialStartDate={walkInDate}
            initialTimeSlot={walkInTime}
            onSuccess={(msg) => {
              onSuccess(msg || 'Pacote mensal criado com sucesso!')
              handleClose()
            }}
            onCancel={handleClose}
          />
        )}
      </div>
    </div>
  )
}
