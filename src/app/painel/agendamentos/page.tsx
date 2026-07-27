'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Scissors, Calendar, Clock, Search, Edit2, Trash2, CheckCircle2, 
  AlertCircle, Plus, Loader2, Save, X, User, Sparkles, Check, AlertTriangle, UserX
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
  const [filterDate, setFilterDate] = useState(() => {
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  })

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
      
      // If barber, filter by ownership (unless admin)
      if (profile.role === 'barber') {
        query = query.eq('barber_id', session.user.id)
      }

      const { data: appts } = await query.order('start_time', { ascending: true })

      if (appts && appts.length > 0) {
        // Load profiles to map names of customers and barbers
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
            // Extract from notes
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
      console.error('Error loading dashboard appointments:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filter logic
  useEffect(() => {
    let result = appointments

    // Filter by Date
    if (filterDate) {
      result = result.filter(a => a.start_time.split('T')[0] === filterDate)
    }

    // Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(a => 
        a.customerName.toLowerCase().includes(q) || 
        (a.notes && a.notes.toLowerCase().includes(q)) ||
        (a.services?.name && a.services.name.toLowerCase().includes(q))
      )
    }

    setFilteredAppointments(result)
  }, [appointments, filterDate, searchQuery])

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
        
        // Reset form
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

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    } catch (e) {
      return '--:--'
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      const formatter = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
      const parts = formatter.formatToParts(d)
      const day = parts.find(p => p.type === 'day')?.value || ''
      const month = parts.find(p => p.type === 'month')?.value || ''
      const year = parts.find(p => p.type === 'year')?.value || ''
      
      const currentYear = new Date().toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric'
      })

      if (year && currentYear && year !== currentYear) {
        return `${day}/${month}/${year}`
      }
      return `${day}/${month}`
    } catch (e) {
      return '--/--'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col md:flex-row justify-center items-center gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Carregando painel de agendamentos...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <DashboardSidebar />

      <main className="flex-grow p-6 sm:p-8 space-y-6 overflow-y-auto">
        
        {/* Title & Top button */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/40 pb-4">
          <div>
            <h1 className="text-2xl font-serif font-bold text-foreground">Gerenciar Agendamentos</h1>
            <p className="text-xs text-muted-foreground">Pesquise, registre novos clientes presenciais e controle a agenda</p>
          </div>
          <button
            onClick={() => setShowWalkInModal(true)}
            className="w-full sm:w-auto px-4 py-2.5 bg-primary hover:bg-primary-hover text-primary-foreground font-bold rounded text-xs flex items-center justify-center gap-1.5 shadow"
          >
            <Plus className="w-4 h-4 text-primary-foreground" />
            Novo Agendamento Presencial
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded flex items-start gap-2 text-xs text-destructive">
            <AlertCircle className="w-4.5 h-4.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded flex items-start gap-2 text-xs text-emerald-500">
            <CheckCircle2 className="w-4.5 h-4.5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Filter controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-secondary/15 p-4 rounded-lg border border-border/60">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por cliente, notas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-secondary border border-border focus:border-primary rounded text-xs outline-none"
            />
          </div>

          {/* Date Picker filter */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-secondary border border-border focus:border-primary rounded text-xs outline-none text-foreground"
            />
          </div>

          {/* Quick Clear filter button */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setFilterDate('')
                setSearchQuery('')
              }}
              className="px-3 py-2 bg-secondary border border-border hover:bg-muted text-foreground text-xs font-semibold rounded w-full"
            >
              Limpar Filtros
            </button>
          </div>
        </div>

        {/* Table of bookings */}
        <div className="glass rounded-lg border border-border overflow-x-auto shadow">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-secondary/40 border-b border-border/60 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                <th className="p-4">Data / Hora</th>
                <th className="p-4">Cliente</th>
                <th className="p-4">Serviço</th>
                {userRole === 'admin' && <th className="p-4">Profissional</th>}
                <th className="p-4">Preço</th>
                <th className="p-4">Forma Pagto</th>
                <th className="p-4">Status</th>
                <th className="p-4">Anotações Internas</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-xs">
              {filteredAppointments.length > 0 ? (
                filteredAppointments
                  .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                  .map((appt) => {
                    const payMethod = Array.isArray(appt.payments) ? appt.payments[0]?.method : appt.payments?.method

                    return (
                    <tr key={appt.id} className="hover:bg-secondary/15 transition-colors">
                      <td className="p-4 whitespace-nowrap font-semibold">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] text-muted-foreground font-normal">
                            {formatDate(appt.start_time)}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-foreground font-bold">
                            <Clock className="w-3 h-3 text-primary shrink-0" />
                            {formatTime(appt.start_time)}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-foreground">{appt.customerName}</span>
                          <span className="font-mono text-[10px] text-primary/70 tracking-widest font-semibold">
                            {apptShortCode(appt.id)}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {appt.services?.name}
                          {appt.package_subscription_id && (
                            <span className="text-[8px] uppercase font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/25 tracking-wider">
                              Pacote
                            </span>
                          )}
                        </div>
                      </td>
                      {userRole === 'admin' && (
                        <td className="p-4 whitespace-nowrap text-muted-foreground">
                          {appt.barberName}
                        </td>
                      )}
                      <td className="p-4 whitespace-nowrap font-mono text-primary font-bold">
                        R$ {Number(appt.services?.price || 0).toFixed(2)}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${
                          payMethod === 'cash'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : payMethod === 'card'
                            ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                            : payMethod === 'pix'
                            ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                            : 'bg-muted text-muted-foreground border border-border'
                        }`}>
                          {payMethod === 'cash' ? 'Dinheiro' : payMethod === 'card' ? 'Cartão' : payMethod === 'pix' ? 'Pix' : '—'}
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                        <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${
                          appt.status === 'completed' 
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                            : appt.status === 'cancelled'
                            ? 'bg-destructive/10 text-destructive border border-destructive/20'
                            : appt.status === 'no_show'
                            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                            : appt.status === 'confirmed'
                            ? 'bg-primary/10 text-primary border border-primary/20'
                            : 'bg-muted text-muted-foreground border border-border'
                        }`}>
                          {appt.status === 'completed' ? 'Concluído' : appt.status === 'cancelled' ? 'Cancelado' : appt.status === 'no_show' ? 'Não Compareceu' : appt.status === 'confirmed' ? 'Confirmado' : 'Pendente'}
                        </span>
                        {appt.no_show_fee_charged && (
                          <span className="text-[8px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 tracking-wider inline-block w-fit">
                            Taxa Cobrada ✓
                          </span>
                        )}
                        </div>
                      </td>
                      <td className="p-4">
                        {editingNotesId === appt.id ? (
                          <div className="flex gap-1.5 max-w-[200px]">
                            <input
                              type="text"
                              value={notesContent}
                              onChange={(e) => setNotesContent(e.target.value)}
                              className="p-1 text-xs bg-secondary border border-border outline-none rounded flex-grow"
                            />
                            <button
                              onClick={() => handleSaveNotes(appt.id)}
                              disabled={isPending}
                              className="p-1 bg-primary text-primary-foreground rounded hover:bg-primary-hover"
                            >
                              <Save className="w-3 h-3 text-primary-foreground" />
                            </button>
                            <button
                              onClick={() => setEditingNotesId(null)}
                              className="p-1 bg-secondary border border-border text-foreground rounded hover:bg-muted"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 group max-w-[250px]">
                            <span className="truncate block text-muted-foreground select-none">
                              {appt.notes || 'Sem anotações'}
                            </span>
                            <button
                              onClick={() => {
                                setEditingNotesId(appt.id)
                                setNotesContent(appt.notes || '')
                              }}
                              className="p-1 text-primary opacity-0 group-hover:opacity-100 hover:bg-secondary rounded transition-all cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-right whitespace-nowrap space-x-1">
                        {appt.status !== 'completed' && appt.status !== 'cancelled' && appt.status !== 'no_show' && (
                          <>
                            <button
                              onClick={() => handleStatusUpdate(appt.id, 'completed')}
                              disabled={isPending}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-semibold cursor-pointer"
                            >
                              Concluir
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(appt.id, 'cancelled')}
                              disabled={isPending}
                              className="px-2 py-1 bg-destructive/10 hover:bg-destructive/20 border border-destructive/20 text-destructive rounded text-[10px] font-semibold cursor-pointer"
                            >
                              Cancelar
                            </button>
                            {/* No-show button — only for cash/card presencial payments */}
                            {(payMethod === 'cash' || payMethod === 'card') && (
                              <button
                                onClick={() => setNoShowTarget(appt)}
                                disabled={isPending}
                                title="Marcar como não compareceu"
                                className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-500 rounded text-[10px] font-semibold cursor-pointer"
                              >
                                Não Compareceu
                              </button>
                            )}
                          </>
                        )}
                        {appt.status === 'pending' && (
                          <button
                            onClick={() => handleStatusUpdate(appt.id, 'confirmed')}
                            disabled={isPending}
                            className="px-2 py-1 bg-primary hover:bg-primary-hover text-primary-foreground rounded text-[10px] font-semibold cursor-pointer"
                          >
                            Confirmar
                          </button>
                        )}
                        {/* Admin-only permanent delete */}
                        {userRole === 'admin' && (
                          <button
                            onClick={() => handleDelete(appt)}
                            disabled={isPending}
                            title="Excluir permanentemente"
                            className="p-1 bg-red-900/20 hover:bg-red-900/40 border border-red-800/40 text-red-400 hover:text-red-300 rounded cursor-pointer transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={userRole === 'admin' ? 9 : 8} className="p-8 text-center text-muted-foreground italic">
                    Nenhum agendamento encontrado nesta data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Delete Confirmation Modal (admin only) ──────────────────────── */}
        {deleteTarget && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="glass p-6 sm:p-8 rounded-lg border border-red-800/50 max-w-md w-full shadow-2xl space-y-5 relative">
              
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-red-900/30 border border-red-800/40 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-foreground">Excluir Agendamento</h3>
                  <p className="text-[11px] text-red-400 font-semibold mt-0.5">Esta ação é permanente e irreversível</p>
                </div>
              </div>

              {/* Warning text */}
              <div className="p-4 bg-red-900/10 border border-red-800/30 rounded-lg space-y-2 text-xs text-muted-foreground leading-relaxed">
                <p>
                  Você está prestes a <strong className="text-red-400">excluir permanentemente</strong> este agendamento.
                  Ao contrário de "Cancelar" (que apenas altera o status), a exclusão remove o registro do banco de dados completamente.
                </p>
                <p>
                  O agendamento <strong className="text-foreground">desaparecerá</strong> tanto do painel administrativo quanto do histórico de agendamentos do cliente em sua conta. O registro de pagamento vinculado também será deletado.
                </p>
                <p className="font-semibold text-red-400">Esta operação não pode ser desfeita.</p>
              </div>

              {/* Appointment details */}
              <div className="bg-secondary/40 border border-border/50 rounded-lg p-4 space-y-2 text-xs">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">Agendamento a excluir</p>
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
                {userRole === 'admin' && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Profissional:</span>
                    <span className="font-semibold text-foreground">{deleteTarget.barberName}</span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isPending}
                  className="flex-1 px-4 py-2.5 bg-secondary hover:bg-muted border border-border text-foreground rounded text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isPending}
                  className="flex-1 px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Excluindo...</>
                  ) : (
                    <><Trash2 className="w-3.5 h-3.5" /> Sim, excluir permanentemente</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── No-Show Confirmation Modal ──────────────────────── */}
        {noShowTarget && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="glass p-6 sm:p-8 rounded-lg border border-amber-700/50 max-w-md w-full shadow-2xl space-y-5 relative">
              
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <UserX className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-foreground">Marcar como Não Compareceu</h3>
                  <p className="text-[11px] text-amber-500 font-semibold mt-0.5">Taxa de 50% será aplicada ao próximo agendamento</p>
                </div>
              </div>

              {/* Warning text */}
              <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg space-y-2 text-xs text-muted-foreground leading-relaxed">
                <p>
                  Ao marcar este agendamento como <strong className="text-amber-500">não compareceu</strong>, o cliente
                  receberá uma <strong className="text-foreground">taxa de 50% do valor do serviço</strong> somada automaticamente
                  ao total do seu próximo agendamento.
                </p>
                <p>
                  A taxa só será considerada quitada quando o próximo atendimento for concluído ou o pagamento for confirmado.
                </p>
              </div>

              {/* Appointment details */}
              <div className="bg-secondary/40 border border-border/50 rounded-lg p-4 space-y-2 text-xs">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">Agendamento</p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente:</span>
                  <span className="font-semibold text-foreground">{noShowTarget.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Serviço:</span>
                  <span className="font-semibold text-foreground">{noShowTarget.services?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data / Hora:</span>
                  <span className="font-semibold text-foreground">
                    {formatDate(noShowTarget.start_time)} às {formatTime(noShowTarget.start_time)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border/40 pt-2">
                  <span className="text-muted-foreground">Taxa a cobrar (50%):</span>
                  <span className="font-bold text-amber-500">R$ {(Number(noShowTarget.services?.price || 0) * 0.5).toFixed(2)}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setNoShowTarget(null)}
                  disabled={isPending}
                  className="flex-1 px-4 py-2.5 bg-secondary hover:bg-muted border border-border text-foreground rounded text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmNoShow}
                  disabled={isPending}
                  className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processando...</>
                  ) : (
                    <><UserX className="w-3.5 h-3.5" /> Confirmar Não Compareceu</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Walk-in Modal overlay */}
        {showWalkInModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="glass p-6 sm:p-8 rounded-lg border border-border max-w-md w-full shadow-2xl space-y-5 relative animate-in zoom-in-95 duration-200">
              
              <div className="flex justify-between items-center pb-2 border-b border-border/40">
                <h3 className="font-serif font-bold text-lg text-foreground flex items-center gap-1.5">
                  <Scissors className="w-5 h-5 text-primary rotate-45" /> Agendar Presencial (Walk-in)
                </h3>
                <button
                  onClick={() => setShowWalkInModal(false)}
                  className="text-muted-foreground hover:text-foreground p-1 hover:bg-secondary rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateWalkIn} className="space-y-4">
                {/* Client Name */}
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
                      className="w-full pl-10 pr-4 py-2 bg-secondary border border-border focus:border-primary rounded text-xs outline-none"
                      required
                    />
                  </div>
                </div>

                {/* Barber Selector */}
                <div className="space-y-1.5">
                  <label htmlFor="wBarber" className="text-xs font-semibold text-muted-foreground uppercase">Barbeiro</label>
                  <select
                    id="wBarber"
                    value={selectedBarberId}
                    onChange={(e) => setSelectedBarberId(e.target.value)}
                    disabled={isPending}
                    className="w-full px-3 py-2 bg-secondary border border-border focus:border-primary rounded text-xs text-foreground outline-none cursor-pointer"
                    required
                  >
                    <option value="">Selecione o profissional</option>
                    {barbers.map(b => (
                      <option key={b.id} value={b.id}>{b.full_name}</option>
                    ))}
                  </select>
                </div>

                {/* Service Selector */}
                <div className="space-y-1.5">
                  <label htmlFor="wService" className="text-xs font-semibold text-muted-foreground uppercase">Serviço</label>
                  <select
                    id="wService"
                    value={selectedServiceId}
                    onChange={(e) => setSelectedServiceId(e.target.value)}
                    disabled={isPending}
                    className="w-full px-3 py-2 bg-secondary border border-border focus:border-primary rounded text-xs text-foreground outline-none cursor-pointer"
                    required
                  >
                    <option value="">Selecione o serviço</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>{s.name} - R$ {Number(s.price).toFixed(2)} ({s.duration}min)</option>
                    ))}
                  </select>
                </div>

                {/* Date */}
                <div className="space-y-1.5">
                  <label htmlFor="wDate" className="text-xs font-semibold text-muted-foreground uppercase">Data</label>
                  <input
                    id="wDate"
                    type="date"
                    value={walkInDate}
                    onChange={(e) => setWalkInDate(e.target.value)}
                    disabled={isPending}
                    className="w-full px-3 py-2 bg-secondary border border-border focus:border-primary rounded text-xs text-foreground outline-none"
                    required
                  />
                </div>

                {/* Time slot picker */}
                <div className="space-y-1.5">
                  <label htmlFor="wTime" className="text-xs font-semibold text-muted-foreground uppercase">Horários Disponíveis</label>
                  {loadingSlots ? (
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground py-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> Carregando horários livres...
                    </div>
                  ) : availableSlots.length > 0 ? (
                    <select
                      id="wTime"
                      value={walkInTime}
                      onChange={(e) => setWalkInTime(e.target.value)}
                      disabled={isPending}
                      className="w-full px-3 py-2 bg-secondary border border-border focus:border-primary rounded text-xs text-foreground outline-none cursor-pointer"
                      required
                    >
                      <option value="">Escolha um horário livre</option>
                      {availableSlots.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-[10px] text-muted-foreground italic bg-secondary p-2 rounded border border-border">
                      Selecione barbeiro, serviço e data para carregar horários disponíveis.
                    </p>
                  )}
                </div>

                {/* Private note */}
                <div className="space-y-1.5">
                  <label htmlFor="wNotes" className="text-xs font-semibold text-muted-foreground uppercase">Observações Extras</label>
                  <textarea
                    id="wNotes"
                    placeholder="Ex: Cabelo curto, prefere navalha..."
                    value={walkInNotes}
                    onChange={(e) => setWalkInNotes(e.target.value)}
                    disabled={isPending}
                    rows={2}
                    className="w-full p-3 bg-secondary border border-border focus:border-primary rounded text-xs text-foreground placeholder:text-muted-foreground outline-none resize-none"
                  />
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isPending || (availableSlots.length > 0 && !walkInTime)}
                  className="w-full py-3 bg-primary hover:bg-primary-hover text-primary-foreground font-bold rounded text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-primary-foreground" />
                      Registrando Agendamento...
                    </>
                  ) : (
                    <>
                      Confirmar Agendamento Presencial
                      <Check className="w-4 h-4 text-primary-foreground" />
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
