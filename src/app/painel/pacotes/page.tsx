'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Package, Plus, Loader2, Search, X, Check, AlertCircle,
  CheckCircle2, Calendar, Clock, User, Scissors, Trash2,
  AlertTriangle, ChevronDown, Crown
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { DashboardSidebar } from '@/components/DashboardSidebar'
import {
  createPackageAction,
  cancelPackageAction,
  validatePackageSlotsAction,
  markPackageAsPaidAction,
  deletePackageAction
} from './actions'

const WEEKDAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function PainelPacotes() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)

  // Data
  const [packages, setPackages] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [barbers, setBarbers] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)

  // Form state
  const [customerId, setCustomerId] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [barberId, setBarberId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState<number>(3) // Wednesday default
  const [timeSlot, setTimeSlot] = useState('')
  const [startDate, setStartDate] = useState('')
  const [packagePrice, setPackagePrice] = useState('')
  const [totalSessions, setTotalSessions] = useState(4)

  // Slots
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Validation preview
  const [validationResult, setValidationResult] = useState<Array<{ date: string; available: boolean }>>([])
  const [loadingValidation, setLoadingValidation] = useState(false)

  // Messages
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isPending, startTransition] = useTransition()

  const supabase = createClient()

  // ──── Load initial data ────────────────────────────────
  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/entrar'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (!profile || profile.role !== 'admin') { router.push('/painel'); return }
      setUserRole(profile.role)

      // Fetch customers (role = customer or null/empty role for regular users)
      const { data: dbCustomers } = await supabase
        .from('profiles')
        .select('id, full_name, phone, role')
        .or('role.eq.customer,role.is.null')
        .order('full_name')
      setCustomers(dbCustomers || [])

      // Fetch barbers
      const { data: dbBarbers } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['barber', 'admin'])
      setBarbers(dbBarbers || [])

      // Fetch active services
      const { data: dbServices } = await supabase
        .from('services')
        .select('id, name, price, duration')
        .eq('is_active', true)
      setServices(dbServices || [])

      // Fetch packages with linked appointments
      const { data: dbPackages } = await supabase
        .from('package_subscriptions')
        .select(`
          id,
          customer_id,
          barber_id,
          service_id,
          day_of_week,
          time_slot,
          start_date,
          total_sessions,
          package_price,
          status,
          payment_status,
          created_at
        `)
        .order('created_at', { ascending: false })

      if (dbPackages && dbPackages.length > 0) {
        // Enrich with names
        const allIds = new Set<string>()
        dbPackages.forEach(p => { allIds.add(p.customer_id); allIds.add(p.barber_id) })

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', Array.from(allIds))

        const nameMap: Record<string, string> = {}
        profiles?.forEach(p => { nameMap[p.id] = p.full_name })

        const serviceIds = Array.from(new Set(dbPackages.map(p => p.service_id)))
        const { data: svcData } = await supabase
          .from('services')
          .select('id, name')
          .in('id', serviceIds)

        const svcMap: Record<string, string> = {}
        svcData?.forEach(s => { svcMap[s.id] = s.name })

        // Fetch appointments linked to these packages
        const pkgIds = dbPackages.map(p => p.id)
        const { data: linkedAppts } = await supabase
          .from('appointments')
          .select('id, package_subscription_id, status, start_time')
          .in('package_subscription_id', pkgIds)

        const apptsByPkg: Record<string, any[]> = {}
        linkedAppts?.forEach(a => {
          if (!apptsByPkg[a.package_subscription_id]) apptsByPkg[a.package_subscription_id] = []
          apptsByPkg[a.package_subscription_id].push(a)
        })

        const enriched = dbPackages.map(p => ({
          ...p,
          customerName: nameMap[p.customer_id] || 'Cliente',
          barberName: nameMap[p.barber_id] || 'Barbeiro',
          serviceName: svcMap[p.service_id] || 'Serviço',
          appointments: apptsByPkg[p.id] || [],
          completedSessions: (apptsByPkg[p.id] || []).filter((a: any) => a.status === 'completed').length,
          cancelledSessions: (apptsByPkg[p.id] || []).filter((a: any) => a.status === 'cancelled').length,
        }))
        setPackages(enriched)
      } else {
        setPackages([])
      }
    } catch (err) {
      console.error('Error loading packages data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // ──── Auto-compute start date when dayOfWeek changes ────
  useEffect(() => {
    if (dayOfWeek === undefined || dayOfWeek === null) return
    const today = new Date()
    const todayDow = today.getDay()
    let daysAhead = dayOfWeek - todayDow
    if (daysAhead <= 0) daysAhead += 7
    const nextDate = new Date(today)
    nextDate.setDate(today.getDate() + daysAhead)
    const y = nextDate.getFullYear()
    const m = String(nextDate.getMonth() + 1).padStart(2, '0')
    const d = String(nextDate.getDate()).padStart(2, '0')
    setStartDate(`${y}-${m}-${d}`)
  }, [dayOfWeek])

  // ──── Load available slots when barber + service + date change ────
  useEffect(() => {
    if (!barberId || !serviceId || !startDate) {
      setAvailableSlots([])
      return
    }

    async function loadSlots() {
      setLoadingSlots(true)
      setTimeSlot('')
      const service = services.find(s => s.id === serviceId)
      const duration = service?.duration || 60

      try {
        const res = await fetch(`/api/booking/slots?barberId=${barberId}&dateStr=${startDate}&duration=${duration}`)
        const data = await res.json()
        setAvailableSlots(data.slots || [])
      } catch (error) {
        console.error('Error fetching slots:', error)
      } finally {
        setLoadingSlots(false)
      }
    }
    loadSlots()
  }, [barberId, serviceId, startDate, services])

  // ──── Auto-fill package price when barber + service + sessions change ────
  useEffect(() => {
    if (!barberId || !serviceId) return

    async function fetchBarberPrice() {
      const { data: bs } = await supabase
        .from('barber_services')
        .select('price')
        .eq('barber_id', barberId)
        .eq('service_id', serviceId)
        .single()

      if (bs) {
        const regularTotal = Number(bs.price) * totalSessions
        const discount = 20
        const suggestedPrice = Math.max(regularTotal - discount, 0)
        setPackagePrice(suggestedPrice.toFixed(2))
      } else {
        // Fallback to base service price
        const service = services.find(s => s.id === serviceId)
        if (service) {
          const regularTotal = Number(service.price) * totalSessions
          const discount = 20
          setPackagePrice(Math.max(regularTotal - discount, 0).toFixed(2))
        }
      }
    }
    fetchBarberPrice()
  }, [barberId, serviceId, totalSessions, services])

  // ──── Validate all slots when time + sessions change ────
  useEffect(() => {
    if (!barberId || !serviceId || !timeSlot || !startDate || !totalSessions) {
      setValidationResult([])
      return
    }

    setLoadingValidation(true)
    startTransition(async () => {
      const result = await validatePackageSlotsAction(barberId, serviceId, timeSlot, startDate, totalSessions)
      setValidationResult(result.dates)
      setLoadingValidation(false)
    })
  }, [barberId, serviceId, timeSlot, startDate, totalSessions])

  // ──── Filtered customers for searchable dropdown ────
  const filteredCustomers = customers.filter(c => {
    if (!customerSearch) return true
    const q = customerSearch.toLowerCase()
    return c.full_name?.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q)
  }).slice(0, 15) // Limit dropdown results

  // ──── Handlers ────────────────────────────────────────
  const handleCreatePackage = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!customerId || !barberId || !serviceId || !timeSlot || !startDate || !packagePrice) {
      setErrorMsg('Todos os campos são obrigatórios.')
      return
    }

    const hasConflict = validationResult.some(r => !r.available)
    if (hasConflict) {
      setErrorMsg('Existem conflitos de horário. Resolva antes de criar o pacote.')
      return
    }

    startTransition(async () => {
      const res = await createPackageAction(
        customerId, barberId, serviceId, dayOfWeek, timeSlot,
        startDate, parseFloat(packagePrice), totalSessions
      )

      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg(res.message)
        setShowModal(false)
        resetForm()
        loadData()
      }
    })
  }

  const handleCancelPackage = () => {
    if (!cancelTarget) return
    setErrorMsg('')
    setSuccessMsg('')

    startTransition(async () => {
      const res = await cancelPackageAction(cancelTarget.id)
      setCancelTarget(null)
      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg(res.message)
        loadData()
      }
    })
  }

  const handleMarkAsPaid = (packageId: string) => {
    setErrorMsg('')
    setSuccessMsg('')

    startTransition(async () => {
      const res = await markPackageAsPaidAction(packageId)
      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg(res.message)
        loadData()
      }
    })
  }

  const handleDeletePackage = () => {
    if (!deleteTarget) return
    setErrorMsg('')
    setSuccessMsg('')

    startTransition(async () => {
      const res = await deletePackageAction(deleteTarget.id)
      setDeleteTarget(null)
      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg(res.message)
        loadData()
      }
    })
  }

  const resetForm = () => {
    setCustomerId('')
    setCustomerSearch('')
    setBarberId('')
    setServiceId('')
    setDayOfWeek(3)
    setTimeSlot('')
    setStartDate('')
    setPackagePrice('')
    setTotalSessions(4)
    setValidationResult([])
  }

  const formatDatePt = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-')
    return `${d}/${m}/${y}`
  }

  // ──── Render ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col md:flex-row justify-center items-center gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Carregando pacotes mensais...</p>
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
            <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
              <Crown className="w-6 h-6 text-primary" />
              Pacotes Mensais
            </h1>
            <p className="text-xs text-muted-foreground">Gerencie pacotes recorrentes com dia e horário fixos para seus clientes</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowModal(true) }}
            className="w-full sm:w-auto px-4 py-2.5 bg-primary hover:bg-primary-hover text-primary-foreground font-bold rounded text-xs flex items-center justify-center gap-1.5 shadow cursor-pointer"
          >
            <Plus className="w-4 h-4 text-primary-foreground" />
            Novo Pacote
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

        {/* ── Packages List ──────────────────────────────────── */}
        {packages.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {packages.map((pkg) => {
              const remaining = pkg.total_sessions - pkg.completedSessions - pkg.cancelledSessions
              const progressPct = Math.round((pkg.completedSessions / pkg.total_sessions) * 100)

              return (
                <div
                  key={pkg.id}
                  className="glass p-5 rounded-lg border border-border hover:border-primary/30 transition-all space-y-4"
                >
                  {/* Header */}
                  <div className="flex justify-between items-start gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-serif font-bold text-sm text-foreground">{pkg.customerName}</span>
                        <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${
                          pkg.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                            : pkg.status === 'completed'
                            ? 'bg-primary/10 text-primary border border-primary/20'
                            : 'bg-destructive/10 text-destructive border border-destructive/20'
                        }`}>
                          {pkg.status === 'active' ? 'Ativo' : pkg.status === 'completed' ? 'Concluído' : 'Cancelado'}
                        </span>
                        <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${
                          pkg.payment_status === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                            : pkg.payment_status === 'cancelled'
                            ? 'bg-destructive/10 text-destructive border border-destructive/20'
                            : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                        }`}>
                          {pkg.payment_status === 'paid' ? 'Pago' : pkg.payment_status === 'cancelled' ? 'Cancelado' : 'Pendente'}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {pkg.serviceName} com {pkg.barberName}
                      </p>
                    </div>
                  </div>

                  {/* Schedule summary */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      Toda {WEEKDAY_SHORT[pkg.day_of_week]}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      {pkg.time_slot}
                    </span>
                    <span className="font-mono font-bold text-primary">
                      R$ {Number(pkg.package_price).toFixed(2)}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{pkg.completedSessions} de {pkg.total_sessions} sessões concluídas</span>
                      <span>{remaining > 0 ? `${remaining} restante(s)` : 'Completo'}</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Session dates mini list */}
                  <div className="flex flex-wrap gap-1.5">
                    {pkg.appointments
                      .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                      .map((appt: any) => {
                        const d = new Date(appt.start_time)
                        const dateLabel = d.toLocaleDateString('pt-BR', {
                          timeZone: 'America/Sao_Paulo',
                          day: '2-digit', month: '2-digit'
                        })
                        return (
                          <span
                            key={appt.id}
                            className={`text-[9px] font-semibold px-2 py-0.5 rounded border ${
                              appt.status === 'completed'
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                : appt.status === 'cancelled'
                                ? 'bg-destructive/10 text-destructive border-destructive/20 line-through'
                                : 'bg-primary/10 text-primary border-primary/20'
                            }`}
                          >
                            {dateLabel}
                          </span>
                        )
                      })}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 justify-between border-t border-border/40 pt-3 mt-1">
                    <div>
                      {pkg.payment_status === 'pending' && pkg.status === 'active' && (
                        <button
                          onClick={() => handleMarkAsPaid(pkg.id)}
                          disabled={isPending}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold cursor-pointer transition-all"
                        >
                          Marcar como Pago
                        </button>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      {pkg.status === 'active' && (
                        <button
                          onClick={() => setCancelTarget(pkg)}
                          disabled={isPending}
                          className="px-2.5 py-1.5 bg-destructive/10 hover:bg-destructive/20 border border-destructive/20 text-destructive rounded text-[10px] font-bold cursor-pointer transition-all"
                        >
                          Cancelar
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteTarget(pkg)}
                        disabled={isPending}
                        className="p-1.5 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 text-red-400 hover:text-red-300 rounded cursor-pointer transition-all"
                        title="Excluir permanentemente"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="p-12 bg-secondary/20 rounded-lg border border-border text-center space-y-3">
            <Package className="w-10 h-10 text-muted-foreground mx-auto opacity-40" />
            <p className="text-xs text-muted-foreground">Nenhum pacote mensal registrado ainda.</p>
            <button
              onClick={() => { resetForm(); setShowModal(true) }}
              className="text-primary font-semibold text-xs hover:underline cursor-pointer"
            >
              Criar primeiro pacote →
            </button>
          </div>
        )}

        {/* ── Cancel Confirmation Modal ──────────────────────── */}
        {cancelTarget && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="glass p-6 sm:p-8 rounded-lg border border-red-800/50 max-w-md w-full shadow-2xl space-y-5 relative">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-red-900/30 border border-red-800/40 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-foreground">Cancelar Pacote</h3>
                  <p className="text-[11px] text-red-400 font-semibold mt-0.5">Os agendamentos futuros serão cancelados</p>
                </div>
              </div>

              <div className="p-4 bg-red-900/10 border border-red-800/30 rounded-lg space-y-2 text-xs text-muted-foreground leading-relaxed">
                <p>
                  O pacote de <strong className="text-foreground">{cancelTarget.customerName}</strong> será cancelado.
                  Agendamentos <strong className="text-red-400">futuros</strong> vinculados ao pacote serão cancelados automaticamente.
                  Sessões já concluídas serão mantidas no histórico.
                </p>
              </div>

              <div className="bg-secondary/40 border border-border/50 rounded-lg p-4 space-y-2 text-xs">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">Pacote a cancelar</p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente:</span>
                  <span className="font-semibold text-foreground">{cancelTarget.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Serviço:</span>
                  <span className="font-semibold text-foreground">{cancelTarget.serviceName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Agenda:</span>
                  <span className="font-semibold text-foreground">
                    {WEEKDAY_SHORT[cancelTarget.day_of_week]} às {cancelTarget.time_slot}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setCancelTarget(null)}
                  disabled={isPending}
                  className="flex-1 px-4 py-2.5 bg-secondary hover:bg-muted border border-border text-foreground rounded text-xs font-semibold transition-all cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleCancelPackage}
                  disabled={isPending}
                  className="flex-1 px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isPending ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Cancelando...</>
                  ) : (
                    <><Trash2 className="w-3.5 h-3.5" /> Sim, cancelar pacote</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Delete Confirmation Modal (permanent delete) ──────── */}
        {deleteTarget && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="glass p-6 sm:p-8 rounded-lg border border-red-800/50 max-w-md w-full shadow-2xl space-y-5 relative">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-red-900/30 border border-red-800/40 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-foreground">Excluir Pacote</h3>
                  <p className="text-[11px] text-red-400 font-semibold mt-0.5">Ação permanente e irreversível</p>
                </div>
              </div>

              <div className="p-4 bg-red-900/10 border border-red-800/30 rounded-lg space-y-2 text-xs text-muted-foreground leading-relaxed">
                <p>
                  Você está prestes a <strong className="text-red-400">excluir permanentemente</strong> este pacote.
                  Esta ação excluirá o registro do pacote, <strong className="text-red-400">todos os seus agendamentos</strong> (passados e futuros), e seus históricos de pagamentos vinculados.
                </p>
                <p className="font-semibold text-red-400">Esta operação não pode ser desfeita. Sumirá do painel e do cliente.</p>
              </div>

              <div className="bg-secondary/40 border border-border/50 rounded-lg p-4 space-y-2 text-xs">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">Pacote a excluir</p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente:</span>
                  <span className="font-semibold text-foreground">{deleteTarget.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Serviço:</span>
                  <span className="font-semibold text-foreground">{deleteTarget.serviceName}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isPending}
                  className="flex-1 px-4 py-2.5 bg-secondary hover:bg-muted border border-border text-foreground rounded text-xs font-semibold transition-all cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleDeletePackage}
                  disabled={isPending}
                  className="flex-1 px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
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

        {/* ── Create Package Modal ───────────────────────────── */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="glass p-6 sm:p-8 rounded-lg border border-border max-w-lg w-full shadow-2xl space-y-5 relative max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center pb-2 border-b border-border/40">
                <h3 className="font-serif font-bold text-lg text-foreground flex items-center gap-1.5">
                  <Crown className="w-5 h-5 text-primary" /> Novo Pacote Mensal
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-muted-foreground hover:text-foreground p-1 hover:bg-secondary rounded cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreatePackage} className="space-y-4">
                {/* Customer search */}
                <div className="space-y-1.5 relative">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Cliente</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Buscar cliente por nome ou telefone..."
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value)
                        setShowCustomerDropdown(true)
                        if (!e.target.value) setCustomerId('')
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      className="w-full pl-10 pr-4 py-2 bg-secondary border border-border focus:border-primary rounded text-xs outline-none"
                    />
                    {customerId && (
                      <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                    )}
                  </div>

                  {showCustomerDropdown && customerSearch && filteredCustomers.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-xl max-h-40 overflow-y-auto">
                      {filteredCustomers.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setCustomerId(c.id)
                            setCustomerSearch(c.full_name)
                            setShowCustomerDropdown(false)
                          }}
                          className={`w-full text-left px-4 py-2 text-xs hover:bg-secondary transition-colors cursor-pointer ${
                            customerId === c.id ? 'bg-primary/10 text-primary' : 'text-foreground'
                          }`}
                        >
                          <span className="font-semibold">{c.full_name}</span>
                          {c.phone && <span className="text-muted-foreground ml-2">· {c.phone}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Barber */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Barbeiro</label>
                  <select
                    value={barberId}
                    onChange={(e) => setBarberId(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary border border-border focus:border-primary rounded text-xs text-foreground outline-none cursor-pointer"
                    required
                  >
                    <option value="">Selecione o profissional</option>
                    {barbers.map(b => (
                      <option key={b.id} value={b.id}>{b.full_name}</option>
                    ))}
                  </select>
                </div>

                {/* Service */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Serviço</label>
                  <select
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary border border-border focus:border-primary rounded text-xs text-foreground outline-none cursor-pointer"
                    required
                  >
                    <option value="">Selecione o serviço</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>{s.name} — R$ {Number(s.price).toFixed(2)} ({s.duration}min)</option>
                    ))}
                  </select>
                </div>

                {/* Day of week + Sessions row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Dia da Semana</label>
                    <select
                      value={dayOfWeek}
                      onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-secondary border border-border focus:border-primary rounded text-xs text-foreground outline-none cursor-pointer"
                    >
                      {WEEKDAY_NAMES.map((name, i) => (
                        <option key={i} value={i}>{name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Nº de Sessões</label>
                    <select
                      value={totalSessions}
                      onChange={(e) => setTotalSessions(parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-secondary border border-border focus:border-primary rounded text-xs text-foreground outline-none cursor-pointer"
                    >
                      {[2, 3, 4, 5, 6, 7, 8].map(n => (
                        <option key={n} value={n}>{n} sessões</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Start date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Data de Início</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary border border-border focus:border-primary rounded text-xs text-foreground outline-none"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Pré-selecionado para a próxima {WEEKDAY_NAMES[dayOfWeek].toLowerCase()}
                  </p>
                </div>

                {/* Time slot */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Horário</label>
                  {loadingSlots ? (
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground py-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> Carregando horários...
                    </div>
                  ) : availableSlots.length > 0 ? (
                    <select
                      value={timeSlot}
                      onChange={(e) => setTimeSlot(e.target.value)}
                      className="w-full px-3 py-2 bg-secondary border border-border focus:border-primary rounded text-xs text-foreground outline-none cursor-pointer"
                      required
                    >
                      <option value="">Escolha um horário</option>
                      {availableSlots.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-[10px] text-muted-foreground italic bg-secondary p-2 rounded border border-border">
                      {barberId && serviceId && startDate
                        ? 'Nenhum horário disponível nesta data.'
                        : 'Selecione barbeiro, serviço e data para carregar horários.'}
                    </p>
                  )}
                </div>

                {/* Package price */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Preço do Pacote (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={packagePrice}
                    onChange={(e) => setPackagePrice(e.target.value)}
                    placeholder="Ex: 180.00"
                    className="w-full px-3 py-2 bg-secondary border border-border focus:border-primary rounded text-xs text-foreground outline-none"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Sugestão: preço do barbeiro × {totalSessions} sessões − R$ 20 de desconto
                  </p>
                </div>

                {/* ── Availability Preview ────────────────────────── */}
                {validationResult.length > 0 && (
                  <div className="space-y-2 p-3 bg-secondary/30 border border-border/50 rounded-lg">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                      Verificação de Disponibilidade
                    </p>
                    <div className="space-y-1">
                      {validationResult.map((r, i) => (
                        <div key={r.date} className="flex items-center gap-2 text-xs">
                          {r.available ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <X className="w-3.5 h-3.5 text-destructive shrink-0" />
                          )}
                          <span className={r.available ? 'text-foreground' : 'text-destructive font-semibold'}>
                            Sessão {i + 1}: {formatDatePt(r.date)} ({WEEKDAY_SHORT[dayOfWeek]})
                          </span>
                          {!r.available && (
                            <span className="text-[9px] text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                              CONFLITO
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {validationResult.some(r => !r.available) && (
                      <p className="text-[10px] text-destructive font-semibold mt-1">
                        ⚠ Resolva os conflitos antes de criar o pacote. Todos os horários devem estar livres.
                      </p>
                    )}

                    {validationResult.every(r => r.available) && (
                      <p className="text-[10px] text-emerald-500 font-semibold mt-1">
                        ✓ Todos os {totalSessions} horários estão disponíveis!
                      </p>
                    )}
                  </div>
                )}

                {loadingValidation && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> Verificando disponibilidade...
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isPending || !customerId || validationResult.some(r => !r.available)}
                  className="w-full py-3 bg-primary hover:bg-primary-hover text-primary-foreground font-bold rounded text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin text-primary-foreground" /> Criando Pacote...</>
                  ) : (
                    <><Crown className="w-4 h-4 text-primary-foreground" /> Confirmar Pacote ({totalSessions} sessões)</>
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
