'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Scissors, Calendar, Clock, Search, Edit2, Trash2, CheckCircle2, 
  AlertCircle, Plus, Loader2, Save, X, User, Sparkles, Check, AlertTriangle, UserX,
  Filter, RotateCcw, CheckCircle, ChevronRight, Wallet, DollarSign, RefreshCw
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { DashboardSidebar } from '@/components/DashboardSidebar'
import { 
  updateAppointmentStatusAction, 
  updateAppointmentNotesAction, 
  createWalkInAppointmentAction,
  deleteAppointmentAction,
  markNoShowAction
} from './actions'
import { apptShortCode } from '@/lib/utils'

export default function PainelAgendamentos() {
  const router = useRouter()
  const [appointments, setAppointments] = useState<any[]>([])
  const [filteredAppointments, setFilteredAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Walk-in form states
  const [showWalkInModal, setShowWalkInModal] = useState(false)
  const [clientName, setClientName] = useState('')
  const [selectedBarberId, setSelectedBarberId] = useState('')
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [walkInDate, setWalkInDate] = useState('')
  const [walkInTime, setWalkInTime] = useState('')
  const [walkInNotes, setWalkInNotes] = useState('')
  
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
  const [isPending, startTransition] = useTransition()

  // Delete confirmation modal state (admin only)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)

  // No-show confirmation modal state
  const [noShowTarget, setNoShowTarget] = useState<any>(null)

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
        .from('profiles')
        .select('id, full_name, role')
        .eq('role', 'barber')
      setBarbers(dbBarbers || [])

      const { data: dbServices } = await supabase
        .from('services')
        .select('id, name, price, duration')
        .eq('is_active', true)
      setServices(dbServices || [])

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
    if (statusFilter === 'today') {
      const todayStr = new Date().toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).split('/').reverse().join('-')
      result = result.filter(a => a.start_time.split('T')[0] === todayStr && a.status !== 'cancelled')
    } else if (statusFilter === 'confirmed') {
      result = result.filter(a => a.status === 'confirmed' || a.status === 'pending')
    } else if (statusFilter === 'completed') {
      result = result.filter(a => a.status === 'completed')
    } else if (statusFilter === 'cancelled') {
      result = result.filter(a => a.status === 'cancelled' || a.status === 'no_show')
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
  }, [appointments, filterDate, statusFilter, searchQuery])

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
        walkInNotes
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

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background text-foreground">
        <DashboardSidebar />
        <main className="flex-1 p-8 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground mt-3 font-medium">Carregando agendamentos...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
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

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => loadData()}
              disabled={isPending}
              className="p-2.5 bg-secondary hover:bg-muted border border-border/80 text-foreground text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer"
              title="Atualizar lista"
            >
              <RefreshCw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
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

        {/* Interactive Metric Cards (Touch-friendly filters) */}
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
                className="w-full pl-8 pr-3 py-2 bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground/60 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {searchQuery && (
                <button
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
                className="w-full sm:w-auto px-3 py-2 bg-background border border-border text-xs text-foreground rounded-xl focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-medium"
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

        {/* ── MOBILE-FIRST RESPONSIVE CARDS LIST (ZERO HORIZONTAL SCROLL) ────────── */}
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
                      appt.status === 'completed'
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

                        {/* Status Badge */}
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-[10px] uppercase font-extrabold px-2.5 py-1 rounded-full border flex items-center gap-1 shrink-0 ${
                            appt.status === 'completed' 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                              : appt.status === 'cancelled'
                              ? 'bg-destructive/10 text-destructive border-destructive/30'
                              : appt.status === 'no_show'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : appt.status === 'confirmed'
                              ? 'bg-primary/10 text-primary border-primary/30'
                              : 'bg-amber-400/10 text-amber-400 border-amber-400/30 animate-pulse'
                          }`}>
                            {appt.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                            {appt.status === 'confirmed' && <CheckCircle className="w-3 h-3" />}
                            {appt.status === 'pending' && <Clock className="w-3 h-3" />}
                            {appt.status === 'completed' ? 'Concluído' : appt.status === 'cancelled' ? 'Cancelado' : appt.status === 'no_show' ? 'Não Compareceu' : appt.status === 'confirmed' ? 'Confirmado' : 'Pendente'}
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
                            ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                            : payMethod === 'pix'
                            ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                            : 'bg-muted text-muted-foreground border-border'
                        }`}>
                          {payMethod === 'cash' ? 'Dinheiro' : payMethod === 'card' ? 'Cartão' : payMethod === 'pix' ? 'Pix' : '—'}
                        </span>
                      </div>

                      {/* Internal Notes area */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Anotações Internas</span>
                        {editingNotesId === appt.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={notesContent}
                              onChange={(e) => setNotesContent(e.target.value)}
                              placeholder="Escreva anotações..."
                              className="p-2 text-xs bg-background border border-primary outline-none rounded-xl flex-grow text-foreground"
                            />
                            <button
                              onClick={() => handleSaveNotes(appt.id)}
                              disabled={isPending}
                              className="p-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90"
                            >
                              <Save className="w-4 h-4 text-primary-foreground" />
                            </button>
                            <button
                              onClick={() => setEditingNotesId(null)}
                              className="p-2 bg-secondary border border-border text-foreground rounded-xl"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between p-2.5 bg-secondary/20 rounded-xl border border-border/40 text-xs">
                            <span className="text-muted-foreground italic truncate max-w-[220px]">
                              {appt.notes || 'Sem anotações'}
                            </span>
                            <button
                              onClick={() => {
                                setEditingNotesId(appt.id)
                                setNotesContent(appt.notes || '')
                              }}
                              className="text-primary hover:text-primary/80 p-1 font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Editar</span>
                            </button>
                          </div>
                        )}
                      </div>

                    </div>

                    {/* ── TOUCH-FRIENDLY ACTION BUTTONS BAR (MOBILE FIRST) ────────── */}
                    <div className="pt-3 border-t border-border/40 flex flex-wrap items-center gap-2">
                      
                      {/* Confirmar button (For pending status) */}
                      {appt.status === 'pending' && (
                        <button
                          onClick={() => handleStatusUpdate(appt.id, 'confirmed')}
                          disabled={isPending}
                          className="flex-1 min-h-[44px] py-2.5 px-3 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                        >
                          <CheckCircle className="w-4 h-4 text-primary-foreground" />
                          <span>Confirmar</span>
                        </button>
                      )}

                      {/* Concluir button (For active bookings) */}
                      {appt.status !== 'completed' && appt.status !== 'cancelled' && appt.status !== 'no_show' && (
                        <button
                          onClick={() => handleStatusUpdate(appt.id, 'completed')}
                          disabled={isPending}
                          className="flex-1 min-h-[44px] py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Concluir Corte</span>
                        </button>
                      )}

                      {/* Cancelar button */}
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

                      {/* Não Compareceu button (only for cash/card presencial payments) */}
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

                      {/* Admin Permanent Delete button */}
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

        {/* Walk-in Modal overlay */}
        {showWalkInModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card border border-border/80 rounded-2xl p-6 sm:p-8 max-w-md w-full space-y-5 relative shadow-2xl max-h-[90vh] overflow-y-auto">
              
              <div className="flex justify-between items-center pb-3 border-b border-border/40">
                <h3 className="font-serif font-bold text-lg text-foreground flex items-center gap-2">
                  <Scissors className="w-5 h-5 text-primary rotate-45" /> Agendar Presencial (Walk-in)
                </h3>
                <button
                  onClick={() => setShowWalkInModal(false)}
                  className="text-muted-foreground hover:text-foreground p-1.5 hover:bg-secondary rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

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
                      className="w-full pl-10 pr-4 py-2.5 bg-secondary/50 border border-border focus:border-primary rounded-xl text-xs outline-none text-foreground"
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
                    className="w-full px-3.5 py-2.5 bg-secondary/50 border border-border focus:border-primary rounded-xl text-xs text-foreground outline-none cursor-pointer"
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
                    className="w-full px-3.5 py-2.5 bg-secondary/50 border border-border focus:border-primary rounded-xl text-xs text-foreground outline-none cursor-pointer"
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
                    className="w-full px-3 py-2.5 bg-secondary/50 border border-border focus:border-primary rounded-xl text-xs text-foreground outline-none cursor-pointer"
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
                      className="w-full px-3.5 py-2.5 bg-secondary/50 border border-border focus:border-primary rounded-xl text-xs text-foreground outline-none cursor-pointer"
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
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
