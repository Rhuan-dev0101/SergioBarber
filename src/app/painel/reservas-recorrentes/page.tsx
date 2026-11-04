'use client'

import React, { useEffect, useState, useTransition, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Repeat, Plus, Loader2, Search, X, Check, AlertCircle,
  CheckCircle2, Calendar, Clock, User, Trash2,
  AlertTriangle, CalendarClock, Scissors
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { DashboardSidebar } from '@/components/DashboardSidebar'
import { CreateRecurringModal } from '@/components/reservas-recorrentes/CreateRecurringModal'
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

  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Filter reservations (memoized)
  const filtered = useMemo(() => {
    return reservations.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (debouncedSearchQuery) {
        const q = debouncedSearchQuery.toLowerCase()
        return (
          r.customer_display_name?.toLowerCase().includes(q) ||
          r.barber_name?.toLowerCase().includes(q) ||
          DAY_NAMES[r.day_of_week]?.toLowerCase().includes(q) ||
          r.time_slot?.includes(q)
        )
      }
      return true
    })
  }, [reservations, statusFilter, debouncedSearchQuery])

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
            <button aria-label="Fechar aviso" onClick={() => setSuccessMsg('')} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
        {errorMsg && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {errorMsg}
            <button aria-label="Fechar aviso" onClick={() => setErrorMsg('')} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              aria-label="Buscar por cliente, barbeiro, dia" placeholder="Buscar por cliente, barbeiro, dia..."
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">{r.customer_display_name}</p>
                      <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1 shrink-0">
                        <Scissors className="w-3 h-3 text-cyan-400" />
                        {r.barber_name?.split(' ')[0]}
                      </span>
                    </div>
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
        {/* ═══════════ CREATE RECURRING RESERVATION MODAL ═══════════ */}
        <CreateRecurringModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(msg) => {
            setSuccessMsg(msg)
            loadData()
          }}
          barbers={barbers}
          customers={customers}
          userRole={userRole}
        />

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
