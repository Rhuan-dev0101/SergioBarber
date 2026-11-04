'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Plus, DollarSign, Zap, Scissors, Clock, User, Sparkles, Wallet, X, Check, Loader2, CheckCircle2, AlertCircle, ChevronRight
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { 
  createWalkInAppointmentAction, 
  createExtraAppointmentAction, 
  bulkCheckoutAction 
} from '@/app/painel/agendamentos/actions'
import { CustomServiceSelect, CustomBarberSelect, CustomGenericSelect, CustomCustomerSelect } from '@/components/CustomSelect'
import { getLocalDateStr } from '@/lib/utils'
export function PainelQuickActions() {
  const router = useRouter()
  const supabase = createClient()

  const [role, setRole] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)

  // Data for selectors & checkout
  const [barbers, setBarbers] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [unpaidAppts, setUnpaidAppts] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(false)

  // Modals visibility
  const [showWalkInModal, setShowWalkInModal] = useState(false)
  const [showExtraModal, setShowExtraModal] = useState(false)
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)

  // Walk-in form states
  const [clientName, setClientName] = useState('')
  const [selectedBarberId, setSelectedBarberId] = useState('')
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [walkInDate, setWalkInDate] = useState('')
  const [walkInTime, setWalkInTime] = useState('')
  const [walkInNotes, setWalkInNotes] = useState('')
  const [walkInPaymentMethod, setWalkInPaymentMethod] = useState('cash')
  const [walkInCustomerId, setWalkInCustomerId] = useState('')
  const [walkInIsRegistered, setWalkInIsRegistered] = useState(true)
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Atendimento Extra form states
  const [extraClientName, setExtraClientName] = useState('')
  const [extraCustomerId, setExtraCustomerId] = useState('')
  const [extraIsRegistered, setExtraIsRegistered] = useState(true)
  const [extraBarberId, setExtraBarberId] = useState('')
  const [extraServiceId, setExtraServiceId] = useState('')
  const [extraDate, setExtraDate] = useState('')
  const [extraTime, setExtraTime] = useState('')
  const [extraNotes, setExtraNotes] = useState('')
  const [extraPaymentMethod, setExtraPaymentMethod] = useState('cash')
  const [extraIsPaid, setExtraIsPaid] = useState(true)
  const [extraPrice, setExtraPrice] = useState('')

  // Checkout do Dia state
  type CheckoutItem = {
    apptId: string
    customerName: string
    serviceName: string
    barberName?: string
    price: number
    time: string
    originalMethod: string
    selectedMethod: string
    selected: boolean
    isPackage: boolean
    isExtra: boolean
    status: 'idle' | 'success' | 'error'
    errorMsg?: string
  }
  const [checkoutItems, setCheckoutItems] = useState<CheckoutItem[]>([])
  const [checkoutProcessing, setCheckoutProcessing] = useState(false)
  const [checkoutDone, setCheckoutDone] = useState(false)

  // Feedback messages
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isPending, startTransition] = useTransition()

  const todayLocalStr = new Date().toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).split('/').reverse().join('-')

  // Load user & static option data
  const loadData = async () => {
    try {
      setLoadingData(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      setCurrentUser(session.user)

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()
      if (profile) setRole(profile.role)

      // Barbers
      const { data: dbBarbers } = await supabase
        .from('barbers')
        .select('id, is_active, photo_url, profiles(id, full_name)')
        .eq('is_active', true)

      if (dbBarbers) {
        const formatted = dbBarbers
          .filter((b: any) => b.profiles)
          .map((b: any) => ({
            id: b.id,
            full_name: b.profiles.full_name,
            photo_url: b.photo_url || (b.profiles.full_name?.toLowerCase()?.includes('sergio') ? '/barbers/sergio.jpg' : null)
          }))
        setBarbers(formatted)
      }

      // Services
      const { data: dbServices } = await supabase
        .from('services')
        .select('id, name, price, duration')
        .eq('is_active', true)
      setServices(dbServices || [])

      // Customers
      const { data: dbCust } = await supabase
        .from('profiles')
        .select('id, full_name, phone, role')
        .order('full_name')
      setCustomers((dbCust || []).filter((c: any) => c.role !== 'admin'))

      // Unpaid appointments for today
      let query = supabase
        .from('appointments')
        .select(`
          id, start_time, status, notes, is_extra, customer_id, barber_id, package_subscription_id,
          services (name, price),
          payments (total_amount, status, method),
          package_subscriptions (package_price, total_sessions)
        `)
      
      if (profile?.role === 'barber') {
        query = query.eq('barber_id', session.user.id)
      }

      const { data: appts } = await query.order('start_time', { ascending: true })

      if (appts && appts.length > 0) {
        const customerIds = Array.from(new Set(appts.map(a => a.customer_id).filter(Boolean)))
        const barberIds = Array.from(new Set(appts.map(a => a.barber_id)))

        const { data: usersProfiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', [...customerIds, ...barberIds])

        const nameMap = (usersProfiles || []).reduce((acc: any, p: any) => {
          acc[p.id] = p.full_name
          return acc
        }, {})

        const enriched = appts.map((a: any) => {
          let cName = 'Cliente Presencial'
          if (a.customer_id) {
            cName = nameMap[a.customer_id] || 'Cliente'
          } else if (a.notes && a.notes.includes('[Atendimento Extra] Cliente:')) {
            const match = a.notes.match(/\[Atendimento Extra\] Cliente:\s*([^.]+)/)
            if (match) cName = match[1]
          } else if (a.notes && a.notes.includes('[Walk-in] Cliente:')) {
            const match = a.notes.match(/\[Walk-in\] Cliente:\s*([^.]+)/)
            if (match) cName = match[1]
          }
          return {
            ...a,
            customerName: cName,
            barberName: nameMap[a.barber_id] || 'Barbeiro'
          }
        })

        const unpaid = enriched.filter((a: any) => {
          if (getLocalDateStr(a.start_time) !== todayLocalStr) return false
          if (a.status === 'completed' || a.status === 'cancelled' || a.status === 'no_show') return false
          const payStatus = Array.isArray(a.payments) ? a.payments[0]?.status : (a.payments as any)?.status
          if (payStatus === 'paid' || payStatus === 'confirmed_manually') return false
          return true
        })

        setUnpaidAppts(unpaid)
      } else {
        setUnpaidAppts([])
      }
    } catch (err) {
      console.error('Error loading Quick Actions data:', err)
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Load available slots for Walk-in form
  useEffect(() => {
    if (!selectedBarberId || !selectedServiceId || !walkInDate) {
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
        const fetchedSlots: string[] = data.slots || []
        setAvailableSlots(fetchedSlots)
      } catch (error) {
        console.error('Error fetching slots:', error)
      } finally {
        setLoadingSlots(false)
      }
    }
    loadSlots()
  }, [selectedBarberId, selectedServiceId, walkInDate, services])

  // Open Handlers
  const handleOpenWalkIn = () => {
    setErrorMsg('')
    setSuccessMsg('')
    const targetBarber = role === 'barber' && currentUser?.id ? currentUser.id : ''
    setSelectedBarberId(targetBarber)
    setWalkInDate(todayLocalStr)
    setWalkInTime('')
    setShowWalkInModal(true)
  }

  const handleOpenExtra = () => {
    setErrorMsg('')
    setSuccessMsg('')
    const targetBarber = role === 'barber' && currentUser?.id ? currentUser.id : ''
    setExtraBarberId(targetBarber)
    setExtraDate(todayLocalStr)
    const now = new Date()
    const h = String(now.getHours()).padStart(2, '0')
    const m = String(now.getMinutes()).padStart(2, '0')
    setExtraTime(`${h}:${m}`)
    setExtraIsPaid(true)
    setExtraPaymentMethod('cash')
    setShowExtraModal(true)
  }

  const handleOpenCheckout = () => {
    setErrorMsg('')
    setSuccessMsg('')
    const getPrice = (appt: any) => {
      const payment = Array.isArray(appt.payments) ? appt.payments[0] : appt.payments
      if (payment?.total_amount) return Number(payment.total_amount)
      return Number(appt.services?.price || 0)
    }

    const items: CheckoutItem[] = unpaidAppts.map(a => {
      const payMethod = Array.isArray(a.payments) ? a.payments[0]?.method : a.payments?.method
      const formatTime = (dStr: string) => new Date(dStr).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false })
      return {
        apptId: a.id,
        customerName: a.customerName || 'Cliente',
        serviceName: a.services?.name || 'Serviço',
        barberName: a.barberName || 'Barbeiro',
        price: getPrice(a),
        time: formatTime(a.start_time),
        originalMethod: payMethod || 'cash',
        selectedMethod: payMethod || 'cash',
        selected: true,
        isPackage: !!a.package_subscription_id,
        isExtra: !!a.is_extra,
        status: 'idle'
      }
    })
    setCheckoutItems(items)
    setCheckoutDone(false)
    setCheckoutProcessing(false)
    setShowCheckoutModal(true)
  }

  // Create Walk-In submit
  const handleCreateWalkIn = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    const selectedCust = customers.find(c => c.id === walkInCustomerId)
    const finalClientName = walkInIsRegistered ? (selectedCust?.full_name || clientName) : clientName

    if ((walkInIsRegistered && !walkInCustomerId) || (!walkInIsRegistered && !clientName.trim()) || !selectedBarberId || !selectedServiceId || !walkInDate || !walkInTime) {
      setErrorMsg('Todos os campos são obrigatórios.')
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
        setSuccessMsg(res.message)
        setShowWalkInModal(false)
        loadData()
        router.refresh()
      }
    })
  }

  // Create Extra submit
  const handleCreateExtra = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
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
        setSuccessMsg(res.message)
        setShowExtraModal(false)
        loadData()
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Banner Notifications */}
      {errorMsg && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-xl flex items-center justify-between gap-3 text-xs sm:text-sm text-destructive shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button aria-label="Fechar aviso" onClick={() => setErrorMsg('')} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between gap-3 text-xs sm:text-sm text-emerald-400 font-medium shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button aria-label="Fechar aviso" onClick={() => setSuccessMsg('')} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Prominent Quick Actions Container */}
      <div className="glass p-5 rounded-2xl border border-primary/30 bg-gradient-to-r from-[#17140e] via-[#1c1810] to-[#121212] shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/15 border border-primary/30 text-primary">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-base text-foreground">Ações Rápidas</h2>
              <p className="text-[11px] text-muted-foreground">Atalhos diretos sem precisar ir para a agenda</p>
            </div>
          </div>
          <span className="text-[10px] uppercase font-extrabold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 hidden sm:inline-block">
            Modo Rápido
          </span>
        </div>

        {/* 3 Prominent Mobile-First Buttons Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Button 1: Novo Agendamento */}
          <button
            type="button"
            onClick={handleOpenWalkIn}
            className="w-full min-h-[52px] p-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-md flex items-center justify-between gap-3 transition-all cursor-pointer active:scale-95 border border-primary/40 group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-black/20 text-primary-foreground">
                <Plus className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="block font-black text-sm leading-tight">Novo Agendamento</span>
                <span className="text-[10px] opacity-80 block">Encaixe presencial</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 opacity-70 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Button 2: Checkout do Dia */}
          <button
            type="button"
            onClick={handleOpenCheckout}
            className="w-full min-h-[52px] p-4 bg-gradient-to-r from-[#6b4f1d] via-[#947629] to-[#6b4f1d] hover:brightness-110 text-white font-bold text-xs rounded-xl shadow-md border border-amber-400/40 flex items-center justify-between gap-3 transition-all cursor-pointer active:scale-95 group relative overflow-hidden"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-black/20 text-amber-300">
                <DollarSign className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="block font-black text-sm leading-tight text-white">Checkout do Dia</span>
                <span className="text-[10px] text-amber-200/80 block">
                  {unpaidAppts.length > 0 ? `${unpaidAppts.length} pendente(s)` : 'Baixa de pagamentos'}
                </span>
              </div>
            </div>

            {unpaidAppts.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-black text-[11px] font-black animate-pulse shadow-sm">
                {unpaidAppts.length}
              </span>
            )}
          </button>

          {/* Button 3: Atendimento Extra */}
          <button
            type="button"
            onClick={handleOpenExtra}
            className="w-full min-h-[52px] p-4 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold text-xs rounded-xl border-2 border-dashed border-amber-500/50 hover:border-amber-500/80 flex items-center justify-between gap-3 transition-all cursor-pointer active:scale-95 group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <div className="text-left">
                <span className="block font-black text-sm leading-tight text-amber-400">Atendimento Extra</span>
                <span className="text-[10px] text-amber-400/80 block">Fora do horário / exceção</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 opacity-70 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* ================= MODAL 1: NOVO AGENDAMENTO (WALK-IN) ================= */}
      {showWalkInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 animate-in fade-in duration-200">
          <div className="bg-card border border-border/80 rounded-2xl p-6 sm:p-8 w-full max-w-md space-y-5 relative shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-border/40">
              <h3 className="font-serif font-bold text-lg text-foreground flex items-center gap-2">
                <Scissors className="w-5 h-5 text-primary rotate-45" /> Novo Agendamento Presencial
              </h3>
              <button aria-label="Fechar"
                onClick={() => setShowWalkInModal(false)}
                className="text-muted-foreground hover:text-foreground p-1.5 hover:bg-secondary rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWalkIn} className="space-y-4">
              <div className="space-y-2.5 bg-secondary/30 p-3.5 rounded-xl border border-border/60">
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <span className="text-[11px] uppercase font-bold text-primary tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Cliente
                  </span>
                  <div className="flex items-center gap-1 bg-background p-0.5 rounded-lg border border-border/60">
                    <button
                      type="button"
                      onClick={() => { setWalkInIsRegistered(true); setClientName('') }}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                        walkInIsRegistered ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
                      }`}
                    >
                      Cadastrado
                    </button>
                    <button
                      type="button"
                      onClick={() => { setWalkInIsRegistered(false); setWalkInCustomerId('') }}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                        !walkInIsRegistered ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
                      }`}
                    >
                      Sem Cadastro
                    </button>
                  </div>
                </div>

                {walkInIsRegistered ? (
                  <CustomCustomerSelect
                    customers={customers}
                    selectedId={walkInCustomerId}
                    onSelect={(id, name) => { setWalkInCustomerId(id); setClientName(name) }}
                    disabled={isPending}
                  />
                ) : (
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Nome do cliente (ex: Seu Zé)..."
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      disabled={isPending}
                      className="w-full pl-10 pr-4 py-2.5 bg-secondary/60 border border-border focus:border-primary rounded-xl text-sm outline-none text-foreground placeholder:text-muted-foreground"
                      required={!walkInIsRegistered}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Barbeiro</label>
                <CustomBarberSelect
                  barbers={barbers}
                  selectedId={selectedBarberId}
                  onSelect={setSelectedBarberId}
                  disabled={isPending || role === 'barber'}
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
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Data</label>
                <input
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
                    {availableSlots.map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setWalkInTime(t)}
                        disabled={isPending}
                        className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                          walkInTime === t
                            ? 'bg-primary text-primary-foreground border-primary shadow-md scale-105'
                            : 'bg-secondary/60 hover:bg-secondary/90 border-border text-foreground'
                        }`}
                      >
                        <Clock className="w-3 h-3 shrink-0" />
                        <span>{t}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic bg-secondary/40 p-3 rounded-xl border border-border/60">
                    Selecione barbeiro, serviço e data para carregar horários disponíveis.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Forma de Pagamento</label>
                <CustomGenericSelect
                  options={[
                    { value: 'cash', label: 'Dinheiro', icon: <DollarSign className="w-4 h-4 text-emerald-400" /> },
                    { value: 'card', label: 'Cartão', icon: <Wallet className="w-4 h-4 text-sky-400" /> },
                    { value: 'pix', label: 'Pix', icon: <Sparkles className="w-4 h-4 text-amber-400" /> },
                  ]}
                  selectedValue={walkInPaymentMethod}
                  onSelect={setWalkInPaymentMethod}
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Observações</label>
                <textarea
                  placeholder="Observações adicionais..."
                  value={walkInNotes}
                  onChange={(e) => setWalkInNotes(e.target.value)}
                  disabled={isPending}
                  rows={2}
                  className="w-full p-3 bg-secondary/50 border border-border focus:border-primary rounded-xl text-xs text-foreground outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isPending || (availableSlots.length > 0 && !walkInTime)}
                className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Confirmar Agendamento Presencial
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: ATENDIMENTO EXTRA ================= */}
      {showExtraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 animate-in fade-in duration-200">
          <div className="bg-card border-2 border-dashed border-amber-500/40 rounded-2xl p-6 sm:p-8 w-full max-w-md space-y-5 relative shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-amber-500/20">
              <h3 className="font-serif font-bold text-lg text-foreground flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" /> Atendimento Extra
              </h3>
              <button aria-label="Fechar"
                onClick={() => setShowExtraModal(false)}
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
              <div className="space-y-2.5 bg-secondary/30 p-3.5 rounded-xl border border-border/60">
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <span className="text-[11px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Cliente
                  </span>
                  <div className="flex items-center gap-1 bg-background p-0.5 rounded-lg border border-border/60">
                    <button
                      type="button"
                      onClick={() => { setExtraIsRegistered(true); setExtraClientName('') }}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                        extraIsRegistered ? 'bg-amber-500/20 text-amber-400 shadow-sm' : 'text-muted-foreground'
                      }`}
                    >
                      Cadastrado
                    </button>
                    <button
                      type="button"
                      onClick={() => { setExtraIsRegistered(false); setExtraCustomerId('') }}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                        !extraIsRegistered ? 'bg-amber-500/20 text-amber-400 shadow-sm' : 'text-muted-foreground'
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
                    onSelect={(id, name) => { setExtraCustomerId(id); setExtraClientName(name) }}
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

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Barbeiro</label>
                <CustomBarberSelect
                  barbers={barbers}
                  selectedId={extraBarberId}
                  onSelect={setExtraBarberId}
                  disabled={isPending || role === 'barber'}
                />
              </div>

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
                    />
                  </div>
                </div>
              )}

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

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Observação (opcional)</label>
                <textarea
                  placeholder="Ex: atendido durante o almoço..."
                  value={extraNotes}
                  onChange={(e) => setExtraNotes(e.target.value)}
                  disabled={isPending}
                  rows={2}
                  className="w-full p-3 bg-secondary/50 border border-border focus:border-amber-500 rounded-xl text-xs text-foreground outline-none resize-none"
                />
              </div>

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
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-3 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-black font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-98"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Registrar Atendimento Extra
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: CHECKOUT DO DIA ================= */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 animate-in fade-in duration-150">
          <div className="bg-card border border-border/80 rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-border/60 bg-gradient-to-r from-[#1a150a] to-[#0e0e10] shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-base sm:text-lg text-foreground">Checkout do Dia</h3>
                    <p className="text-[11px] text-muted-foreground">
                      {checkoutItems.filter(i => i.selected).length} selecionado(s)
                    </p>
                  </div>
                </div>
                <button aria-label="Fechar"
                  onClick={() => setShowCheckoutModal(false)}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
              {checkoutItems.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-semibold">Nenhum agendamento pendente para checkout hoje.</p>
                </div>
              ) : (
                checkoutItems.map((item, idx) => (
                  <div
                    key={item.apptId}
                    className={`rounded-xl border p-3.5 sm:p-4 transition-all space-y-3 ${
                      item.status === 'success'
                        ? 'bg-emerald-500/5 border-emerald-500/30'
                        : item.status === 'error'
                        ? 'bg-destructive/5 border-destructive/30'
                        : item.selected
                        ? 'bg-secondary/30 border-border/60 hover:border-amber-500/30'
                        : 'bg-secondary/10 border-border/30 opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        disabled={checkoutProcessing || checkoutDone}
                        onChange={() => {
                          setCheckoutItems(prev => prev.map((ci, i) =>
                            i === idx ? { ...ci, selected: !ci.selected } : ci
                          ))
                        }}
                        className="w-4.5 h-4.5 rounded border-border accent-amber-500 cursor-pointer"
                      />
                      <span className="text-lg font-bold font-mono text-foreground w-14 shrink-0">{item.time}</span>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-bold text-sm text-foreground truncate flex items-center gap-1.5 flex-wrap">
                          {item.customerName}
                          {item.isPackage && (
                            <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                              Pacote
                            </span>
                          )}
                          {item.isExtra && (
                            <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-dashed border-amber-500/40 shrink-0 flex items-center gap-0.5">
                              <Zap className="w-2.5 h-2.5 text-amber-400" /> Extra
                            </span>
                          )}
                          <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-secondary/80 text-foreground border border-border/60 shrink-0 flex items-center gap-1">
                            <Scissors className="w-2.5 h-2.5 text-primary" />
                            {item.barberName?.split(' ')[0]}
                          </span>
                        </h5>
                        <p className="text-xs text-muted-foreground truncate">{item.serviceName}</p>
                      </div>
                      <span className="font-serif font-bold text-amber-400 text-sm shrink-0">
                        R$ {item.price.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pl-7.5">
                      <Wallet className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <select
                        value={item.selectedMethod}
                        disabled={checkoutProcessing || checkoutDone || !item.selected}
                        onChange={(e) => {
                          setCheckoutItems(prev => prev.map((ci, i) =>
                            i === idx ? { ...ci, selectedMethod: e.target.value } : ci
                          ))
                        }}
                        className="flex-1 px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs font-semibold text-foreground outline-none cursor-pointer focus:border-amber-500/50"
                      >
                        <option value="cash">💵 Dinheiro</option>
                        <option value="pix">📱 Pix</option>
                        <option value="card">💳 Cartão</option>
                        <option value="other">📝 Outro</option>
                      </select>

                      {item.status === 'success' && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Pago
                        </span>
                      )}
                      {item.status === 'error' && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-destructive shrink-0">
                          <AlertCircle className="w-3.5 h-3.5" /> Erro
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 sm:p-5 border-t border-border/60 bg-secondary/20 shrink-0 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {checkoutItems.filter(i => i.selected).length} de {checkoutItems.length} selecionado(s)
                </span>
                <span className="font-serif font-bold text-amber-400 text-sm">
                  Total: R$ {checkoutItems.filter(i => i.selected).reduce((sum, i) => sum + i.price, 0).toFixed(2)}
                </span>
              </div>

              {!checkoutDone ? (
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowCheckoutModal(false)}
                    disabled={checkoutProcessing}
                    className="flex-1 py-3 px-4 bg-secondary hover:bg-muted border border-border text-foreground font-semibold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={checkoutProcessing || checkoutItems.filter(i => i.selected).length === 0}
                    onClick={async () => {
                      setCheckoutProcessing(true)
                      const selectedItems = checkoutItems
                        .filter(i => i.selected)
                        .map(i => ({ appointmentId: i.apptId, paymentMethod: i.selectedMethod }))

                      try {
                        const res = await bulkCheckoutAction(selectedItems)
                        setCheckoutItems(prev => prev.map(ci => {
                          if (!ci.selected) return ci
                          const result = res.results.find(r => r.appointmentId === ci.apptId)
                          if (!result) return ci
                          return {
                            ...ci,
                            status: result.success ? 'success' as const : 'error' as const,
                            errorMsg: result.success ? undefined : result.message
                          }
                        }))
                        setCheckoutDone(true)
                        if (res.success) setSuccessMsg(res.message)
                        else setErrorMsg(res.message)
                        loadData()
                        router.refresh()
                      } catch (err) {
                        console.error('Bulk checkout error:', err)
                        setErrorMsg('Erro inesperado ao processar checkout.')
                      } finally {
                        setCheckoutProcessing(false)
                      }
                    }}
                    className="flex-[2] py-3 px-4 bg-gradient-to-r from-[#6b4f1d] via-[#947629] to-[#6b4f1d] hover:brightness-110 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    {checkoutProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-amber-300" />}
                    Confirmar Todos ({checkoutItems.filter(i => i.selected).length})
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCheckoutModal(false)}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                >
                  <CheckCircle2 className="w-4 h-4" /> Checkout Concluído — Fechar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
