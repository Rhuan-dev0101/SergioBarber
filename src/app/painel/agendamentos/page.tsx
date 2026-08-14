'use client'

import React, { useEffect, useState, useTransition, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Scissors, Calendar, Clock, Search, Edit2, Trash2, CheckCircle2, 
  AlertCircle, Plus, Loader2, Save, X, User, Sparkles, Check, AlertTriangle, UserX,
  Filter, RotateCcw, CheckCircle, ChevronRight, Wallet, DollarSign, RefreshCw, FileText,
  Repeat, ChevronLeft, CalendarDays, LayoutList, Coffee, Crown, Users, Zap
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { DashboardSidebar } from '@/components/DashboardSidebar'
import { ReceiptModal } from '@/components/ReceiptModal'
import { WalkInModal } from '@/components/agendamentos/WalkInModal'
import { ExtraAppointmentModal } from '@/components/agendamentos/ExtraAppointmentModal'
import { CheckoutModal } from '@/components/agendamentos/CheckoutModal'
import { AgendaTimeline } from '@/components/agendamentos/AgendaTimeline'
import { 
  updateAppointmentStatusAction, 
  updateAppointmentNotesAction, 
  deleteAppointmentAction,
  markNoShowAction
} from './actions'
import { apptShortCode, getLocalDateStr } from '@/lib/utils'
import { isRecurringReservationActiveOnDate } from '@/lib/booking'

function getAppointmentPrice(appt: any): number {
  if (!appt) return 0
  const payment = Array.isArray(appt.payments) ? appt.payments[0] : appt.payments
  if (payment && payment.total_amount !== undefined && payment.total_amount !== null && Number(payment.total_amount) > 0) {
    return Number(payment.total_amount)
  }
  const pkgSub = Array.isArray(appt.package_subscriptions) ? appt.package_subscriptions[0] : appt.package_subscriptions
  if (pkgSub && pkgSub.package_price && pkgSub.total_sessions) {
    const perSession = Number(pkgSub.package_price) / Number(pkgSub.total_sessions)
    if (perSession > 0) return Math.round(perSession * 100) / 100
  }
  return Number(appt.services?.price || 0)
}

export default function PainelAgendamentos() {
  const router = useRouter()
  const [appointments, setAppointments] = useState<any[]>([])
  const [recurringReservations, setRecurringReservations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string | null>(null)

  // Agenda Timeline vs List Mode State
  const todayLocalStr = new Date().toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).split('/').reverse().join('-')

  const [viewMode, setViewMode] = useState<'agenda' | 'list'>('agenda')
  const [selectedAgendaDate, setSelectedAgendaDate] = useState<string>(todayLocalStr)
  const [selectedBarberFilter, setSelectedBarberFilter] = useState<string>('all')
  const [workingHours, setWorkingHours] = useState<any[]>([])
  const [daysOff, setDaysOff] = useState<any[]>([])
  const [selectedAgendaAppt, setSelectedAgendaAppt] = useState<any | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Modals open state
  const [showWalkInModal, setShowWalkInModal] = useState(false)
  const [walkInModalBarberId, setWalkInModalBarberId] = useState('')
  const [walkInModalTime, setWalkInModalTime] = useState('')

  const [showExtraModal, setShowExtraModal] = useState(false)
  const [extraModalBarberId, setExtraModalBarberId] = useState('')

  const [showCheckoutModal, setShowCheckoutModal] = useState(false)

  // Data for selectors
  const [customers, setCustomers] = useState<any[]>([])
  const [barbers, setBarbers] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])

  // Edit notes state
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null)
  const [notesContent, setNotesContent] = useState('')

  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Delete confirmation modal state (admin only)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)

  // No-show confirmation modal state
  const [noShowTarget, setNoShowTarget] = useState<any>(null)

  // Receipt modal state
  const [selectedReceiptApptId, setSelectedReceiptApptId] = useState<string | null>(null)

  const supabase = createClient()

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/entrar')
        return
      }
      setCurrentUser(session.user)

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()
      
      if (!profile || (profile.role !== 'admin' && profile.role !== 'barber')) {
        router.push('/cliente')
        return
      }
      setUserRole(profile.role)

      // Fetch active barbers and services
      const { data: dbBarbers } = await supabase
        .from('barbers')
        .select('id, is_active, photo_url, profiles(id, full_name)')
        .eq('is_active', true)

      if (dbBarbers) {
        const formattedBarbers = dbBarbers
          .filter((b: any) => b.profiles)
          .map((b: any) => ({
            id: b.id,
            full_name: b.profiles.full_name,
            name: b.profiles.full_name,
            is_active: b.is_active,
            photo_url: b.photo_url || (b.profiles.full_name?.toLowerCase()?.includes('sergio') ? '/barbers/sergio.jpg' : null)
          }))
        setBarbers(formattedBarbers)
      }

      const { data: dbServices } = await supabase
        .from('services')
        .select('id, name, duration, price, is_active')
        .eq('is_active', true)
        .order('name')

      if (dbServices) setServices(dbServices)

      // Fetch customers for selector
      const { data: dbCustomers } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .eq('role', 'customer')
        .order('full_name')

      if (dbCustomers) setCustomers(dbCustomers)

      // Fetch working hours & days off
      const { data: dbWH } = await supabase
        .from('barber_working_hours')
        .select('*')
      if (dbWH) setWorkingHours(dbWH)

      const { data: dbDO } = await supabase
        .from('barber_days_off')
        .select('*')
      if (dbDO) setDaysOff(dbDO)

      // Fetch active recurring reservations
      const { data: dbRec } = await supabase
        .from('recurring_reservations')
        .select('*')
        .eq('status', 'active')
      if (dbRec) setRecurringReservations(dbRec)

      // Fetch appointments
      let query = supabase
        .from('appointments')
        .select(`
          *,
          services (id, name, price, duration),
          payments (id, method, status, total_amount),
          package_subscriptions (id, package_price, total_sessions)
        `)
        .order('start_time', { ascending: false })

      if (profile.role === 'barber') {
        query = query.eq('barber_id', session.user.id)
      }

      const { data: appts, error: apptsErr } = await query

      if (apptsErr) {
        console.error('Error fetching appointments:', apptsErr)
        setErrorMsg('Erro ao carregar agendamentos.')
      } else if (appts) {
        // Fetch customer & barber names from profiles
        const allUserIds = Array.from(new Set([
          ...appts.map(a => a.customer_id).filter(Boolean),
          ...appts.map(a => a.barber_id).filter(Boolean)
        ]))

        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', allUserIds.length > 0 ? allUserIds : ['00000000-0000-0000-0000-000000000000'])

        const nameMap: Record<string, string> = (profilesData || []).reduce((acc: any, p: any) => {
          acc[p.id] = p.full_name
          return acc
        }, {})

        const enriched = appts.map(a => {
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

        setAppointments(enriched)
      } else {
        setAppointments([])
      }
    } catch (err) {
      console.error('Error loading appointments:', err)
      setErrorMsg('Erro inesperado ao carregar agendamentos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filter pipeline via useMemo
  const filteredAppointments = useMemo(() => {
    let result = [...appointments]

    if (filterDate) {
      result = result.filter(a => getLocalDateStr(a.start_time) === filterDate)
    }

    const todayStr = new Date().toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).split('/').reverse().join('-')

    if (statusFilter === 'today') {
      result = result.filter(a => getLocalDateStr(a.start_time) === todayStr && a.status !== 'cancelled')
    } else if (statusFilter === 'confirmed') {
      result = result.filter(a => a.status === 'confirmed' || a.status === 'pending')
    } else if (statusFilter === 'completed') {
      result = result.filter(a => a.status === 'completed')
    } else if (statusFilter === 'cancelled') {
      result = result.filter(a => a.status === 'cancelled' || a.status === 'no_show')
    }

    const targetDateStr = filterDate || (statusFilter === 'today' ? todayStr : null)

    if (targetDateStr && recurringReservations.length > 0) {
      const [y, m, d] = targetDateStr.split('-').map(Number)
      const targetDayOfWeek = new Date(y, m - 1, d).getDay()

      const activeOnDate = recurringReservations.filter(r =>
        r.day_of_week === targetDayOfWeek &&
        isRecurringReservationActiveOnDate(r.start_date, r.interval_weeks, targetDateStr)
      )

      const recAppointments = activeOnDate.map(r => ({
        id: `rec-${r.id}-${targetDateStr}`,
        start_time: `${targetDateStr}T${r.time_slot}:00-03:00`,
        end_time: `${targetDateStr}T${r.time_slot}:00-03:00`,
        status: 'recurring_reservation',
        isRecurringReservation: true,
        intervalWeeks: r.interval_weeks,
        customerName: r.customer_display_name,
        barberName: r.barber_name,
        services: { name: `Reserva Fixa (${r.interval_weeks === 1 ? 'Semanal' : 'Quinzenal'})` },
        payments: [],
        notes: `Horário fixo reservado permanentemente (${r.interval_weeks === 1 ? 'Semanal' : 'Quinzenal'})`
      }))

      result = [...result, ...recAppointments]
    }

    if (debouncedSearchQuery) {
      const q = debouncedSearchQuery.toLowerCase()
      result = result.filter(a => 
        a.customerName.toLowerCase().includes(q) || 
        (a.notes && a.notes.toLowerCase().includes(q)) ||
        (a.services?.name && a.services.name.toLowerCase().includes(q)) ||
        (a.barberName && a.barberName.toLowerCase().includes(q))
      )
    }

    return result
  }, [appointments, recurringReservations, filterDate, statusFilter, debouncedSearchQuery])

  const unpaidApptsForCheckout = useMemo(() => {
    return appointments.filter(a => {
      if (getLocalDateStr(a.start_time) !== selectedAgendaDate) return false
      if (a.status === 'completed' || a.status === 'cancelled' || a.status === 'no_show') return false
      const payStatus = Array.isArray(a.payments) ? a.payments[0]?.status : a.payments?.status
      if (payStatus === 'paid') return false
      return true
    })
  }, [appointments, selectedAgendaDate])

  const counts = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).split('/').reverse().join('-')

    return {
      all: appointments.length,
      today: appointments.filter(a => getLocalDateStr(a.start_time) === todayStr && a.status !== 'cancelled').length,
      confirmed: appointments.filter(a => a.status === 'confirmed' || a.status === 'pending').length,
      completed: appointments.filter(a => a.status === 'completed').length,
      cancelled: appointments.filter(a => a.status === 'cancelled' || a.status === 'no_show').length
    }
  }, [appointments])

  const handleStatusUpdate = (apptId: string, status: string) => {
    setErrorMsg('')
    setSuccessMsg('')
    startTransition(async () => {
      const res = await updateAppointmentStatusAction(apptId, status)
      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg(res.message)
        loadData()
      }
    })
  }

  const handleSaveNotes = (apptId: string) => {
    setErrorMsg('')
    setSuccessMsg('')
    startTransition(async () => {
      const res = await updateAppointmentNotesAction(apptId, notesContent)
      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg(res.message)
        setEditingNotesId(null)
        loadData()
      }
    })
  }

  const handleOpenWalkInModal = useCallback((defaultBarberId?: string, defaultTime?: string) => {
    let targetBarberId = defaultBarberId || ''
    if (!targetBarberId) {
      if (userRole === 'barber' && currentUser?.id) {
        targetBarberId = currentUser.id
      } else if (selectedBarberFilter && selectedBarberFilter !== 'all') {
        targetBarberId = selectedBarberFilter
      }
    }
    setWalkInModalBarberId(targetBarberId)
    setWalkInModalTime(defaultTime || '')
    setShowWalkInModal(true)
  }, [userRole, currentUser, selectedBarberFilter])

  const handleOpenExtraModal = useCallback(() => {
    let targetBarberId = ''
    if (userRole === 'barber' && currentUser?.id) {
      targetBarberId = currentUser.id
    } else if (selectedBarberFilter && selectedBarberFilter !== 'all') {
      targetBarberId = selectedBarberFilter
    }
    setExtraModalBarberId(targetBarberId)
    setShowExtraModal(true)
  }, [userRole, currentUser, selectedBarberFilter])

  const handleDelete = (appt: any) => {
    setDeleteTarget(appt)
  }

  const handleConfirmDelete = () => {
    if (!deleteTarget) return
    setErrorMsg('')
    setSuccessMsg('')
    startTransition(async () => {
      const res = await deleteAppointmentAction(deleteTarget.id)
      setDeleteTarget(null)
      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg(res.message)
        loadData()
      }
    })
  }

  const handleConfirmNoShow = () => {
    if (!noShowTarget) return
    setErrorMsg('')
    setSuccessMsg('')
    startTransition(async () => {
      const res = await markNoShowAction(noShowTarget.id)
      setNoShowTarget(null)
      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg(res.message)
        loadData()
      }
    })
  }

  const formatDate = useCallback((dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' })
  }, [])

  const formatTime = useCallback((dateStr: string) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }, [])

  const handlePrevDay = () => {
    const [y, m, d] = selectedAgendaDate.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    dt.setDate(dt.getDate() - 1)
    const py = dt.getFullYear()
    const pm = String(dt.getMonth() + 1).padStart(2, '0')
    const pd = String(dt.getDate()).padStart(2, '0')
    setSelectedAgendaDate(`${py}-${pm}-${pd}`)
  }

  const handleNextDay = () => {
    const [y, m, d] = selectedAgendaDate.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    dt.setDate(dt.getDate() + 1)
    const ny = dt.getFullYear()
    const nm = String(dt.getMonth() + 1).padStart(2, '0')
    const nd = String(dt.getDate()).padStart(2, '0')
    setSelectedAgendaDate(`${ny}-${nm}-${nd}`)
  }

  const handleToday = () => {
    setSelectedAgendaDate(todayLocalStr)
  }

  const formatAgendaHeaderDate = useCallback((dateStr: string) => {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-').map(Number)
    const dateObj = new Date(y, m - 1, d)
    const formatted = dateObj.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
    return formatted.charAt(0).toUpperCase() + formatted.slice(1)
  }, [])

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    await loadData()
    setTimeout(() => setIsRefreshing(false), 400)
  }

  if (loading) {
    return (
      <div className="flex flex-col md:flex-row min-h-screen bg-background text-foreground">
        <DashboardSidebar />
        <main className="flex-1 p-8 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground mt-3 font-medium">Carregando agendamentos...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background text-foreground">
      <DashboardSidebar />

      <main className="flex-1 p-4 sm:p-8 space-y-6 max-w-7xl mx-auto w-full">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/60 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-foreground">Agendamentos</h1>
              {counts.confirmed > 0 && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary/20 text-primary border border-primary/30 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {counts.confirmed} Ativo{counts.confirmed > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Gerencie seus atendimentos, confirme agendamentos e registre horários presenciais.
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap sm:flex-nowrap">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-secondary/80 p-1 rounded-xl border border-border/60">
              <button
                type="button"
                onClick={() => setViewMode('agenda')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'agenda'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Agenda</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>Lista</span>
              </button>
            </div>

            <button
              onClick={handleManualRefresh}
              disabled={isPending || isRefreshing}
              className="p-2.5 bg-secondary hover:bg-muted border border-border/80 text-foreground text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
              title="Atualizar lista de agendamentos"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing || isPending ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => handleOpenWalkInModal()}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4 text-primary-foreground" />
              <span>Encaixe Presencial</span>
            </button>
            <button
              onClick={handleOpenExtraModal}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold text-xs rounded-xl border-2 border-dashed border-amber-500/50 hover:border-amber-500/80 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-sm"
              title="Registrar atendimento fora do horário (sem validação de disponibilidade)"
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Atendimento Extra</span>
            </button>
          </div>
        </div>

        {/* Global Feedback Notifications */}
        {errorMsg && (
          <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-2xl flex items-center justify-between gap-3 text-destructive animate-in fade-in">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg('')} className="p-1 hover:bg-destructive/10 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-3 text-emerald-400 animate-in fade-in">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg('')} className="p-1 hover:bg-emerald-500/10 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Content Area: Agenda Mode vs List Mode */}
        {viewMode === 'agenda' ? (
          <div className="space-y-6">
            {/* Agenda Navigation Toolbar */}
            <div className="bg-[#121214] border border-white/10 p-4 rounded-3xl space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Date quick navigation */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToday}
                    className={`px-3.5 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer border ${
                      selectedAgendaDate === todayLocalStr
                        ? 'bg-primary text-primary-foreground border-primary shadow-md'
                        : 'bg-secondary/60 hover:bg-secondary border-border/80 text-foreground'
                    }`}
                  >
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    HOJE
                  </button>
                </div>

                {/* Date Controls & Date Picker */}
                <div className="flex items-center gap-2 justify-between sm:justify-end">
                  <button
                    type="button"
                    onClick={handlePrevDay}
                    className="p-2.5 bg-secondary/60 hover:bg-secondary border border-border/80 text-foreground rounded-xl transition-all cursor-pointer"
                    title="Dia Anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-2 px-3.5 py-2 bg-secondary/50 border border-border focus-within:border-primary rounded-xl transition-all">
                    <input
                      type="date"
                      value={selectedAgendaDate}
                      onChange={(e) => setSelectedAgendaDate(e.target.value)}
                      className="bg-transparent text-xs font-bold text-foreground outline-none cursor-pointer"
                    />
                    <span className="text-xs font-bold text-muted-foreground border-l border-border/60 pl-2 capitalize hidden sm:inline">
                      {formatAgendaHeaderDate(selectedAgendaDate)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleNextDay}
                    className="p-2.5 bg-secondary/60 hover:bg-secondary border border-border/80 text-foreground rounded-xl transition-all cursor-pointer"
                    title="Próximo Dia"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Lower row: Barber Avatar Selector (Admin Only) */}
              {userRole === 'admin' && barbers.length > 0 && (
                <div className="pt-3 border-t border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-amber-400" />
                      Filtrar por Barbeiro:
                    </span>
                  </div>

                  <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none">
                    {/* All Barbers Bubble */}
                    {(() => {
                      const isSelected = selectedBarberFilter === 'all'
                      const totalTodayAppts = appointments.filter(a => getLocalDateStr(a.start_time) === selectedAgendaDate && a.status !== 'cancelled').length

                      return (
                        <button
                          type="button"
                          onClick={() => setSelectedBarberFilter('all')}
                          className={`flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer transition-all ${
                            isSelected ? 'scale-105' : 'opacity-70 hover:opacity-100'
                          }`}
                        >
                          <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 p-0.5 overflow-hidden transition-all flex items-center justify-center shadow-md ${
                            isSelected
                              ? 'border-primary ring-4 ring-primary/20 bg-primary/20 text-primary'
                              : 'border-border/80 bg-secondary/60 text-muted-foreground group-hover:border-primary/50'
                          }`}>
                            <Users className="w-6 h-6 sm:w-7 sm:h-7" />
                          </div>
                          <div className="text-center">
                            <span className={`text-xs font-bold block leading-none ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                              Todos
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium">
                              ({totalTodayAppts})
                            </span>
                          </div>
                        </button>
                      )
                    })()}

                    {/* Barber Avatar Bubbles */}
                    {barbers.map((b) => {
                      const isSelected = selectedBarberFilter === b.id
                      const barberTodayAppts = appointments.filter(a => a.barber_id === b.id && getLocalDateStr(a.start_time) === selectedAgendaDate && a.status !== 'cancelled').length
                      const firstName = b.full_name.split(' ')[0]

                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSelectedBarberFilter(b.id)}
                          className={`flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer transition-all ${
                            isSelected ? 'scale-105' : 'opacity-70 hover:opacity-100'
                          }`}
                        >
                          <div className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 p-0.5 overflow-hidden transition-all shadow-md ${
                            isSelected
                              ? 'border-primary ring-4 ring-primary/20'
                              : 'border-border/80 group-hover:border-primary/50'
                          }`}>
                            {b.photo_url ? (
                              <img
                                src={b.photo_url}
                                alt={b.full_name}
                                className="w-full h-full object-cover rounded-full"
                              />
                            ) : (
                              <div className="w-full h-full rounded-full bg-gradient-to-tr from-primary/30 via-secondary to-muted flex items-center justify-center text-primary font-serif font-bold text-lg sm:text-xl shadow-inner">
                                {firstName.charAt(0)}
                              </div>
                            )}
                            {isSelected && (
                              <span className="absolute bottom-0 right-0 w-4 h-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center border border-background text-[10px] font-bold">
                                ✓
                              </span>
                            )}
                          </div>
                          <div className="text-center">
                            <span className={`text-xs font-bold block leading-none ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                              {firstName}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium">
                              ({barberTodayAppts})
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Non-admin (barber role) pill */}
              {userRole !== 'admin' && (
                <div className="pt-1 flex items-center justify-between border-t border-white/10">
                  <span className="text-xs font-bold text-primary flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Agenda de: {barbers.find(b => b.id === currentUser?.id)?.full_name || 'Meu Dia'}
                  </span>
                  <span className="text-xs text-muted-foreground font-semibold">
                    {appointments.filter(a => a.barber_id === currentUser?.id && getLocalDateStr(a.start_time) === selectedAgendaDate && a.status !== 'cancelled').length} atendimento(s)
                  </span>
                </div>
              )}
            </div>

            {/* Isolated React.memo Agenda Timeline Component */}
            <AgendaTimeline
              appointments={appointments}
              recurringReservations={recurringReservations}
              barbers={barbers}
              workingHours={workingHours}
              daysOff={daysOff}
              selectedAgendaDate={selectedAgendaDate}
              selectedBarberFilter={selectedBarberFilter}
              userRole={userRole}
              currentUser={currentUser}
              formatTime={formatTime}
              getAppointmentPrice={getAppointmentPrice}
              onSelectAgendaAppt={(appt) => setSelectedAgendaAppt(appt)}
              onOpenWalkInModal={handleOpenWalkInModal}
              onOpenCheckoutModal={() => setShowCheckoutModal(true)}
            />
          </div>
        ) : (
          <div className="space-y-6">
            {/* ==================== FALLBACK LIST VIEW ==================== */}
            {/* Interactive Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                onClick={() => { setStatusFilter('today'); setFilterDate(''); }}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  statusFilter === 'today'
                    ? 'bg-primary/15 border-primary shadow-md'
                    : 'bg-card/70 border-border/70 hover:border-primary/40'
                }`}
              >
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Hoje</span>
                <span className="text-2xl font-serif font-bold text-foreground mt-0.5 block">{counts.today}</span>
              </button>

              <button
                onClick={() => { setStatusFilter('confirmed'); setFilterDate(''); }}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  statusFilter === 'confirmed'
                    ? 'bg-amber-500/15 border-amber-500 shadow-md'
                    : 'bg-card/70 border-border/70 hover:border-amber-500/40'
                }`}
              >
                <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">Ativos / Pendentes</span>
                <span className="text-2xl font-serif font-bold text-amber-400 mt-0.5 block">{counts.confirmed}</span>
              </button>

              <button
                onClick={() => { setStatusFilter('completed'); setFilterDate(''); }}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  statusFilter === 'completed'
                    ? 'bg-emerald-500/15 border-emerald-500 shadow-md'
                    : 'bg-card/70 border-border/70 hover:border-emerald-500/40'
                }`}
              >
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">Concluídos</span>
                <span className="text-2xl font-serif font-bold text-emerald-400 mt-0.5 block">{counts.completed}</span>
              </button>

              <button
                onClick={() => { setStatusFilter('cancelled'); setFilterDate(''); }}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  statusFilter === 'cancelled'
                    ? 'bg-destructive/15 border-destructive shadow-md'
                    : 'bg-card/70 border-border/70 hover:border-destructive/40'
                }`}
              >
                <span className="text-[11px] font-semibold text-destructive uppercase tracking-wider block">Cancelados / Faltas</span>
                <span className="text-2xl font-serif font-bold text-destructive mt-0.5 block">{counts.cancelled}</span>
              </button>
            </div>

            {/* Toolbar: Search, Date Filter & Clear */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-secondary/30 p-3.5 rounded-2xl border border-border/60">
              
              {/* Status Tabs */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    statusFilter === 'all' && !filterDate
                      ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                  }`}
                >
                  Todos ({counts.all})
                </button>
                <button
                  onClick={() => setStatusFilter('today')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    statusFilter === 'today'
                      ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                  }`}
                >
                  Hoje ({counts.today})
                </button>
                <button
                  onClick={() => setStatusFilter('confirmed')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    statusFilter === 'confirmed'
                      ? 'bg-amber-500 text-black font-bold shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                  }`}
                >
                  Ativos ({counts.confirmed})
                </button>
                <button
                  onClick={() => setStatusFilter('completed')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    statusFilter === 'completed'
                      ? 'bg-emerald-600 text-white font-bold shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                  }`}
                >
                  Concluídos ({counts.completed})
                </button>
              </div>

              {/* Search & Date Filter */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5">
                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar cliente, serviço..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-background border border-border text-base text-foreground placeholder:text-muted-foreground/60 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="relative w-full sm:w-auto">
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-full sm:w-auto px-3 py-2 bg-background border border-border text-base text-foreground rounded-xl focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-medium"
                  />
                </div>

                {(filterDate || searchQuery || statusFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterDate('')
                      setSearchQuery('')
                      setStatusFilter('all')
                    }}
                    className="px-3 py-2 bg-secondary hover:bg-muted border border-border text-foreground text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Limpar</span>
                  </button>
                )}
              </div>

            </div>

            {/* List Cards Grid */}
            {filteredAppointments.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAppointments
                  .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                  .map((appt) => {
                    const payMethod = Array.isArray(appt.payments) ? appt.payments[0]?.method : appt.payments?.method

                    return (
                      <div
                        key={appt.id}
                        className="bg-card/90 border border-border/80 rounded-2xl p-5 hover:border-primary/40 transition-all duration-200 flex flex-col justify-between space-y-4 shadow-md group relative overflow-hidden"
                      >
                        {/* Status accent bar on left */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                          appt.isRecurringReservation
                            ? 'bg-cyan-500'
                            : appt.status === 'completed'
                            ? 'bg-emerald-500'
                            : appt.status === 'cancelled'
                            ? 'bg-destructive'
                            : appt.status === 'no_show'
                            ? 'bg-amber-500'
                            : appt.status === 'confirmed'
                            ? 'bg-primary'
                            : 'bg-amber-400'
                        }`} />

                        <div className="pl-1.5 space-y-3.5">
                          {/* Top Bar: Time Badge, Short Code & Status Badge */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xl font-serif font-bold text-foreground flex items-center gap-1.5">
                                  <Clock className="w-4 h-4 text-primary shrink-0" />
                                  {formatTime(appt.start_time)}
                                </span>
                                {!appt.isRecurringReservation && (
                                  <span className="font-mono text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded border border-border/60">
                                    {apptShortCode(appt.id)}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] font-medium text-muted-foreground block">
                                {formatDate(appt.start_time)}
                              </span>
                            </div>

                            {/* Status Pill */}
                            <div>
                              {appt.isRecurringReservation ? (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                                  <Repeat className="w-3 h-3" /> Fixa
                                </span>
                              ) : appt.status === 'confirmed' || appt.status === 'pending' ? (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> Ativo
                                </span>
                              ) : appt.status === 'completed' ? (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Concluído
                                </span>
                              ) : appt.status === 'no_show' ? (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                                  <UserX className="w-3 h-3" /> Não Compareceu
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-destructive/15 text-destructive border border-destructive/30 flex items-center gap-1">
                                  <X className="w-3 h-3" /> Cancelado
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Customer & Barber Details */}
                          <div className="space-y-1 bg-secondary/30 p-3 rounded-xl border border-border/40">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                                <User className="w-4 h-4 text-primary shrink-0" />
                                {appt.customerName}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/30">
                              <span className="flex items-center gap-1">
                                <Scissors className="w-3 h-3 text-muted-foreground" />
                                {appt.services?.name || 'Serviço'}
                              </span>
                              <span className="font-semibold text-foreground">
                                R$ {getAppointmentPrice(appt).toFixed(2)}
                              </span>
                            </div>

                            <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-0.5">
                              <span>Barbeiro: <strong className="text-foreground">{appt.barberName}</strong></span>
                              {payMethod && (
                                <span className="uppercase text-[9px] font-bold px-1.5 py-0.5 bg-background rounded border border-border">
                                  {payMethod}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Notes view/edit */}
                          <div className="space-y-1">
                            {editingNotesId === appt.id ? (
                              <div className="space-y-2">
                                <textarea
                                  value={notesContent}
                                  onChange={(e) => setNotesContent(e.target.value)}
                                  placeholder="Adicionar observações..."
                                  rows={2}
                                  className="w-full p-2.5 bg-background border border-primary rounded-xl text-xs outline-none resize-none text-foreground"
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => setEditingNotesId(null)}
                                    className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    onClick={() => handleSaveNotes(appt.id)}
                                    disabled={isPending}
                                    className="px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-lg flex items-center gap-1"
                                  >
                                    {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                    Salvar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div
                                onClick={() => {
                                  if (!appt.isRecurringReservation) {
                                    setEditingNotesId(appt.id)
                                    setNotesContent(appt.notes || '')
                                  }
                                }}
                                className="group/note p-2 bg-secondary/20 hover:bg-secondary/40 rounded-xl border border-border/30 text-xs text-muted-foreground transition-all cursor-pointer flex items-start justify-between gap-2 min-h-[36px]"
                              >
                                <p className="italic text-[11px] line-clamp-2">
                                  {appt.notes || 'Sem observações (clique para adicionar)...'}
                                </p>
                                {!appt.isRecurringReservation && (
                                  <Edit2 className="w-3 h-3 text-muted-foreground opacity-0 group-hover/note:opacity-100 transition-opacity shrink-0 mt-0.5" />
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action buttons footer */}
                        {!appt.isRecurringReservation && (
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                            {appt.status !== 'completed' && appt.status !== 'cancelled' && appt.status !== 'no_show' && (
                              <>
                                <button
                                  onClick={() => handleStatusUpdate(appt.id, 'completed')}
                                  disabled={isPending}
                                  className="flex-1 py-2 px-3 bg-emerald-600/15 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Concluir
                                </button>
                                <button
                                  onClick={() => setNoShowTarget(appt)}
                                  disabled={isPending}
                                  className="py-2 px-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                                  title="Marcar como Não Compareceu (gera cobrança de 50%)"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleStatusUpdate(appt.id, 'cancelled')}
                                  disabled={isPending}
                                  className="py-2 px-2.5 bg-destructive/10 hover:bg-destructive text-destructive hover:text-white border border-destructive/20 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                                  title="Cancelar agendamento"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}

                            {/* Receipt button for completed */}
                            {appt.status === 'completed' && (
                              <button
                                onClick={() => setSelectedReceiptApptId(appt.id)}
                                className="flex-1 py-2 px-3 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" /> Recibo
                              </button>
                            )}

                            {/* Admin Delete Button */}
                            {userRole === 'admin' && (
                              <button
                                onClick={() => handleDelete(appt)}
                                disabled={isPending}
                                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all cursor-pointer"
                                title="Excluir agendamento permanentemente (Admin)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            ) : (
              <div className="p-12 text-center text-muted-foreground bg-card/40 rounded-3xl border border-border/60 space-y-3">
                <Calendar className="w-10 h-10 mx-auto opacity-30" />
                <p className="text-sm font-semibold">Nenhum agendamento encontrado para o filtro selecionado.</p>
                {(filterDate || searchQuery || statusFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setFilterDate('')
                      setSearchQuery('')
                      setStatusFilter('all')
                    }}
                    className="text-xs text-primary underline font-medium cursor-pointer"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Selected Appointment Detail Modal */}
        {selectedAgendaAppt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-card border border-border/80 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl relative">
              <div className="flex justify-between items-start pb-3 border-b border-border/40">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded">
                      {apptShortCode(selectedAgendaAppt.id)}
                    </span>
                    <h3 className="font-serif font-bold text-lg text-foreground">{selectedAgendaAppt.customerName}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(selectedAgendaAppt.start_time)} às {formatTime(selectedAgendaAppt.start_time)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedAgendaAppt(null)}
                  className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs bg-secondary/30 p-3.5 rounded-xl border border-border/40">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Serviço:</span>
                  <span className="font-bold text-foreground">{selectedAgendaAppt.services?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Barbeiro:</span>
                  <span className="font-semibold text-foreground">{selectedAgendaAppt.barberName}</span>
                </div>
                <div className="flex justify-between border-t border-border/30 pt-2">
                  <span className="text-muted-foreground">Valor:</span>
                  <span className="font-bold text-amber-400">R$ {getAppointmentPrice(selectedAgendaAppt).toFixed(2)}</span>
                </div>
                {selectedAgendaAppt.notes && (
                  <div className="border-t border-border/30 pt-2">
                    <span className="text-muted-foreground block mb-0.5">Observações:</span>
                    <p className="italic text-foreground">{selectedAgendaAppt.notes}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                {selectedAgendaAppt.status !== 'completed' && selectedAgendaAppt.status !== 'cancelled' && (
                  <button
                    onClick={() => {
                      const id = selectedAgendaAppt.id
                      setSelectedAgendaAppt(null)
                      handleStatusUpdate(id, 'completed')
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Concluir Atendimento
                  </button>
                )}
                {selectedAgendaAppt.status === 'completed' && (
                  <button
                    onClick={() => {
                      const id = selectedAgendaAppt.id
                      setSelectedAgendaAppt(null)
                      setSelectedReceiptApptId(id)
                    }}
                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <FileText className="w-3.5 h-3.5" /> Emitir Recibo
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal (Admin only) */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-card border border-destructive/40 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
              <div className="flex items-center gap-3 text-destructive">
                <div className="p-3 bg-destructive/10 rounded-full">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-serif font-bold text-foreground">Excluir Agendamento</h3>
                  <p className="text-xs text-muted-foreground">Esta ação não pode ser desfeita.</p>
                </div>
              </div>

              <div className="p-3.5 bg-secondary/30 border border-border/50 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente:</span>
                  <span className="font-semibold text-foreground">{deleteTarget.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data/Hora:</span>
                  <span className="font-semibold text-foreground">{formatDate(deleteTarget.start_time)} às {formatTime(deleteTarget.start_time)}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isPending}
                  className="px-4 py-2.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md"
                >
                  {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Sim, Excluir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* No-Show Confirmation Modal */}
        {noShowTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-card border border-border/80 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
              <div className="flex items-center gap-3 text-amber-400">
                <div className="p-3 bg-amber-500/10 rounded-full">
                  <UserX className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-serif font-bold text-foreground">Marcar Não Compareceu</h3>
                  <p className="text-xs text-muted-foreground">Taxa de 50% será gerada ao cliente.</p>
                </div>
              </div>

              <div className="p-3.5 bg-secondary/30 border border-border/50 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente:</span>
                  <span className="font-semibold text-foreground">{noShowTarget.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Serviço:</span>
                  <span className="font-semibold text-foreground">{noShowTarget.services?.name}</span>
                </div>
                <div className="flex justify-between border-t border-border/40 pt-1.5">
                  <span className="text-muted-foreground">Taxa (50%):</span>
                  <span className="font-bold text-amber-400">R$ {(getAppointmentPrice(noShowTarget) * 0.5).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setNoShowTarget(null)}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmNoShow}
                  disabled={isPending}
                  className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md"
                >
                  {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
                  Confirmar Não Compareceu
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Walk-in / Encaixe Presencial Modal */}
        <WalkInModal
          isOpen={showWalkInModal}
          onClose={() => setShowWalkInModal(false)}
          onSuccess={(msg) => {
            setSuccessMsg(msg)
            loadData()
          }}
          barbers={barbers}
          services={services}
          customers={customers}
          defaultDate={selectedAgendaDate || todayLocalStr}
          defaultBarberId={walkInModalBarberId}
          defaultTime={walkInModalTime}
          userRole={userRole}
          currentUser={currentUser}
        />

        {/* Atendimento Extra Modal */}
        <ExtraAppointmentModal
          isOpen={showExtraModal}
          onClose={() => setShowExtraModal(false)}
          onSuccess={(msg) => {
            setSuccessMsg(msg)
            loadData()
          }}
          barbers={barbers}
          services={services}
          customers={customers}
          defaultDate={selectedAgendaDate || todayLocalStr}
          defaultBarberId={extraModalBarberId}
          userRole={userRole}
        />

        {/* Checkout do Dia Modal */}
        <CheckoutModal
          isOpen={showCheckoutModal}
          onClose={() => setShowCheckoutModal(false)}
          onSuccess={(msg) => setSuccessMsg(msg)}
          onError={(msg) => setErrorMsg(msg)}
          onRefreshData={loadData}
          unpaidAppointments={unpaidApptsForCheckout}
          selectedAgendaDate={selectedAgendaDate}
          formatAgendaHeaderDate={formatAgendaHeaderDate}
          getAppointmentPrice={getAppointmentPrice}
          formatTime={formatTime}
          onSelectReceiptAppt={(id) => setSelectedReceiptApptId(id)}
        />

        {/* Receipt Modal */}
        {selectedReceiptApptId && (
          <ReceiptModal
            appointmentId={selectedReceiptApptId}
            onClose={() => setSelectedReceiptApptId(null)}
          />
        )}

      </main>
    </div>
  )
}
