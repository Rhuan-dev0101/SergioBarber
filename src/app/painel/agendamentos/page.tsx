'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Scissors, Calendar, Clock, Search, Edit2, Trash2, CheckCircle2, 
  AlertCircle, Plus, Loader2, Save, X, User, Sparkles, Check, AlertTriangle, UserX,
  Filter, RotateCcw, CheckCircle, ChevronRight, Wallet, DollarSign, RefreshCw, FileText,
  Repeat, ChevronLeft, CalendarDays, LayoutList, Coffee, Crown
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { DashboardSidebar } from '@/components/DashboardSidebar'
import { ReceiptModal } from '@/components/ReceiptModal'
import { CreatePackageForm } from '@/components/CreatePackageForm'
import { 
  updateAppointmentStatusAction, 
  updateAppointmentNotesAction, 
  createWalkInAppointmentAction,
  deleteAppointmentAction,
  markNoShowAction,
  bulkCheckoutAction,
  type BulkCheckoutResult
} from './actions'
import { apptShortCode } from '@/lib/utils'
import { isRecurringReservationActiveOnDate } from '@/lib/booking'

export default function PainelAgendamentos() {
  const router = useRouter()
  const [appointments, setAppointments] = useState<any[]>([])
  const [recurringReservations, setRecurringReservations] = useState<any[]>([])
  const [filteredAppointments, setFilteredAppointments] = useState<any[]>([])
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
  const [filterDate, setFilterDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Walk-in / Novo Agendamento modal form states
  const [showWalkInModal, setShowWalkInModal] = useState(false)
  const [modalTab, setModalTab] = useState<'avulso' | 'pacote'>('avulso')
  const [clientName, setClientName] = useState('')
  const [selectedBarberId, setSelectedBarberId] = useState('')
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [walkInDate, setWalkInDate] = useState('')
  const [walkInTime, setWalkInTime] = useState('')
  const [walkInNotes, setWalkInNotes] = useState('')
  const [walkInPaymentMethod, setWalkInPaymentMethod] = useState('cash')
  
  // Data for selectors
  const [barbers, setBarbers] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

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

  // Checkout do Dia state
  type CheckoutItem = {
    apptId: string
    customerName: string
    serviceName: string
    price: number
    time: string
    originalMethod: string
    selectedMethod: string
    selected: boolean
    isPackage: boolean
    status: 'idle' | 'success' | 'error'
    errorMsg?: string
  }
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [checkoutItems, setCheckoutItems] = useState<CheckoutItem[]>([])
  const [checkoutProcessing, setCheckoutProcessing] = useState(false)
  const [checkoutDone, setCheckoutDone] = useState(false)

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

      // Fetch active barbers and services for walk-in form
      const { data: dbBarbers } = await supabase
        .from('barbers')
        .select('id, is_active, profiles(id, full_name)')
        .eq('is_active', true)

      if (dbBarbers) {
        const formatted = dbBarbers
          .filter((b: any) => b.profiles)
          .map((b: any) => ({
            id: b.id,
            full_name: b.profiles.full_name
          }))
        setBarbers(formatted)
      } else {
        setBarbers([])
      }

      const { data: dbServices } = await supabase
        .from('services')
        .select('id, name, price, duration')
        .eq('is_active', true)
      setServices(dbServices || [])

      // Fetch working hours & days off for agenda timeline
      const { data: dbWH } = await supabase.from('barber_working_hours').select('*')
      setWorkingHours(dbWH || [])

      const { data: dbDO } = await supabase.from('days_off').select('*')
      setDaysOff(dbDO || [])

      // Fetch recurring reservations
      let recQuery = supabase
        .from('recurring_reservations')
        .select('*')
        .eq('status', 'active')

      if (profile.role === 'barber') {
        recQuery = recQuery.eq('barber_id', session.user.id)
      }
      const { data: dbRec } = await recQuery

      if (dbRec && dbRec.length > 0) {
        const recCustIds = Array.from(new Set(dbRec.map(r => r.customer_id).filter(Boolean)))
        const recBarbIds = Array.from(new Set(dbRec.map(r => r.barber_id)))

        const { data: recProfiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', [...recCustIds, ...recBarbIds])

        const recNameMap = (recProfiles || []).reduce((acc: any, p: any) => {
          acc[p.id] = p.full_name
          return acc
        }, {})

        const enrichedRec = dbRec.map(r => ({
          ...r,
          customer_display_name: r.customer_name || (r.customer_id ? recNameMap[r.customer_id] : 'Cliente'),
          barber_name: recNameMap[r.barber_id] || 'Barbeiro'
        }))
        setRecurringReservations(enrichedRec)
      } else {
        setRecurringReservations([])
      }

      // Fetch appointments
      let query = supabase
        .from('appointments')
        .select(`
          id,
          start_time,
          end_time,
          status,
          notes,
          no_show,
          no_show_fee_charged,
          package_subscription_id,
          services (name, price),
          payments (total_amount, status, method),
          customer_id,
          barber_id
        `)
      
      if (profile.role === 'barber') {
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

        const enriched = appts.map(a => {
          let cName = 'Cliente Presencial'
          if (a.customer_id) {
            cName = nameMap[a.customer_id] || 'Cliente'
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

  // Filter pipeline
  useEffect(() => {
    let result = [...appointments]

    // Date Picker Filter
    if (filterDate) {
      result = result.filter(a => a.start_time.split('T')[0] === filterDate)
    }

    // Status tab filter
    const todayStr = new Date().toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).split('/').reverse().join('-')

    if (statusFilter === 'today') {
      result = result.filter(a => a.start_time.split('T')[0] === todayStr && a.status !== 'cancelled')
    } else if (statusFilter === 'confirmed') {
      result = result.filter(a => a.status === 'confirmed' || a.status === 'pending')
    } else if (statusFilter === 'completed') {
      result = result.filter(a => a.status === 'completed')
    } else if (statusFilter === 'cancelled') {
      result = result.filter(a => a.status === 'cancelled' || a.status === 'no_show')
    }

    // Determine target date for projecting active recurring reservations
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

    // Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(a => 
        a.customerName.toLowerCase().includes(q) || 
        (a.notes && a.notes.toLowerCase().includes(q)) ||
        (a.services?.name && a.services.name.toLowerCase().includes(q)) ||
        (a.barberName && a.barberName.toLowerCase().includes(q))
      )
    }

    setFilteredAppointments(result)
  }, [appointments, recurringReservations, filterDate, statusFilter, searchQuery])

  // Load slots for walk-in form
  useEffect(() => {
    if (!selectedBarberId || !selectedServiceId || !walkInDate) {
      setAvailableSlots([])
      return
    }

    async function loadSlots() {
      setLoadingSlots(true)
      setWalkInTime('')
      const service = services.find(s => s.id === selectedServiceId)
      if (!service) return

      try {
        const res = await fetch(`/api/booking/slots?barberId=${selectedBarberId}&dateStr=${walkInDate}&duration=${service.duration}`)
        const data = await res.json()
        setAvailableSlots(data.slots || [])
      } catch (error) {
        console.error('Error fetching slots:', error)
      } finally {
        setLoadingSlots(false)
      }
    }
    loadSlots()
  }, [selectedBarberId, selectedServiceId, walkInDate, services])

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

  const handleCreateWalkIn = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!clientName || !selectedBarberId || !selectedServiceId || !walkInDate || !walkInTime) {
      setErrorMsg('Todos os campos são obrigatórios.')
      return
    }

    startTransition(async () => {
      const res = await createWalkInAppointmentAction(
        clientName,
        selectedBarberId,
        selectedServiceId,
        walkInDate,
        walkInTime,
        walkInNotes,
        walkInPaymentMethod
      )

      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg(res.message)
        setShowWalkInModal(false)
        
        setClientName('')
        setSelectedBarberId('')
        setSelectedServiceId('')
        setWalkInDate('')
        setWalkInTime('')
        setWalkInNotes('')
        setWalkInPaymentMethod('cash')

        loadData()
      }
    })
  }

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

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const formatTime = (dateStr: string) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

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

  const formatAgendaHeaderDate = (dateStr: string) => {
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
  }

  const counts = {
    all: appointments.length,
    today: appointments.filter(a => {
      const todayStr = new Date().toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).split('/').reverse().join('-')
      return a.start_time.split('T')[0] === todayStr && a.status !== 'cancelled'
    }).length,
    confirmed: appointments.filter(a => a.status === 'confirmed' || a.status === 'pending').length,
    completed: appointments.filter(a => a.status === 'completed').length,
    cancelled: appointments.filter(a => a.status === 'cancelled' || a.status === 'no_show').length
  }

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
              onClick={() => setShowWalkInModal(true)}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4 text-primary-foreground" />
              <span>Encaixe Presencial</span>
            </button>
          </div>
        </div>

        {/* Banners */}
        {errorMsg && (
          <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-xl flex items-center justify-between gap-3 text-xs sm:text-sm text-destructive shadow-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg('')} className="text-muted-foreground hover:text-foreground">
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
            <button onClick={() => setSuccessMsg('')} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* AGENDA TIMELINE VIEW (DEFAULT) */}
        {viewMode === 'agenda' ? (
          <div className="space-y-6">
            {/* OSanchez Luxury Top Branding & Control Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#121212] border border-white/10 p-4 rounded-2xl shadow-xl">
              
              {/* Brand Title + Barber Selector */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 pr-3 border-r border-white/10">
                  <Scissors className="w-5 h-5 text-amber-400 rotate-45" />
                  <span className="font-serif font-bold text-sm tracking-widest text-white uppercase">
                    OSanchez Painel
                  </span>
                </div>

                {userRole === 'admin' ? (
                  <div className="relative">
                    <select
                      value={selectedBarberFilter}
                      onChange={(e) => setSelectedBarberFilter(e.target.value)}
                      className="px-3.5 py-2 bg-[#1c1c1e] border border-white/10 hover:border-amber-500/40 text-xs font-bold text-white rounded-xl outline-none cursor-pointer pr-8"
                    >
                      <option value="all">Todos os Barbeiros ({barbers.length})</option>
                      {barbers.map((b) => (
                        <option key={b.id} value={b.id}>{b.full_name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    {barbers.find(b => b.id === currentUser?.id)?.full_name || 'Meu Dia'}
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleToday}
                  className="px-4 py-1.5 bg-[#0a3825] hover:bg-[#0e4b32] text-[#34d399] border border-[#10b981]/40 rounded-full text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  HOJE
                </button>
              </div>

              {/* Date Controls & Date Picker */}
              <div className="flex items-center gap-2 justify-between sm:justify-end">
                <button
                  type="button"
                  onClick={handlePrevDay}
                  className="p-2 bg-[#1c1c1e] hover:bg-[#252528] border border-white/10 text-white rounded-xl transition-all cursor-pointer"
                  title="Dia Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1c1c1e] border border-white/10 rounded-xl">
                  <input
                    type="date"
                    value={selectedAgendaDate}
                    onChange={(e) => setSelectedAgendaDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
                  />
                  <span className="text-xs font-bold text-zinc-400 border-l border-white/10 pl-2 capitalize hidden md:inline">
                    {formatAgendaHeaderDate(selectedAgendaDate)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleNextDay}
                  className="p-2 bg-[#1c1c1e] hover:bg-[#252528] border border-white/10 text-white rounded-xl transition-all cursor-pointer"
                  title="Próximo Dia"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Agenda Timeline Grid */}
            {(() => {
              const agendaBarbers = barbers.filter(b => {
                if (userRole === 'barber') return b.id === currentUser?.id
                if (selectedBarberFilter === 'all') return true
                return b.id === selectedBarberFilter
              })

              if (agendaBarbers.length === 0) {
                return (
                  <div className="p-12 text-center text-muted-foreground bg-[#121212] border border-white/10 rounded-2xl">
                    <User className="w-12 h-12 mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-semibold text-white">Nenhum barbeiro ativo encontrado.</p>
                  </div>
                )
              }

              const [y, m, d] = selectedAgendaDate.split('-').map(Number)
              const dayOfWeek = new Date(y, m - 1, d).getDay()

              return (
                <div className={`grid gap-6 ${
                  agendaBarbers.length > 1 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
                }`}>
                  {agendaBarbers.map((barber) => {
                    const isDayOff = daysOff.some(doItem => doItem.barber_id === barber.id && doItem.date === selectedAgendaDate)
                    const wh = workingHours.find(w => w.barber_id === barber.id && w.day_of_week === dayOfWeek)
                    const isClosed = !wh || wh.is_closed || isDayOff

                    // Generate hourly slots
                    let startHour = 8
                    let endHour = 19

                    if (wh?.slots && Array.isArray(wh.slots) && wh.slots.length > 0) {
                      const firstSlot = wh.slots[0]?.start
                      const lastSlot = wh.slots[wh.slots.length - 1]?.end
                      if (firstSlot) startHour = parseInt(firstSlot.split(':')[0], 10)
                      if (lastSlot) endHour = parseInt(lastSlot.split(':')[0], 10)
                    }

                    const timeSlots: string[] = []
                    for (let h = startHour; h <= endHour; h++) {
                      timeSlots.push(`${String(h).padStart(2, '0')}:00`)
                    }

                    const lunchStartSlot = wh?.lunch_break_start ? String(wh.lunch_break_start).substring(0, 5) : null

                    return (
                      <div
                        key={barber.id}
                        className="bg-[#0e0e10] border border-white/10 rounded-3xl p-5 shadow-2xl space-y-4"
                      >
                        {/* Barber Header */}
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-base shadow-inner">
                              {barber.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="font-extrabold text-sm text-white">{barber.full_name}</h4>
                              <p className="text-[11px] text-zinc-400">
                                {isClosed ? '🚪 Fechado neste dia' : `Horário: ${String(startHour).padStart(2, '0')}:00 às ${String(endHour).padStart(2, '0')}:00`}
                              </p>
                            </div>
                          </div>
                          {isClosed && (
                            <span className="text-[10px] uppercase font-black px-3 py-1 rounded-full bg-destructive/15 text-destructive border border-destructive/30">
                              Fechado / Folga
                            </span>
                          )}
                        </div>

                        {/* Slots list */}
                        {isClosed ? (
                          <div className="p-8 text-center bg-[#141416] rounded-2xl border border-white/5 text-zinc-400">
                            <Coffee className="w-8 h-8 mx-auto mb-2 opacity-40 text-amber-400" />
                            <p className="text-xs font-bold text-white">Dia Sem Atendimento</p>
                            <p className="text-[11px] text-zinc-400 mt-1">Este profissional não trabalha neste dia da semana.</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {timeSlots.map((slotStr) => {
                              const isLunch = lunchStartSlot === slotStr

                              if (isLunch) {
                                return (
                                  <div
                                    key={slotStr}
                                    className="bg-[#18181b] border border-white/5 rounded-2xl p-4 flex items-center justify-between opacity-85 transition-all"
                                  >
                                    <div className="flex items-center gap-4">
                                      <span className="text-2xl font-bold font-mono text-zinc-400 tracking-tight w-16">{slotStr}</span>
                                      <div className="flex items-center gap-2 text-amber-400 font-bold text-sm tracking-wide uppercase">
                                        <Coffee className="w-4 h-4 text-amber-400" />
                                        <span>INTERVALO DE ALMOÇO</span>
                                      </div>
                                    </div>
                                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Indisponível</span>
                                  </div>
                                )
                              }

                              // Find appointment for this slot
                              const slotHour = slotStr.substring(0, 2)
                              const appt = appointments.find(a => {
                                if (a.barber_id !== barber.id) return false
                                if (a.start_time.split('T')[0] !== selectedAgendaDate) return false
                                if (a.status === 'cancelled') return false
                                const aHour = formatTime(a.start_time).substring(0, 2)
                                return aHour === slotHour
                              })

                              // Find recurring reservation for this slot
                              const rec = recurringReservations.find(r => {
                                if (r.barber_id !== barber.id) return false
                                if (r.day_of_week !== dayOfWeek) return false
                                const rHour = r.time_slot.substring(0, 2)
                                if (rHour !== slotHour) return false
                                return isRecurringReservationActiveOnDate(r.start_date, r.interval_weeks, selectedAgendaDate)
                              })

                              if (appt) {
                                const isPackage = appt.package_subscription_id || appt.services?.name?.toLowerCase().includes('pacote')

                                if (isPackage) {
                                  return (
                                    <div
                                      key={slotStr}
                                      onClick={() => setSelectedAgendaAppt(appt)}
                                      className="bg-gradient-to-r from-[#947629] via-[#b39034] to-[#c7a33b] border border-amber-300/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl shadow-amber-500/10 hover:brightness-105 transition-all cursor-pointer text-zinc-950 group"
                                    >
                                      <div className="flex items-center gap-4 min-w-0">
                                        <span className="text-2xl font-black font-mono text-zinc-950 tracking-tight w-16 shrink-0">{slotStr}</span>
                                        <div className="min-w-0 space-y-0.5">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <h5 className="font-black text-base text-zinc-950 uppercase tracking-wide truncate">{appt.customerName}</h5>
                                            <span className="font-mono text-xs text-zinc-900 bg-zinc-950/20 px-2 py-0.5 rounded border border-zinc-950/30 font-bold">
                                              {apptShortCode(appt.id)}
                                            </span>
                                          </div>
                                          <p className="text-xs font-extrabold text-zinc-900/90 truncate">
                                            • {appt.services?.name || 'Pacote Mensal'}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                        <span className="px-3.5 py-1.5 rounded-xl bg-zinc-950/30 text-zinc-950 border border-zinc-950/40 text-xs font-black uppercase flex items-center gap-1.5 shadow-sm">
                                          <CheckCircle2 className="w-4 h-4 text-zinc-950" />
                                          {appt.status === 'completed' ? 'CONCLUÍDO' : 'CONFIRMADO'}
                                        </span>
                                      </div>
                                    </div>
                                  )
                                }

                                return (
                                  <div
                                    key={slotStr}
                                    onClick={() => setSelectedAgendaAppt(appt)}
                                    className={`bg-gradient-to-r from-[#06261a] to-[#0a3825] border border-[#10b981]/40 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg hover:border-[#10b981]/70 transition-all cursor-pointer group ${
                                      appt.status === 'completed'
                                        ? 'brightness-110'
                                        : appt.status === 'no_show'
                                        ? 'from-[#332208] to-[#472f0b] border-amber-500/40'
                                        : ''
                                    }`}
                                  >
                                    <div className="flex items-center gap-4 min-w-0">
                                      <span className="text-2xl font-bold font-mono text-[#34d399] tracking-tight w-16 shrink-0">{slotStr}</span>
                                      <div className="min-w-0 space-y-0.5">
                                        <p className="text-xs text-[#a7f3d0]/80 font-medium">
                                          {formatTime(appt.start_time) || slotStr} - {appt.end_time ? formatTime(appt.end_time) : slotStr}
                                        </p>
                                        <h5 className="font-bold text-base text-white uppercase flex items-center gap-2 truncate">
                                          <User className="w-4 h-4 text-[#34d399] shrink-0" />
                                          {appt.customerName} <span className="text-zinc-400 font-normal">• {appt.services?.name}</span>
                                        </h5>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                      <span className="px-3.5 py-1.5 rounded-xl bg-[#262010] text-[#e5c158] border border-[#a3832c]/50 text-xs font-extrabold flex items-center gap-1.5 shadow-sm">
                                        <CheckCircle2 className="w-4 h-4 text-[#e5c158]" />
                                        {appt.status === 'completed' ? 'Concluído' : appt.status === 'no_show' ? 'Não Compareceu' : 'Confirmado'}
                                      </span>
                                    </div>
                                  </div>
                                )
                              }

                              if (rec) {
                                return (
                                  <div
                                    key={slotStr}
                                    className="bg-gradient-to-r from-cyan-950/90 to-slate-900 border border-cyan-500/50 rounded-2xl p-4 flex items-center justify-between gap-3 text-cyan-200 shadow-md"
                                  >
                                    <div className="flex items-center gap-4">
                                      <span className="text-2xl font-bold font-mono text-cyan-400 tracking-tight w-16">{slotStr}</span>
                                      <div>
                                        <span className="font-bold text-white text-base block">{rec.customer_display_name}</span>
                                        <span className="text-xs text-cyan-300 font-semibold flex items-center gap-1.5">
                                          <Repeat className="w-3.5 h-3.5" /> Reserva Fixa ({rec.interval_weeks === 1 ? 'Semanal' : 'Quinzenal'})
                                        </span>
                                      </div>
                                    </div>
                                    <span className="px-3 py-1 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-bold uppercase">
                                      ✔ Reservado
                                    </span>
                                  </div>
                                )
                              }

                              // Free slot
                              return (
                                <div
                                  key={slotStr}
                                  onClick={() => {
                                    setWalkInDate(selectedAgendaDate)
                                    setWalkInTime(slotStr)
                                    setSelectedBarberId(barber.id)
                                    setShowWalkInModal(true)
                                  }}
                                  className="bg-[#121212] hover:bg-[#161616] border border-white/10 hover:border-amber-500/40 rounded-2xl p-4 transition-all duration-200 flex items-center justify-between shadow-md cursor-pointer group"
                                >
                                  <div className="flex items-center gap-4">
                                    <span className="text-2xl font-bold font-mono text-white tracking-tight w-16">{slotStr}</span>
                                    <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium group-hover:text-zinc-200 transition-colors">
                                      <Calendar className="w-4 h-4 text-zinc-500 group-hover:text-amber-400 transition-colors" />
                                      <span>Horário Disponível</span>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    className="px-4 py-2 bg-[#262010] group-hover:bg-[#382f18] text-[#e5c158] border border-[#a3832c]/50 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1 active:scale-95"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Agendar</span>
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            {/* Checkout do Dia Button */}
            {(() => {
              const unpaidAppts = appointments.filter(a => {
                if (a.start_time.split('T')[0] !== selectedAgendaDate) return false
                if (a.status === 'completed' || a.status === 'cancelled' || a.status === 'no_show') return false
                const payStatus = Array.isArray(a.payments) ? a.payments[0]?.status : a.payments?.status
                if (payStatus === 'paid' || payStatus === 'confirmed_manually') return false
                return true
              })

              if (unpaidAppts.length === 0) return null

              const openCheckoutModal = () => {
                const items: CheckoutItem[] = unpaidAppts.map(a => {
                  const payMethod = Array.isArray(a.payments) ? a.payments[0]?.method : a.payments?.method
                  return {
                    apptId: a.id,
                    customerName: a.customerName || 'Cliente',
                    serviceName: a.services?.name || 'Serviço',
                    price: Number(a.services?.price || 0),
                    time: formatTime(a.start_time),
                    originalMethod: payMethod || 'cash',
                    selectedMethod: payMethod || 'cash',
                    selected: true,
                    isPackage: !!a.package_subscription_id,
                    status: 'idle'
                  }
                })
                setCheckoutItems(items)
                setCheckoutDone(false)
                setCheckoutProcessing(false)
                setShowCheckoutModal(true)
              }

              return (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={openCheckoutModal}
                    className="w-full py-4 bg-gradient-to-r from-[#6b4f1d] via-[#947629] to-[#6b4f1d] hover:from-[#7a5b22] hover:via-[#a8862f] hover:to-[#7a5b22] text-white border border-amber-400/40 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-3 transition-all cursor-pointer shadow-xl shadow-amber-900/20 active:scale-[0.98]"
                  >
                    <DollarSign className="w-5 h-5 text-amber-300" />
                    Checkout do Dia — {unpaidAppts.length} pendente{unpaidAppts.length > 1 ? 's' : ''}
                    <ChevronRight className="w-4 h-4 text-amber-300" />
                  </button>
                </div>
              )
            })()}
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
                                <span className="font-mono text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-lg border border-border/60 tracking-widest font-semibold">
                                  {apptShortCode(appt.id)}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground font-medium">
                                {formatDate(appt.start_time)}
                              </p>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                              <span className={`text-[10px] uppercase font-extrabold px-2.5 py-1 rounded-full border flex items-center gap-1 shrink-0 ${
                                appt.isRecurringReservation
                                  ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                                  : appt.status === 'completed' 
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                                  : appt.status === 'cancelled'
                                  ? 'bg-destructive/10 text-destructive border-destructive/30'
                                  : appt.status === 'no_show'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                  : appt.status === 'confirmed'
                                  ? 'bg-primary/10 text-primary border-primary/30'
                                  : 'bg-amber-400/10 text-amber-400 border-amber-400/30 animate-pulse'
                              }`}>
                                {appt.isRecurringReservation && <Repeat className="w-3 h-3 text-cyan-400" />}
                                {appt.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                                {appt.status === 'confirmed' && <CheckCircle className="w-3 h-3" />}
                                {appt.status === 'pending' && <Clock className="w-3 h-3" />}
                                {appt.isRecurringReservation ? 'Reserva Fixa' : appt.status === 'completed' ? 'Concluído' : appt.status === 'cancelled' ? 'Cancelado' : appt.status === 'no_show' ? 'Não Compareceu' : appt.status === 'confirmed' ? 'Confirmado' : 'Pendente'}
                              </span>

                              {appt.no_show_fee_charged && (
                                <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                  Taxa Cobrada ✓
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Customer Name & Info */}
                          <div className="flex items-center gap-3 bg-secondary/30 p-3 rounded-xl border border-border/40">
                            <div className="w-10 h-10 rounded-full bg-secondary border border-primary/30 flex items-center justify-center text-primary font-serif font-bold text-base shrink-0 shadow-inner">
                              {appt.customerName ? appt.customerName.charAt(0).toUpperCase() : 'C'}
                            </div>
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <h4 className="font-bold text-sm text-foreground truncate">
                                {appt.customerName}
                              </h4>
                              {userRole === 'admin' && (
                                <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                                  <User className="w-3 h-3 text-primary" />
                                  Profissional: <strong className="text-foreground font-medium">{appt.barberName}</strong>
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Service & Price Row */}
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Serviço</span>
                              <span className="font-semibold text-foreground flex items-center gap-1.5">
                                {appt.services?.name}
                                {appt.package_subscription_id && (
                                  <span className="text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                    Pacote
                                  </span>
                                )}
                              </span>
                            </div>

                            <div className="text-right space-y-0.5">
                              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Valor</span>
                              <span className="font-serif font-bold text-amber-400 text-sm">
                                R$ {Number(appt.services?.price || 0).toFixed(2)}
                              </span>
                            </div>
                          </div>

                          {/* Payment Method Badge */}
                          <div className="flex items-center justify-between pt-1 border-t border-border/30 text-xs">
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Wallet className="w-3.5 h-3.5 text-primary" /> Formato Pagto:
                            </span>
                            <span className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-lg border ${
                              payMethod === 'cash'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : payMethod === 'card'
                                ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                                : payMethod === 'pix'
                                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                : 'bg-secondary text-muted-foreground border-border/50'
                            }`}>
                              {payMethod === 'cash' ? 'Dinheiro' : payMethod === 'card' ? 'Cartão' : payMethod === 'pix' ? 'Pix (Sinal)' : 'Não Inf.'}
                            </span>
                          </div>

                          {/* Notes */}
                          {appt.notes && (
                            <div className="text-xs bg-secondary/50 p-2.5 rounded-xl border border-border/40">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-muted-foreground font-semibold uppercase">Observações</span>
                                {editingNotesId !== appt.id && (
                                  <button
                                    onClick={() => {
                                      setEditingNotesId(appt.id)
                                      setNotesContent(appt.notes || '')
                                    }}
                                    className="text-[10px] text-primary hover:underline font-semibold flex items-center gap-0.5"
                                  >
                                    <Edit2 className="w-3 h-3" /> Editar
                                  </button>
                                )}
                              </div>
                              {editingNotesId === appt.id ? (
                                <div className="space-y-2 mt-1">
                                  <textarea
                                    value={notesContent}
                                    onChange={(e) => setNotesContent(e.target.value)}
                                    rows={2}
                                    className="w-full p-2 bg-background border border-primary rounded-lg text-xs text-foreground outline-none resize-none"
                                  />
                                  <div className="flex justify-end gap-1.5">
                                    <button
                                      onClick={() => setEditingNotesId(null)}
                                      className="px-2 py-1 bg-secondary text-muted-foreground hover:text-foreground rounded text-[10px] font-semibold"
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      onClick={() => handleSaveNotes(appt.id)}
                                      disabled={isPending}
                                      className="px-2.5 py-1 bg-primary text-primary-foreground rounded text-[10px] font-bold flex items-center gap-1"
                                    >
                                      {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                      Salvar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-foreground/90 italic text-[11px] leading-relaxed">
                                  {appt.notes}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action buttons footer */}
                        <div className="pt-3 border-t border-border/60 flex items-center gap-2 flex-wrap sm:flex-nowrap">
                          {appt.status !== 'completed' && appt.status !== 'cancelled' && (
                            <button
                              onClick={() => handleStatusUpdate(appt.id, 'completed')}
                              disabled={isPending}
                              className="flex-1 min-h-[44px] py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-4 h-4 text-white" />
                              <span>Concluir</span>
                            </button>
                          )}

                          {appt.status !== 'completed' && appt.status !== 'cancelled' && appt.status !== 'no_show' && (
                            <button
                              onClick={() => handleStatusUpdate(appt.id, 'cancelled')}
                              disabled={isPending}
                              className="min-h-[44px] py-2.5 px-3 bg-destructive/10 hover:bg-destructive/20 border border-destructive/30 text-destructive text-xs font-semibold rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                            >
                              <X className="w-4 h-4" />
                              <span>Cancelar</span>
                            </button>
                          )}

                          {appt.status !== 'completed' && appt.status !== 'cancelled' && appt.status !== 'no_show' && (payMethod === 'cash' || payMethod === 'card') && (
                            <button
                              onClick={() => setNoShowTarget(appt)}
                              disabled={isPending}
                              className="min-h-[44px] py-2.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                              title="Marcar como não compareceu"
                            >
                              <UserX className="w-4 h-4" />
                              <span className="hidden sm:inline">Não Compareceu</span>
                            </button>
                          )}

                          {(appt.status === 'completed' || (Array.isArray(appt.payments) ? appt.payments[0]?.status : appt.payments?.status) === 'confirmed_manually' || (Array.isArray(appt.payments) ? appt.payments[0]?.status : appt.payments?.status) === 'paid') && (
                            <button
                              onClick={() => setSelectedReceiptApptId(appt.id)}
                              className="min-h-[44px] py-2.5 px-3 bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm"
                              title="Emitir Recibo de Pagamento"
                            >
                              <FileText className="w-4 h-4 text-primary" />
                              <span>Emitir Recibo</span>
                            </button>
                          )}

                          {userRole === 'admin' && (
                            <button
                              onClick={() => handleDelete(appt)}
                              disabled={isPending}
                              className="min-h-[44px] p-2.5 bg-destructive/10 hover:bg-destructive/20 border border-destructive/25 text-destructive rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
                              title="Excluir agendamento permanentemente"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
            ) : (
              <div className="p-12 text-center bg-secondary/20 border border-border/60 rounded-2xl space-y-3">
                <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto" />
                <h3 className="text-base font-semibold text-foreground">Nenhum agendamento encontrado</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {searchQuery || filterDate || statusFilter !== 'all'
                    ? 'Tente alterar os filtros ou termo de busca.'
                    : 'Não há agendamentos cadastrados no momento.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Selected Agenda Appointment Action Detail Modal */}
        {selectedAgendaAppt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-card border border-border/80 rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
              
              <div className="flex justify-between items-start pb-3 border-b border-border/40">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-primary font-bold bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                      {apptShortCode(selectedAgendaAppt.id)}
                    </span>
                    <span className={`text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full border ${
                      selectedAgendaAppt.status === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : selectedAgendaAppt.status === 'no_show'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-primary/10 text-primary border-primary/30'
                    }`}>
                      {selectedAgendaAppt.status === 'completed' ? 'Concluído' : selectedAgendaAppt.status === 'no_show' ? 'Não Compareceu' : 'Confirmado'}
                    </span>
                  </div>
                  <h3 className="font-serif font-bold text-lg text-foreground mt-1">
                    {selectedAgendaAppt.customerName}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedAgendaAppt(null)}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-secondary cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Appointment details summary */}
              <div className="p-3.5 bg-secondary/30 border border-border/50 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-primary" /> Data & Hora:
                  </span>
                  <span className="font-bold text-foreground">
                    {formatDate(selectedAgendaAppt.start_time)} às {formatTime(selectedAgendaAppt.start_time)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Scissors className="w-3.5 h-3.5 text-primary" /> Serviço:
                  </span>
                  <span className="font-semibold text-foreground">{selectedAgendaAppt.services?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-primary" /> Profissional:
                  </span>
                  <span className="font-semibold text-foreground">{selectedAgendaAppt.barberName}</span>
                </div>
                <div className="flex justify-between border-t border-border/40 pt-1.5">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-amber-400" /> Valor Total:
                  </span>
                  <span className="font-bold text-amber-400">
                    R$ {Number(selectedAgendaAppt.services?.price || 0).toFixed(2)}
                  </span>
                </div>
                {selectedAgendaAppt.notes && (
                  <div className="border-t border-border/40 pt-1.5 text-muted-foreground">
                    <span className="font-semibold text-foreground block mb-0.5">Observações:</span>
                    <p className="italic bg-background/50 p-2 rounded border border-border/40">{selectedAgendaAppt.notes}</p>
                  </div>
                )}
              </div>

              {/* Action buttons grid */}
              <div className="space-y-2 pt-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block mb-2">
                  Ações do Agendamento
                </span>

                {selectedAgendaAppt.status !== 'completed' && (
                  <button
                    onClick={() => {
                      handleStatusUpdate(selectedAgendaAppt.id, 'completed')
                      setSelectedAgendaAppt(null)
                    }}
                    disabled={isPending}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Concluir Atendimento
                  </button>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setSelectedReceiptApptId(selectedAgendaAppt.id)
                      setSelectedAgendaAppt(null)
                    }}
                    className="py-2 px-3 bg-secondary hover:bg-muted text-foreground font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-border/60 transition-all cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-primary" /> Recibo
                  </button>

                  <button
                    onClick={() => {
                      setNoShowTarget(selectedAgendaAppt)
                      setSelectedAgendaAppt(null)
                    }}
                    className="py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-amber-500/30 transition-all cursor-pointer"
                  >
                    <UserX className="w-3.5 h-3.5" /> Não Compareceu
                  </button>
                </div>

                <button
                  onClick={() => {
                    setDeleteTarget(selectedAgendaAppt)
                    setSelectedAgendaAppt(null)
                  }}
                  className="w-full py-2.5 bg-destructive/10 hover:bg-destructive/20 text-destructive font-semibold rounded-xl text-xs flex items-center justify-center gap-2 border border-destructive/30 transition-all cursor-pointer mt-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Cancelar / Excluir
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Delete Confirmation Modal (admin only) */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-card border border-border/80 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
              <div className="flex items-center gap-3 text-destructive">
                <div className="p-3 bg-destructive/10 rounded-full">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-serif font-bold text-foreground">Excluir Agendamento?</h3>
                  <p className="text-xs text-muted-foreground">Esta ação é permanente e irreversível.</p>
                </div>
              </div>

              <div className="p-3.5 bg-secondary/30 border border-border/50 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente:</span>
                  <span className="font-semibold text-foreground">{deleteTarget.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Serviço:</span>
                  <span className="font-semibold text-foreground">{deleteTarget.services?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data / Hora:</span>
                  <span className="font-semibold text-foreground">
                    {formatDate(deleteTarget.start_time)} às {formatTime(deleteTarget.start_time)}
                  </span>
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
                  <span className="font-bold text-amber-400">R$ {(Number(noShowTarget.services?.price || 0) * 0.5).toFixed(2)}</span>
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

        {/* Walk-in / Novo Agendamento Modal overlay */}
        {showWalkInModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`bg-card border border-border/80 rounded-2xl p-6 sm:p-8 w-full space-y-5 relative shadow-2xl max-h-[90vh] overflow-y-auto transition-all ${
              modalTab === 'pacote' ? 'max-w-xl' : 'max-w-md'
            }`}>
              
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
                    onClick={() => {
                      setShowWalkInModal(false)
                      setModalTab('avulso')
                    }}
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
                  <div className="space-y-1.5">
                    <label htmlFor="wName" className="text-xs font-semibold text-muted-foreground uppercase">Nome do Cliente</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        id="wName"
                        type="text"
                        placeholder="Nome completo do cliente"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        disabled={isPending}
                        className="w-full pl-10 pr-4 py-2.5 bg-secondary/50 border border-border focus:border-primary rounded-xl text-base outline-none text-foreground"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="wBarber" className="text-xs font-semibold text-muted-foreground uppercase">Barbeiro</label>
                    <select
                      id="wBarber"
                      value={selectedBarberId}
                      onChange={(e) => setSelectedBarberId(e.target.value)}
                      disabled={isPending}
                      className="w-full px-3.5 py-2.5 bg-secondary/50 border border-border focus:border-primary rounded-xl text-base text-foreground outline-none cursor-pointer"
                      required
                    >
                      <option value="">Selecione o profissional</option>
                      {barbers.map(b => (
                        <option key={b.id} value={b.id}>{b.full_name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="wService" className="text-xs font-semibold text-muted-foreground uppercase">Serviço</label>
                    <select
                      id="wService"
                      value={selectedServiceId}
                      onChange={(e) => setSelectedServiceId(e.target.value)}
                      disabled={isPending}
                      className="w-full px-3.5 py-2.5 bg-secondary/50 border border-border focus:border-primary rounded-xl text-base text-foreground outline-none cursor-pointer"
                      required
                    >
                      <option value="">Selecione o serviço</option>
                      {services.map(s => (
                        <option key={s.id} value={s.id}>{s.name} - R$ {Number(s.price).toFixed(2)} ({s.duration}min)</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="wDate" className="text-xs font-semibold text-muted-foreground uppercase">Data</label>
                    <input
                      id="wDate"
                      type="date"
                      value={walkInDate}
                      onChange={(e) => setWalkInDate(e.target.value)}
                      disabled={isPending}
                      className="w-full px-3 py-2.5 bg-secondary/50 border border-border focus:border-primary rounded-xl text-base text-foreground outline-none cursor-pointer"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="wTime" className="text-xs font-semibold text-muted-foreground uppercase">Horários Disponíveis</label>
                    {loadingSlots ? (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-2">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" /> Carregando horários livres...
                      </div>
                    ) : availableSlots.length > 0 ? (
                      <select
                        id="wTime"
                        value={walkInTime}
                        onChange={(e) => setWalkInTime(e.target.value)}
                        disabled={isPending}
                        className="w-full px-3.5 py-2.5 bg-secondary/50 border border-border focus:border-primary rounded-xl text-base text-foreground outline-none cursor-pointer"
                        required
                      >
                        <option value="">Escolha um horário livre</option>
                        {availableSlots.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-[11px] text-muted-foreground italic bg-secondary/40 p-2.5 rounded-xl border border-border">
                        Selecione barbeiro, serviço e data para carregar horários disponíveis.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="wPaymentMethod" className="text-xs font-semibold text-muted-foreground uppercase">Forma de Pagamento (Presencial)</label>
                    <select
                      id="wPaymentMethod"
                      value={walkInPaymentMethod}
                      onChange={(e) => setWalkInPaymentMethod(e.target.value)}
                      disabled={isPending}
                      className="w-full px-3.5 py-2.5 bg-secondary/50 border border-border focus:border-primary rounded-xl text-xs text-foreground outline-none cursor-pointer"
                    >
                      <option value="cash">Dinheiro</option>
                      <option value="card">Cartão (Débito / Crédito)</option>
                      <option value="pix">Pix (No local)</option>
                      <option value="other">Outro</option>
                    </select>
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
                    setSuccessMsg(msg || 'Pacote mensal criado com sucesso!')
                    setShowWalkInModal(false)
                    setModalTab('avulso')
                    loadData()
                  }}
                  onCancel={() => {
                    setShowWalkInModal(false)
                    setModalTab('avulso')
                  }}
                />
              )}
            </div>
          </div>
        )}

        {/* Checkout do Dia Modal */}
        {showCheckoutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-card border border-border/80 rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
              
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-border/60 bg-gradient-to-r from-[#1a150a] to-[#0e0e10] shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="font-serif font-bold text-base sm:text-lg text-foreground">Checkout do Dia</h3>
                      <p className="text-[11px] text-muted-foreground">
                        {formatAgendaHeaderDate(selectedAgendaDate)} • {checkoutItems.filter(i => i.selected).length} selecionado(s)
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setShowCheckoutModal(false); setCheckoutItems([]) }}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body — Scrollable */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
                {checkoutItems.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-semibold">Nenhum agendamento pendente para checkout.</p>
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
                      {/* Row top: checkbox, time, customer, price */}
                      <div className="flex items-center gap-3">
                        {/* Checkbox — disabled after processing */}
                        <label className="flex items-center shrink-0 cursor-pointer">
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
                        </label>

                        {/* Time */}
                        <span className="text-lg font-bold font-mono text-foreground w-14 shrink-0">
                          {item.time}
                        </span>

                        {/* Customer + Service */}
                        <div className="flex-1 min-w-0">
                          <h5 className="font-bold text-sm text-foreground truncate flex items-center gap-1.5">
                            {item.customerName}
                            {item.isPackage && (
                              <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                                Pacote
                              </span>
                            )}
                          </h5>
                          <p className="text-xs text-muted-foreground truncate">{item.serviceName}</p>
                        </div>

                        {/* Price */}
                        <span className="font-serif font-bold text-amber-400 text-sm shrink-0">
                          R$ {item.price.toFixed(2)}
                        </span>
                      </div>

                      {/* Row bottom: payment method selector + status */}
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

                        {item.selectedMethod !== item.originalMethod && item.selected && item.status === 'idle' && (
                          <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 whitespace-nowrap shrink-0">
                            Alterado
                          </span>
                        )}

                        {/* Per-row status indicator */}
                        {item.status === 'success' && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Pago
                          </span>
                        )}
                        {item.status === 'error' && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-destructive shrink-0" title={item.errorMsg}>
                            <AlertCircle className="w-3.5 h-3.5" /> Erro
                          </span>
                        )}
                      </div>

                      {/* Error message detail */}
                      {item.status === 'error' && item.errorMsg && (
                        <div className="ml-7.5 p-2 bg-destructive/10 border border-destructive/20 rounded-lg text-[11px] text-destructive">
                          {item.errorMsg}
                        </div>
                      )}

                      {/* Post-checkout receipt button */}
                      {item.status === 'success' && (
                        <div className="ml-7.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedReceiptApptId(item.apptId)
                            }}
                            className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary font-bold text-[11px] rounded-lg flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                          >
                            <FileText className="w-3.5 h-3.5" /> Emitir Recibo
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 sm:p-5 border-t border-border/60 bg-secondary/20 shrink-0 space-y-3">
                {/* Summary */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {checkoutItems.filter(i => i.selected).length} de {checkoutItems.length} selecionado(s)
                  </span>
                  <span className="font-serif font-bold text-amber-400 text-sm">
                    Total: R$ {checkoutItems.filter(i => i.selected).reduce((sum, i) => sum + i.price, 0).toFixed(2)}
                  </span>
                </div>

                {/* Action buttons */}
                {!checkoutDone ? (
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => { setShowCheckoutModal(false); setCheckoutItems([]) }}
                      disabled={checkoutProcessing}
                      className="flex-1 py-3 px-4 bg-secondary hover:bg-muted border border-border text-foreground font-semibold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
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

                          // Map results back to checkout items
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

                          // Show global success/error message
                          if (res.success) {
                            setSuccessMsg(res.message)
                          } else {
                            setErrorMsg(res.message)
                          }

                          // Reload data to reflect updated statuses
                          loadData()
                        } catch (err) {
                          console.error('Bulk checkout error:', err)
                          setErrorMsg('Erro inesperado ao processar checkout.')
                        } finally {
                          setCheckoutProcessing(false)
                        }
                      }}
                      className="flex-[2] py-3 px-4 bg-gradient-to-r from-[#6b4f1d] via-[#947629] to-[#6b4f1d] hover:from-[#7a5b22] hover:via-[#a8862f] hover:to-[#7a5b22] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {checkoutProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-amber-300" />
                          Confirmar Todos ({checkoutItems.filter(i => i.selected).length})
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowCheckoutModal(false)
                      setCheckoutItems([])
                      setCheckoutDone(false)
                    }}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Checkout Concluído — Fechar
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

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
