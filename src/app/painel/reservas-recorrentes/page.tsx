'use client'

import React, { useEffect, useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Repeat, Plus, Loader2, Search, X, Check, AlertCircle,
  CheckCircle2, Calendar, Clock, User, Trash2,
  AlertTriangle, CalendarClock
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { DashboardSidebar } from '@/components/DashboardSidebar'
import {
  createRecurringReservationAction,
  cancelRecurringReservationAction,
  getRecurringReservationsAction
} from './actions'

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const DAY_NAMES_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function ReservasRecorrentesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isPending, startTransition] = useTransition()

  // Auth & role
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Data
  const [reservations, setReservations] = useState<any[]>([])
  const [barbers, setBarbers] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])

  // Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'cancelled' | 'all'>('active')

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false)
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

  // Cancel modal
  const [cancelTarget, setCancelTarget] = useState<any>(null)

  // Messages
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const loadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/entrar'); return }
      setCurrentUser(session.user)

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()
      if (!profile || profile.role !== 'admin') { router.push('/painel'); return }
      setUserRole(profile.role)

      // Load barbers
      const { data: dbBarbers } = await supabase
        .from('barbers')
        .select('id, is_active, profiles(id, full_name)')
        .eq('is_active', true)
      if (dbBarbers) {
        const formatted = dbBarbers
          .filter((b: any) => b.profiles)
          .map((b: any) => ({
            id: (b.profiles as any).id,
            name: (b.profiles as any).full_name
          }))
        setBarbers(formatted)
      }

      // Load customers
      const { data: dbCustomers } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'customer')
        .order('full_name')
      if (dbCustomers) setCustomers(dbCustomers)

      // Load reservations
      startTransition(async () => {
        const res = await getRecurringReservationsAction()
        if (res.success) setReservations(res.reservations)
      })
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase, router])

  useEffect(() => { loadData() }, [loadData])

  // Fetch available slots when barber + start date are selected
  useEffect(() => {
    if (!formBarberId || !formStartDate) {
      setAvailableSlots([])
      return
    }
    const fetchSlots = async () => {
      setLoadingSlots(true)
      try {
        const resp = await fetch(`/api/booking/slots?barberId=${formBarberId}&dateStr=${formStartDate}&duration=60`)
        const data = await resp.json()
        setAvailableSlots(data.slots || [])
      } catch {
        setAvailableSlots([])
      } finally {
        setLoadingSlots(false)
      }
    }
    fetchSlots()
  }, [formBarberId, formStartDate])

  // Auto-set day of week from start date
  useEffect(() => {
    if (formStartDate) {
      const [y, m, d] = formStartDate.split('-').map(Number)
      const dateObj = new Date(y, m - 1, d)
      setFormDayOfWeek(dateObj.getDay())
    }
  }, [formStartDate])

  const resetCreateForm = () => {
    setFormBarberId('')
    setFormDayOfWeek('')
    setFormTimeSlot('')
    setFormIntervalWeeks(1)
    setFormStartDate('')
    setFormCustomerMode('registered')
    setFormCustomerId('')
    setFormCustomerName('')
    setAvailableSlots([])
    setShowCreateModal(false)
  }

  const handleCreate = () => {
    setErrorMsg('')
    setSuccessMsg('')

    if (!formBarberId || formDayOfWeek === '' || !formTimeSlot || !formStartDate) {
      setErrorMsg('Preencha todos os campos obrigatórios.')
      return
    }

    if (formCustomerMode === 'registered' && !formCustomerId) {
      setErrorMsg('Selecione um cliente cadastrado.')
      return
    }

    if (formCustomerMode === 'unregistered' && !formCustomerName.trim()) {
      setErrorMsg('Informe o nome do cliente.')
      return
    }

    startTransition(async () => {
      const res = await createRecurringReservationAction(
        formBarberId,
        formDayOfWeek as number,
        formTimeSlot,
        formIntervalWeeks,
        formStartDate,
        formCustomerMode === 'registered' ? formCustomerId : null,
        formCustomerMode === 'unregistered' ? formCustomerName : null
      )

      if (res.success) {
        setSuccessMsg(res.message)
        resetCreateForm()
        // Reload reservations
        const refreshed = await getRecurringReservationsAction()
        if (refreshed.success) setReservations(refreshed.reservations)
      } else {
        setErrorMsg(res.message)
      }
    })
  }

  const handleCancelConfirm = () => {
    if (!cancelTarget) return
    setErrorMsg('')
    setSuccessMsg('')

    startTransition(async () => {
      const res = await cancelRecurringReservationAction(cancelTarget.id)
      if (res.success) {
        setSuccessMsg(res.message)
        setCancelTarget(null)
        const refreshed = await getRecurringReservationsAction()
        if (refreshed.success) setReservations(refreshed.reservations)
      } else {
        setErrorMsg(res.message)
      }
    })
  }

  // Filter reservations
  const filtered = reservations.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        r.customer_display_name?.toLowerCase().includes(q) ||
        r.barber_name?.toLowerCase().includes(q) ||
        DAY_NAMES[r.day_of_week]?.toLowerCase().includes(q) ||
        r.time_slot?.includes(q)
      )
    }
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background">
      <DashboardSidebar />

      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 rounded-lg">
              <Repeat className="w-6 h-6 text-cyan-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Reservas Fixas Recorrentes</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Horários fixos semanais/quinzenais — sem vínculo com pacotes
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-semibold transition-all shadow-md hover:shadow-lg cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nova Reserva
          </button>
        </div>

        {/* Messages */}
        {successMsg && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {successMsg}
            <button onClick={() => setSuccessMsg('')} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
        {errorMsg && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {errorMsg}
            <button onClick={() => setErrorMsg('')} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por cliente, barbeiro, dia..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
            />
          </div>
          <div className="flex gap-2">
            {(['active', 'cancelled', 'all'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  statusFilter === st
                    ? st === 'active'
                      ? 'bg-cyan-600 text-white'
                      : st === 'cancelled'
                        ? 'bg-red-600 text-white'
                        : 'bg-secondary text-foreground'
                    : 'bg-card border border-border text-muted-foreground hover:bg-secondary'
                }`}
              >
                {st === 'active' ? 'Ativas' : st === 'cancelled' ? 'Canceladas' : 'Todas'}
              </button>
            ))}
          </div>
        </div>

        {/* Reservations List */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <CalendarClock className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg font-medium">Nenhuma reserva encontrada</p>
            <p className="text-sm mt-1">
              {statusFilter === 'active' ? 'Nenhuma reserva recorrente ativa.' : 'Sem resultados para este filtro.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((r) => (
              <div
                key={r.id}
                className={`relative p-5 rounded-xl border transition-all ${
                  r.status === 'active'
                    ? 'bg-card border-cyan-500/20 hover:border-cyan-500/40 shadow-sm hover:shadow-md'
                    : 'bg-card/50 border-border/40 opacity-60'
                }`}
              >
                {/* Status badge */}
                <div className={`absolute top-4 right-4 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  r.status === 'active'
                    ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                    : 'bg-red-500/15 text-red-400 border border-red-500/30'
                }`}>
                  {r.status === 'active' ? 'Ativa' : 'Cancelada'}
                </div>

                {/* Customer */}
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="p-2 bg-cyan-500/10 rounded-lg">
                    <User className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{r.customer_display_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {r.customer_id ? 'Cliente cadastrado' : 'Sem cadastro'}
                    </p>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2 ml-[42px]">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Barbeiro:</span>
                    <span className="font-medium text-foreground">{r.barber_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="font-medium text-foreground">
                      {DAY_NAMES[r.day_of_week]}
                    </span>
                    <span className="text-muted-foreground">às</span>
                    <span className="font-bold text-cyan-400">{r.time_slot}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Repeat className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="font-medium text-foreground">
                      {r.interval_weeks === 1 ? 'Semanal' : 'Quinzenal'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Início: {new Date(r.start_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                {r.status === 'active' && (
                  <div className="mt-4 pt-3 border-t border-border/40">
                    <button
                      onClick={() => setCancelTarget(r)}
                      disabled={isPending}
                      className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Cancelar Reserva
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ═══════════ CREATE MODAL ═══════════ */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-cyan-500/10 rounded-lg">
                    <CalendarClock className="w-5 h-5 text-cyan-500" />
                  </div>
                  <h2 className="text-lg font-bold text-foreground">Nova Reserva Recorrente</h2>
                </div>
                <button onClick={resetCreateForm} className="p-1.5 hover:bg-secondary rounded-lg text-muted-foreground cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Customer Mode */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-2">Cliente</label>
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setFormCustomerMode('registered')}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        formCustomerMode === 'registered'
                          ? 'bg-cyan-600 text-white'
                          : 'bg-secondary text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Cadastrado
                    </button>
                    <button
                      onClick={() => setFormCustomerMode('unregistered')}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        formCustomerMode === 'unregistered'
                          ? 'bg-cyan-600 text-white'
                          : 'bg-secondary text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Sem Cadastro
                    </button>
                  </div>

                  {formCustomerMode === 'registered' ? (
                    <select
                      value={formCustomerId}
                      onChange={(e) => setFormCustomerId(e.target.value)}
                      className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    >
                      <option value="">Selecionar cliente...</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.full_name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Nome do cliente"
                      value={formCustomerName}
                      onChange={(e) => setFormCustomerName(e.target.value)}
                      className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    />
                  )}
                </div>

                {/* Barber */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-2">Barbeiro</label>
                  <select
                    value={formBarberId}
                    onChange={(e) => setFormBarberId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  >
                    <option value="">Selecionar barbeiro...</option>
                    {barbers.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                {/* Interval */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-2">Frequência</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFormIntervalWeeks(1)}
                      className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                        formIntervalWeeks === 1
                          ? 'bg-cyan-600 text-white shadow-md'
                          : 'bg-secondary text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      🗓️ Semanal
                    </button>
                    <button
                      onClick={() => setFormIntervalWeeks(2)}
                      className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                        formIntervalWeeks === 2
                          ? 'bg-cyan-600 text-white shadow-md'
                          : 'bg-secondary text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      📅 Quinzenal
                    </button>
                  </div>
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-2">Data de Início</label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  />
                  {formStartDate && formDayOfWeek !== '' && (
                    <p className="text-xs text-cyan-400 mt-1.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Dia da semana: <strong>{DAY_NAMES[formDayOfWeek]}</strong>
                    </p>
                  )}
                </div>

                {/* Time Slot */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-2">Horário</label>
                  {loadingSlots ? (
                    <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Carregando horários...
                    </div>
                  ) : !formBarberId || !formStartDate ? (
                    <p className="text-xs text-muted-foreground py-2">
                      Selecione o barbeiro e a data de início para ver os horários.
                    </p>
                  ) : availableSlots.length === 0 ? (
                    <p className="text-xs text-red-400 py-2">
                      Nenhum horário disponível nesta data para este barbeiro.
                    </p>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot}
                          onClick={() => setFormTimeSlot(slot)}
                          className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                            formTimeSlot === slot
                              ? 'bg-cyan-600 text-white shadow-md ring-2 ring-cyan-400/50'
                              : 'bg-secondary text-foreground hover:bg-cyan-500/10 hover:text-cyan-400'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Error in modal */}
                {errorMsg && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {errorMsg}
                  </div>
                )}

                {/* Submit */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={resetCreateForm}
                    className="flex-1 px-4 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg text-sm font-semibold transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={isPending}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-semibold transition-all shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Criar Reserva
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ CANCEL CONFIRMATION MODAL ═══════════ */}
        {cancelTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex flex-col items-center text-center">
                <div className="p-3 bg-red-500/10 rounded-full mb-4">
                  <AlertTriangle className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">Cancelar Reserva?</h3>
                <p className="text-sm text-muted-foreground mb-1">
                  Tem certeza que deseja cancelar a reserva de{' '}
                  <span className="text-foreground font-semibold">{cancelTarget.customer_display_name}</span>?
                </p>
                <p className="text-xs text-muted-foreground mb-6">
                  {DAY_NAMES[cancelTarget.day_of_week]} às {cancelTarget.time_slot} ({cancelTarget.interval_weeks === 1 ? 'semanal' : 'quinzenal'})
                  <br />
                  O horário será liberado imediatamente para novos agendamentos.
                </p>

                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setCancelTarget(null)}
                    className="flex-1 px-4 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg text-sm font-semibold transition-all cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleCancelConfirm}
                    disabled={isPending}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-all shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Confirmar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
