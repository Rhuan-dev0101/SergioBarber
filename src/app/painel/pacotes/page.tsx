'use client'

import React, { useEffect, useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Package, Plus, Loader2, Search, X, Check, AlertCircle,
  CheckCircle2, Calendar, Clock, User, Scissors, Trash2,
  AlertTriangle, ChevronDown, Crown, Sparkles, Edit, DollarSign, Save, Users
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { DashboardSidebar } from '@/components/DashboardSidebar'
import { CreatePackageForm } from '@/components/CreatePackageForm'
import { getSessionDatesForDuration, getExpandedSessionDates } from '@/lib/package-utils'
import {
  createPackageAction,
  cancelPackageAction,
  validatePackageSlotsAction,
  markPackageAsPaidAction,
  deletePackageAction,
  cancelPackageSessionAction,
  reschedulePackageSessionAction,
  updatePackagePriceAction
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
  const [filterBarberId, setFilterBarberId] = useState<string>('')
  const [adminBarberId, setAdminBarberId] = useState<string>('')

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [editPackageTarget, setEditPackageTarget] = useState<any>(null)
  const [editPackagePrice, setEditPackagePrice] = useState('')

  useEffect(() => {
    if (editPackageTarget) {
      setEditPackagePrice(String(editPackageTarget.package_price || ''))
    }
  }, [editPackageTarget])

  // Session Reschedule State
  const [rescheduleAppt, setRescheduleAppt] = useState<any>(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')
  const [rescheduleSlots, setRescheduleSlots] = useState<string[]>([])
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState(false)

  // Form state
  const [customerId, setCustomerId] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [isManualClient, setIsManualClient] = useState(false)
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [barberId, setBarberId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState<number>(3) // Wednesday default
  const [timeSlot, setTimeSlot] = useState('')
  const [startDate, setStartDate] = useState('')
  const [packagePrice, setPackagePrice] = useState('')
  const [durationMonths, setDurationMonths] = useState<1 | 4 | 6>(1)

  // Barber-specific package services
  const [barberServices, setBarberServices] = useState<any[]>([])
  const [loadingBarberServices, setLoadingBarberServices] = useState(false)

  // Slots
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Validation & exclusion preview
  const [excludedDates, setExcludedDates] = useState<string[]>([])
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

      if (!profile || (profile.role !== 'admin' && profile.role !== 'barber')) { router.push('/painel'); return }
      setUserRole(profile.role)

      // Fetch customers (all non-admin profiles)
      const { data: dbCustomers } = await supabase
        .from('profiles')
        .select('id, full_name, phone, role')
        .order('full_name')
      const validCustomers = (dbCustomers || []).filter((c: any) => c.role !== 'admin')
      setCustomers(validCustomers)

      // Fetch active barbers
      const { data: dbBarbers } = await supabase
        .from('barbers')
        .select('id, is_active, photo_url, profile_id, profiles(id, full_name)')
        .eq('is_active', true)

      if (dbBarbers) {
        const formatted = dbBarbers
          .filter((b: any) => b.profiles)
          .map((b: any) => ({
            id: b.id,
            profile_id: b.profile_id || b.profiles.id,
            full_name: b.profiles.full_name,
            photo_url: b.photo_url || (b.profiles.full_name?.toLowerCase()?.includes('sergio') ? '/barbers/sergio.jpg' : null)
          }))
        setBarbers(formatted)
        if (formatted.length === 1) {
          setBarberId(formatted[0].id)
        }

        // Set logged-in user's barber ID as default filter
        const me = formatted.find((b: any) => b.profile_id === session.user.id)
        if (me) {
          setAdminBarberId(me.id)
          setFilterBarberId((prev) => (prev ? prev : me.id))
        } else if (formatted.length > 0) {
          setAdminBarberId(formatted[0].id)
          setFilterBarberId((prev) => (prev ? prev : formatted[0].id))
        }
      } else {
        setBarbers([])
      }

      // Fetch all active services for package selection
      const { data: dbServices } = await supabase
        .from('services')
        .select('id, name, price, duration')
        .eq('is_active', true)
        .order('name')
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
        return enriched
      } else {
        setPackages([])
        return []
      }
    } catch (err) {
      console.error('Error loading packages data:', err)
      return []
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // Filtered packages based on selected barber avatar (for Admin) or locked to own barber (for Barber)
  const filteredPackages = useMemo(() => {
    if (userRole === 'barber' && adminBarberId) {
      return packages.filter(p => p.barber_id === adminBarberId)
    }
    if (!filterBarberId || filterBarberId === 'all') {
      return packages
    }
    return packages.filter(p => p.barber_id === filterBarberId)
  }, [packages, filterBarberId, userRole, adminBarberId])

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

  // ──── Load package services specific to selected barber ────
  useEffect(() => {
    if (!barberId) {
      setBarberServices([])
      setServiceId('')
      return
    }

    async function loadBarberPackageServices() {
      setLoadingBarberServices(true)
      try {
        const selectedBarber = barbers.find(b => b.id === barberId)
        const isSergio = selectedBarber?.full_name?.toLowerCase().includes('sergio')

        const { data: dbBS } = await supabase
          .from('barber_services')
          .select('price, duration, is_active, service_id, services(id, name, price, duration)')
          .eq('barber_id', barberId)
          .eq('is_active', true)

        let pkgSvcs: any[] = []

        if (dbBS && dbBS.length > 0) {
          pkgSvcs = dbBS
            .filter((bs: any) => {
              if (!bs.services) return false
              const n = bs.services.name.toLowerCase()
              const isPkg = n.includes('pacote')
              if (!isPkg) return false
              // Only exclude progressiva for Sergio's packages
              if (isSergio && n.includes('progressiva')) return false
              return true
            })
            .map((bs: any) => ({
              id: bs.service_id,
              name: bs.services.name,
              price: Number(bs.price || bs.services.price),
              duration: Number(bs.duration || bs.services.duration)
            }))
        }

        if (pkgSvcs.length === 0) {
          let query = supabase
            .from('services')
            .select('id, name, price, duration')
            .eq('is_active', true)
            .ilike('name', '%pacote%')

          if (isSergio) {
            query = query.not('name', 'ilike', '%progressiva%')
          }

          const { data: baseServices } = await query.order('name')

          pkgSvcs = (baseServices || []).map(s => ({
            id: s.id,
            name: s.name,
            price: Number(s.price),
            duration: Number(s.duration)
          }))
        }

        setBarberServices(pkgSvcs)

        if (serviceId && !pkgSvcs.some(s => s.id === serviceId)) {
          setServiceId('')
        }
      } catch (err) {
        console.error('Error fetching barber package services:', err)
        setBarberServices([])
      } finally {
        setLoadingBarberServices(false)
      }
    }

    loadBarberPackageServices()
  }, [barberId])

  const selectedService = barberServices.find(s => s.id === serviceId)
  const isNoDiscountPackage = Boolean(selectedService?.name?.toLowerCase().includes('sem desconto'))

  // ──── Auto-fill package price (FLAT rate: monthly rate x durationMonths, minus R$ 50 per excluded date for no-discount packages) ────
  useEffect(() => {
    if (durationMonths) {
      const selSvc = barberServices.find(s => s.id === serviceId)
      const monthlyRate = selSvc?.price || 150
      const basePrice = durationMonths * monthlyRate

      const isNoDiscount = Boolean(selSvc?.name?.toLowerCase().includes('sem desconto'))
      if (isNoDiscount) {
        // For PACOTE SEM DESCONTO HORÁRIO FIXO:
        // Base rate is R$ 200/month (4 sessions x R$ 50).
        // Each excluded (unchecked) date subtracts R$ 50.00 from total package price.
        const deduction = excludedDates.length * 50
        const finalPrice = Math.max(0, basePrice - deduction)
        setPackagePrice(finalPrice.toFixed(2))
      } else {
        setPackagePrice(basePrice.toFixed(2))
      }
    }
  }, [durationMonths, serviceId, barberServices, excludedDates])

  // Compute expanded candidate dates & selected dates
  const { baseDates, candidateDates, selectedDates, targetSessions } = useMemo(() => {
    if (isNoDiscountPackage) {
      const bDates = getSessionDatesForDuration(startDate, durationMonths)
      const sDates = bDates.filter(d => !excludedDates.includes(d))
      return {
        baseDates: bDates,
        candidateDates: bDates,
        selectedDates: sDates,
        targetSessions: bDates.length
      }
    }
    return getExpandedSessionDates(startDate, durationMonths, excludedDates)
  }, [startDate, durationMonths, excludedDates, isNoDiscountPackage])

  // ──── Reset excluded dates when primary parameters change ────
  useEffect(() => {
    setExcludedDates([])
  }, [startDate, durationMonths, barberId, serviceId, dayOfWeek])

  // ──── Validate all candidate slots when time + candidateDates change ────
  useEffect(() => {
    if (!barberId || !serviceId || !timeSlot || !startDate || !durationMonths || candidateDates.length === 0) {
      setValidationResult([])
      return
    }

    setLoadingValidation(true)
    startTransition(async () => {
      const result = await validatePackageSlotsAction(barberId, serviceId, timeSlot, startDate, durationMonths, candidateDates)
      setValidationResult(result.dates)
      setLoadingValidation(false)
    })
  }, [barberId, serviceId, timeSlot, startDate, durationMonths, candidateDates.join(',')])

  const selectedConflicts = validationResult.filter(r => !excludedDates.includes(r.date) && !r.available)
  const hasConflict = selectedConflicts.length > 0

  const toggleDateSelection = (dateStr: string) => {
    setExcludedDates(prev =>
      prev.includes(dateStr)
        ? prev.filter(d => d !== dateStr)
        : [...prev, dateStr]
    )
  }

  // ──── Fetch available slots for rescheduling session ────
  useEffect(() => {
    if (!rescheduleAppt || !rescheduleDate || !editPackageTarget) {
      setRescheduleSlots([])
      return
    }

    async function fetchRescheduleSlots() {
      setLoadingRescheduleSlots(true)
      setRescheduleTime('')
      const svc = services.find(s => s.id === editPackageTarget.service_id)
      const duration = svc?.duration || 60

      try {
        const res = await fetch(`/api/booking/slots?barberId=${editPackageTarget.barber_id}&dateStr=${rescheduleDate}&duration=${duration}`)
        const data = await res.json()
        setRescheduleSlots(data.slots || [])
      } catch (err) {
        console.error('Error fetching reschedule slots:', err)
      } finally {
        setLoadingRescheduleSlots(false)
      }
    }
    fetchRescheduleSlots()
  }, [rescheduleAppt, rescheduleDate, editPackageTarget, services])

  const handleCancelSession = (apptId: string) => {
    setErrorMsg('')
    setSuccessMsg('')

    startTransition(async () => {
      const res = await cancelPackageSessionAction(apptId)
      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg(res.message)
        const updatedPackages = await loadData()
        if (editPackageTarget && updatedPackages) {
          const freshPkg = updatedPackages.find((p: any) => p.id === editPackageTarget.id)
          if (freshPkg) setEditPackageTarget(freshPkg)
        }
      }
    })
  }

  const handleStartReschedule = (appt: any) => {
    setRescheduleAppt(appt)
    const apptDate = new Date(appt.start_time)
    const y = apptDate.getFullYear()
    const m = String(apptDate.getMonth() + 1).padStart(2, '0')
    const d = String(apptDate.getDate()).padStart(2, '0')
    setRescheduleDate(`${y}-${m}-${d}`)
    setRescheduleTime('')
  }

  const handleConfirmReschedule = () => {
    if (!rescheduleAppt || !rescheduleDate || !rescheduleTime) return
    setErrorMsg('')
    setSuccessMsg('')

    startTransition(async () => {
      const res = await reschedulePackageSessionAction(rescheduleAppt.id, rescheduleDate, rescheduleTime)
      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg(res.message)
        setRescheduleAppt(null)
        const updatedPackages = await loadData()
        if (editPackageTarget && updatedPackages) {
          const freshPkg = updatedPackages.find((p: any) => p.id === editPackageTarget.id)
          if (freshPkg) setEditPackageTarget(freshPkg)
        }
      }
    })
  }

  const handleUpdatePrice = () => {
    if (!editPackageTarget || !editPackagePrice) return
    const numPrice = parseFloat(editPackagePrice)
    if (isNaN(numPrice) || numPrice <= 0) {
      setErrorMsg('Informe um valor numérico válido para o pacote.')
      return
    }
    setErrorMsg('')
    setSuccessMsg('')

    startTransition(async () => {
      const res = await updatePackagePriceAction(editPackageTarget.id, numPrice)
      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg(res.message)
        const updatedPackages = await loadData()
        if (editPackageTarget && updatedPackages) {
          const freshPkg = updatedPackages.find((p: any) => p.id === editPackageTarget.id)
          if (freshPkg) setEditPackageTarget(freshPkg)
        }
      }
    })
  }

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

    if ((!customerId && !customerSearch.trim()) || !barberId || !serviceId || !timeSlot || !startDate || !packagePrice) {
      setErrorMsg('Todos os campos são obrigatórios.')
      return
    }

    if (hasConflict) {
      setErrorMsg('Existem conflitos em datas selecionadas. Resolva ou desmarque antes de criar o pacote.')
      return
    }

    startTransition(async () => {
      const res = await createPackageAction(
        customerId, barberId, serviceId, dayOfWeek, timeSlot,
        startDate, parseFloat(packagePrice), durationMonths, selectedDates,
        customerSearch
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
    setIsManualClient(false)
    setBarberId('')
    setServiceId('')
    setDayOfWeek(3)
    setTimeSlot('')
    setStartDate('')
    setPackagePrice('150.00')
    setDurationMonths(1)
    setExcludedDates([])
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/40 pb-6">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-foreground flex items-center gap-2.5">
              <Crown className="w-6 h-6 sm:w-7 sm:h-7 text-primary shrink-0" />
              Pacotes Mensais VIP
            </h1>
            <p className="text-xs text-muted-foreground">Gestão de assinaturas recorrentes com horários fixos e verificação em tempo real da agenda</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowModal(true) }}
            className="w-full sm:w-auto px-5 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200 cursor-pointer group"
          >
            <Plus className="w-4 h-4 text-primary-foreground transition-transform group-hover:scale-110" />
            <span>Criar Novo Pacote VIP</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-2 text-xs text-destructive">
            <AlertCircle className="w-4.5 h-4.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-2 text-xs text-emerald-500">
            <CheckCircle2 className="w-4.5 h-4.5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ── Admin Barber Avatar Filter Selector ─────────────────────── */}
        {userRole === 'admin' && barbers.length > 0 && (
          <div className="glass p-4 rounded-2xl border border-border/80 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary" />
                Filtrar por Barbeiro:
              </span>
              <span className="text-[11px] text-muted-foreground font-semibold">
                Exibindo {filteredPackages.length} de {packages.length} pacote(s)
              </span>
            </div>

            <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto pb-1.5 pt-1 scrollbar-none">
              {/* Option 1: Todos os Barbeiros */}
              <button
                type="button"
                onClick={() => setFilterBarberId('all')}
                className={`flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer transition-all ${
                  filterBarberId === 'all' ? 'scale-105' : 'opacity-70 hover:opacity-100'
                }`}
              >
                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 p-0.5 flex items-center justify-center transition-all shadow-md ${
                  filterBarberId === 'all'
                    ? 'border-primary ring-4 ring-primary/20 bg-gradient-to-tr from-primary/30 via-secondary to-primary/10'
                    : 'border-border/80 group-hover:border-primary/50 bg-secondary/40'
                }`}>
                  <Users className={`w-6 h-6 sm:w-7 sm:h-7 ${filterBarberId === 'all' ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="text-center">
                  <span className={`text-xs font-bold block leading-none ${filterBarberId === 'all' ? 'text-primary' : 'text-foreground'}`}>
                    Todos
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    ({packages.length})
                  </span>
                </div>
              </button>

              {/* Barber Avatars */}
              {barbers.map((b) => {
                const isSelected = filterBarberId === b.id
                const count = packages.filter(p => p.barber_id === b.id).length
                const firstName = b.full_name.split(' ')[0]

                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setFilterBarberId(b.id)}
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
                        ({count})
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Packages List ──────────────────────────────────── */}
        {filteredPackages.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredPackages.map((pkg) => {
              const remaining = pkg.total_sessions - pkg.completedSessions - pkg.cancelledSessions
              const progressPct = Math.round((pkg.completedSessions / pkg.total_sessions) * 100)

              return (
                <div
                  key={pkg.id}
                  className="glass p-5 sm:p-6 rounded-2xl border border-border/80 hover:border-primary/40 transition-all duration-200 space-y-4 shadow-xl relative overflow-hidden flex flex-col justify-between"
                >
                  <div className="absolute top-0 right-0 w-28 h-28 bg-primary/5 rounded-full blur-2xl pointer-events-none" />

                  <div className="space-y-4 relative z-10">
                    {/* Header: Customer Name & Badges */}
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <h3 className="font-serif font-bold text-lg sm:text-xl text-foreground tracking-tight">{pkg.customerName}</h3>
                        
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`text-[10px] uppercase font-extrabold px-2.5 py-1 rounded-full ${
                            pkg.status === 'active'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : pkg.status === 'completed'
                              ? 'bg-primary/15 text-primary border border-primary/30'
                              : 'bg-destructive/15 text-destructive border border-destructive/30'
                          }`}>
                            {pkg.status === 'active' ? 'Ativo' : pkg.status === 'completed' ? 'Concluído' : 'Cancelado'}
                          </span>

                          <span className={`text-[10px] uppercase font-extrabold px-2.5 py-1 rounded-full ${
                            pkg.payment_status === 'paid'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : pkg.payment_status === 'cancelled'
                              ? 'bg-destructive/15 text-destructive border border-destructive/30'
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          }`}>
                            {pkg.payment_status === 'paid' ? 'Pago ✓' : pkg.payment_status === 'cancelled' ? 'Cancelado' : 'Pagamento Pendente'}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                        <Scissors className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>{pkg.serviceName} com <strong className="text-foreground">{pkg.barberName}</strong></span>
                      </p>
                    </div>

                    {/* Schedule summary bar */}
                    <div className="flex items-center justify-between gap-3 text-xs bg-secondary/40 p-3 rounded-xl border border-border/60 shadow-inner">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="flex items-center gap-1.5 font-semibold text-foreground">
                          <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                          Toda {WEEKDAY_SHORT[pkg.day_of_week]}
                        </span>
                        <span className="flex items-center gap-1.5 font-semibold text-foreground">
                          <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                          {pkg.time_slot}
                        </span>
                      </div>
                      <span className="font-mono font-extrabold text-primary text-sm sm:text-base shrink-0">
                        R$&nbsp;{Number(pkg.package_price).toFixed(2)}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-foreground">{pkg.completedSessions} de {pkg.total_sessions} sessões concluídas</span>
                        <span className="text-primary font-mono">{remaining > 0 ? `${remaining} restante(s)` : 'Finalizado'}</span>
                      </div>
                      <div className="h-2.5 bg-secondary/80 rounded-full overflow-hidden p-0.5 border border-border/50">
                        <div
                          className="h-full bg-gradient-to-r from-primary/80 via-primary to-primary-hover rounded-full transition-all duration-500 shadow-sm"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Scheduled dates grid */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase font-extrabold text-muted-foreground tracking-wider block">Datas Agendadas:</span>
                      <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
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
                                className={`text-[10px] font-bold py-1 px-1 text-center rounded-lg border transition-all ${
                                  appt.status === 'completed'
                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                    : appt.status === 'cancelled'
                                    ? 'bg-destructive/15 text-destructive border-destructive/30 line-through opacity-60'
                                    : 'bg-secondary/60 text-foreground/90 border-border/60'
                                }`}
                              >
                                {dateLabel}
                              </span>
                            )
                          })}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons bar */}
                  <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center justify-between border-t border-border/40 pt-3.5 mt-4">
                    {pkg.payment_status === 'pending' && pkg.status === 'active' && (
                      <button
                        onClick={() => handleMarkAsPaid(pkg.id)}
                        disabled={isPending}
                        className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <Check className="w-4 h-4" />
                        <span>Marcar como Pago</span>
                      </button>
                    )}

                    <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
                      <button
                        onClick={() => setEditPackageTarget(pkg)}
                        disabled={isPending}
                        className="flex-1 sm:flex-initial px-3.5 py-2.5 bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Editar Pacote</span>
                      </button>
                      
                      {pkg.status === 'active' && (
                        <button
                          onClick={() => setCancelTarget(pkg)}
                          disabled={isPending}
                          className="flex-1 sm:flex-initial px-3.5 py-2.5 bg-destructive/10 hover:bg-destructive/20 border border-destructive/30 text-destructive rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center active:scale-95"
                        >
                          Cancelar
                        </button>
                      )}

                      <button
                        onClick={() => setDeleteTarget(pkg)}
                        disabled={isPending}
                        className="p-2.5 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/30 text-rose-400 hover:text-rose-300 rounded-xl cursor-pointer transition-all shrink-0 flex items-center justify-center active:scale-95"
                        title="Excluir permanentemente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="p-12 bg-secondary/20 rounded-xl border border-border/60 text-center space-y-3">
            <Package className="w-12 h-12 text-muted-foreground mx-auto opacity-30" />
            <p className="text-xs text-muted-foreground">Nenhum pacote mensal registrado ainda.</p>
            <button
              onClick={() => { resetForm(); setShowModal(true) }}
              className="text-primary font-bold text-xs hover:underline cursor-pointer inline-flex items-center gap-1"
            >
              <Crown className="w-3.5 h-3.5 text-primary" />
              <span>Criar primeiro pacote mensal VIP →</span>
            </button>
          </div>
        )}

        {/* ── Cancel Confirmation Modal ──────────────────────── */}
        {cancelTarget && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass p-6 sm:p-8 rounded-xl border border-red-800/50 max-w-md w-full shadow-2xl space-y-5 relative">
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
                </p>
              </div>

              <div className="bg-secondary/40 border border-border/50 rounded-lg p-4 space-y-2 text-xs">
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
                  className="flex-1 px-4 py-2.5 bg-secondary hover:bg-muted border border-border text-foreground rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleCancelPackage}
                  disabled={isPending}
                  className="flex-1 px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
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
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass p-6 sm:p-8 rounded-xl border border-red-800/50 max-w-md w-full shadow-2xl space-y-5 relative">
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
                  Esta ação excluirá o registro do pacote e <strong className="text-red-400">todos os seus agendamentos vinculados</strong>.
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isPending}
                  className="flex-1 px-4 py-2.5 bg-secondary hover:bg-muted border border-border text-foreground rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleDeletePackage}
                  disabled={isPending}
                  className="flex-1 px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isPending ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Excluindo...</>
                  ) : (
                    <><Trash2 className="w-3.5 h-3.5" /> Excluir Permanentemente</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Edit Package Modal ──────────────────────── */}
        {editPackageTarget && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="glass p-6 sm:p-8 rounded-2xl border border-primary/40 max-w-2xl w-full shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex justify-between items-center pb-4 border-b border-border/40">
                <div className="space-y-0.5 text-left">
                  <h3 className="font-serif font-bold text-xl text-foreground flex items-center gap-2">
                    <Edit className="w-5 h-5 text-primary" /> Editar Pacote VIP
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Cliente: <strong className="text-foreground">{editPackageTarget.customerName}</strong> • Barbeiro: <strong className="text-foreground">{editPackageTarget.barberName}</strong> • {editPackageTarget.serviceName}
                  </p>
                </div>
                <button
                  onClick={() => { setEditPackageTarget(null); setRescheduleAppt(null) }}
                  className="text-muted-foreground hover:text-foreground p-1.5 hover:bg-secondary rounded-lg cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Price Edit Section */}
              <div className="p-4 bg-secondary/30 border border-border/60 rounded-xl space-y-3 text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-primary" /> Alterar Valor Total do Pacote
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      Atualize o preço total do pacote contratado pelo cliente.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative w-36">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-primary">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editPackagePrice}
                        onChange={(e) => setEditPackagePrice(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 bg-background border border-border focus:border-primary rounded-lg text-sm font-bold text-foreground outline-none"
                        placeholder="0.00"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleUpdatePrice}
                      disabled={isPending || !editPackagePrice || parseFloat(editPackagePrice) === Number(editPackageTarget.package_price)}
                      className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      <span>Salvar Valor</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Section Header for Sessions */}
              <div className="text-left pt-2 border-t border-border/30">
                <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider mb-3">Sessões & Agendamentos</h4>
              </div>

              {/* Sessions List */}
              <div className="space-y-3 text-left">
                {editPackageTarget.appointments
                  .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                  .map((appt: any, idx: number) => {
                    const d = new Date(appt.start_time)
                    const dateFormatted = d.toLocaleDateString('pt-BR', {
                      timeZone: 'America/Sao_Paulo',
                      weekday: 'short',
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    })
                    const timeFormatted = d.toLocaleTimeString('pt-BR', {
                      timeZone: 'America/Sao_Paulo',
                      hour: '2-digit',
                      minute: '2-digit'
                    })

                    const isReschedulingThis = rescheduleAppt?.id === appt.id

                    return (
                      <div key={appt.id} className="p-3.5 bg-secondary/30 border border-border/60 rounded-xl space-y-3 transition-all">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-foreground">Sessão {idx + 1}/{editPackageTarget.total_sessions}</span>
                              <span className={`text-[9px] uppercase font-bold px-2.5 py-0.5 rounded-full ${
                                appt.status === 'completed'
                                  ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/25'
                                  : appt.status === 'cancelled'
                                  ? 'bg-destructive/15 text-destructive border border-destructive/25 line-through'
                                  : 'bg-primary/15 text-primary border border-primary/25'
                              }`}>
                                {appt.status === 'completed' ? 'Concluído ✓' : appt.status === 'cancelled' ? 'Cancelado (slot livre)' : 'Confirmado'}
                              </span>
                            </div>
                            <p className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-primary" />
                              <span className="capitalize">{dateFormatted}</span> às <strong>{timeFormatted}</strong>
                            </p>
                          </div>

                          {/* Per-session Action Buttons */}
                          {!isReschedulingThis && (
                            <div className="flex flex-wrap gap-2 items-center shrink-0">
                              {appt.status === 'confirmed' && (
                                <button
                                  onClick={() => handleCancelSession(appt.id)}
                                  disabled={isPending}
                                  className="px-2.5 py-1.5 bg-destructive/10 hover:bg-destructive/20 border border-destructive/25 text-destructive text-xs font-bold rounded-lg transition-all cursor-pointer"
                                >
                                  Desmarcar este dia
                                </button>
                              )}
                              {appt.status !== 'completed' && (
                                <button
                                  onClick={() => handleStartReschedule(appt)}
                                  disabled={isPending}
                                  className="px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/25 text-primary text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                                >
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>{appt.status === 'cancelled' ? 'Remarcar para nova data' : 'Remarcar'}</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Inline Reschedule Form */}
                        {isReschedulingThis && (
                          <div className="p-3.5 bg-background border border-primary/40 rounded-xl space-y-3 mt-2 shadow-inner">
                            <span className="text-[11px] uppercase font-bold text-primary tracking-wider block">Remarcar Sessão {idx + 1}</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-muted-foreground">Nova Data</label>
                                <input
                                  type="date"
                                  value={rescheduleDate}
                                  onChange={(e) => setRescheduleDate(e.target.value)}
                                  className="w-full p-2 bg-secondary border border-border rounded text-base outline-none text-foreground font-medium"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-muted-foreground">Novo Horário Livre</label>
                                {loadingRescheduleSlots ? (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-2">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> Buscando horários...
                                  </div>
                                ) : rescheduleSlots.length > 0 ? (
                                  <select
                                    value={rescheduleTime}
                                    onChange={(e) => setRescheduleTime(e.target.value)}
                                    className="w-full p-2 bg-secondary border border-border rounded text-base outline-none text-foreground font-bold cursor-pointer"
                                  >
                                    <option value="">Selecione o horário</option>
                                    {rescheduleSlots.map(t => (
                                      <option key={t} value={t}>{t}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <p className="text-[10px] text-muted-foreground italic py-1 bg-secondary/50 p-2 rounded">Nenhum horário livre nesta data.</p>
                                )}
                              </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-1 border-t border-border/30">
                              <button
                                type="button"
                                onClick={() => setRescheduleAppt(null)}
                                className="px-3 py-1.5 bg-secondary hover:bg-muted text-foreground rounded-lg text-xs font-semibold cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={handleConfirmReschedule}
                                disabled={isPending || !rescheduleDate || !rescheduleTime}
                                className="px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-primary-foreground font-bold rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                              >
                                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                Confirmar Reagendamento
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>

              <div className="pt-2 border-t border-border/40 flex justify-end">
                <button
                  type="button"
                  onClick={() => { setEditPackageTarget(null); setRescheduleAppt(null) }}
                  className="px-5 py-2 bg-secondary hover:bg-muted text-foreground rounded-lg text-xs font-bold cursor-pointer transition-all"
                >
                  Concluir Edição
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Create Package Modal (FORM DE PREENCHIMENTO DO PACOTE) ───────────────────────────── */}
        {showModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="glass p-6 sm:p-8 rounded-2xl border border-primary/40 max-w-xl w-full shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto">
              
              {/* Header */}
              <div className="flex justify-between items-center pb-4 border-b border-border/40">
                <div className="space-y-0.5">
                  <h3 className="font-serif font-bold text-xl text-foreground flex items-center gap-2">
                    <Crown className="w-6 h-6 text-primary" /> Criar Novo Pacote VIP
                  </h3>
                  <p className="text-xs text-muted-foreground">Preencha os dados abaixo para gerar agendamentos recorrentes automaticamente</p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-muted-foreground hover:text-foreground p-1.5 hover:bg-secondary rounded-lg cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <CreatePackageForm
                onSuccess={(msg) => {
                  setSuccessMsg(msg || 'Pacote criado com sucesso!')
                  setShowModal(false)
                  loadData()
                }}
                onCancel={() => setShowModal(false)}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
