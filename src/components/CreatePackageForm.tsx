'use client'

import React, { useEffect, useState, useTransition, useMemo } from 'react'
import {
  Crown, Plus, Loader2, Search, X, Check, AlertCircle,
  CheckCircle2, Calendar, Clock, User, Scissors, DollarSign, Sparkles
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { getSessionDatesForDuration, getExpandedSessionDates } from '@/lib/package-utils'
import { createPackageAction, validatePackageSlotsAction } from '@/app/painel/pacotes/actions'

const WEEKDAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

interface CreatePackageFormProps {
  onSuccess: (msg?: string) => void
  onCancel?: () => void
  initialBarberId?: string
  initialStartDate?: string
  initialTimeSlot?: string
}

export function CreatePackageForm({
  onSuccess,
  onCancel,
  initialBarberId = '',
  initialStartDate = '',
  initialTimeSlot = ''
}: CreatePackageFormProps) {
  const supabase = createClient()
  const [isPending, startTransition] = useTransition()

  // Data lists
  const [customers, setCustomers] = useState<any[]>([])
  const [barbers, setBarbers] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)

  // Form State
  const [customerId, setCustomerId] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [isManualClient, setIsManualClient] = useState(false)
  const [barberId, setBarberId] = useState(initialBarberId)
  const [serviceId, setServiceId] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState<number>(3) // Wednesday default
  const [timeSlot, setTimeSlot] = useState(initialTimeSlot)
  const [startDate, setStartDate] = useState(initialStartDate)
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

  // 1. Fetch initial customers, barbers, and services
  useEffect(() => {
    async function loadData() {
      try {
        setLoadingData(true)
        // Customers
        const { data: dbCust } = await supabase
          .from('profiles')
          .select('id, full_name, phone, role')
          .order('full_name')
        const validCustomers = (dbCust || []).filter((c: any) => c.role !== 'admin')
        setCustomers(validCustomers)

        // Barbers
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
          if (!initialBarberId && formatted.length === 1) {
            setBarberId(formatted[0].id)
          }
        }

        // Services
        const { data: dbSvc } = await supabase
          .from('services')
          .select('id, name, price, duration')
          .eq('is_active', true)
          .order('name')
        setServices(dbSvc || [])
      } catch (err) {
        console.error('Error loading package form data:', err)
      } finally {
        setLoadingData(false)
      }
    }
    loadData()
  }, [])

  // Update initial props if changed
  useEffect(() => {
    if (initialBarberId && !barberId) setBarberId(initialBarberId)
    if (initialStartDate && !startDate) setStartDate(initialStartDate)
    if (initialTimeSlot && !timeSlot) setTimeSlot(initialTimeSlot)
  }, [initialBarberId, initialStartDate, initialTimeSlot])

  // Filtered registered customers
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers
    const q = customerSearch.toLowerCase().trim()
    return customers.filter(c =>
      (c.full_name && c.full_name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q))
    )
  }, [customers, customerSearch])

  // 2. When barberId changes, fetch barber's available package services
  useEffect(() => {
    if (!barberId) {
      setBarberServices([])
      setServiceId('')
      return
    }

    async function loadBarberServices() {
      setLoadingBarberServices(true)
      try {
        const { data: linkRows } = await supabase
          .from('barber_services')
          .select('service_id')
          .eq('barber_id', barberId)

        let serviceIds: string[] = []
        if (linkRows && linkRows.length > 0) {
          serviceIds = linkRows.map(r => r.service_id)
        }

        let pkgServices: any[] = []
        if (serviceIds.length > 0) {
          pkgServices = services.filter(s => serviceIds.includes(s.id) && s.name.toLowerCase().includes('pacote'))
        }

        if (pkgServices.length === 0) {
          pkgServices = services.filter(s => s.name.toLowerCase().includes('pacote'))
        }

        setBarberServices(pkgServices)

        if (pkgServices.length === 1) {
          setServiceId(pkgServices[0].id)
        } else if (pkgServices.length > 0 && !pkgServices.some(s => s.id === serviceId)) {
          setServiceId(pkgServices[0].id)
        }
      } catch (err) {
        console.error('Error fetching barber services:', err)
      } finally {
        setLoadingBarberServices(false)
      }
    }

    loadBarberServices()
  }, [barberId, services])

  // Selected service object
  const selectedService = useMemo(() => {
    return services.find(s => s.id === serviceId)
  }, [services, serviceId])

  const isNoDiscountPackage = useMemo(() => {
    if (!selectedService) return false
    const nameLower = selectedService.name.toLowerCase()
    return nameLower.includes('sem desconto') || nameLower.includes('avulso')
  }, [selectedService])

  // Automatically suggest dayOfWeek from startDate if provided
  useEffect(() => {
    if (startDate) {
      const [y, m, d] = startDate.split('-').map(Number)
      const dateObj = new Date(y, m - 1, d)
      const day = dateObj.getDay()
      setDayOfWeek(day)
    }
  }, [startDate])

  // Compute candidate dates & selected dates
  const { baseDates, candidateDates, selectedDates, targetSessions } = useMemo(() => {
    return getExpandedSessionDates(startDate, durationMonths, excludedDates)
  }, [startDate, durationMonths, excludedDates])

  // Update default package price when service or selected dates change
  useEffect(() => {
    if (!selectedService) {
      setPackagePrice('')
      return
    }

    if (isNoDiscountPackage) {
      const count = selectedDates.length
      const priceVal = count * 50
      setPackagePrice(String(priceVal))
    } else {
      const monthlyPrice = Number(selectedService.price || 150)
      const totalEstimated = monthlyPrice * durationMonths
      setPackagePrice(String(totalEstimated))
    }
  }, [selectedService, durationMonths, selectedDates.length, isNoDiscountPackage])

  // 3. Load available slots when barberId, serviceId, or startDate changes
  useEffect(() => {
    if (!barberId || !serviceId || !startDate) {
      setAvailableSlots([])
      return
    }

    async function loadSlots() {
      setLoadingSlots(true)
      const svc = services.find(s => s.id === serviceId)
      const duration = svc ? svc.duration : 30

      try {
        const res = await fetch(`/api/booking/slots?barberId=${barberId}&dateStr=${startDate}&duration=${duration}`)
        const data = await res.json()
        const slots = data.slots || []
        setAvailableSlots(slots)

        if (initialTimeSlot && slots.includes(initialTimeSlot)) {
          setTimeSlot(initialTimeSlot)
        } else if (slots.length > 0 && (!timeSlot || !slots.includes(timeSlot))) {
          setTimeSlot(slots[0])
        }
      } catch (err) {
        console.error('Error loading slots:', err)
      } finally {
        setLoadingSlots(false)
      }
    }

    loadSlots()
  }, [barberId, serviceId, startDate])

  // 4. Live conflict validation for candidate dates
  useEffect(() => {
    if (!barberId || !serviceId || !timeSlot || !startDate || candidateDates.length === 0) {
      setValidationResult([])
      return
    }

    async function validateSlots() {
      setLoadingValidation(true)
      try {
        const res = await validatePackageSlotsAction(barberId, serviceId, timeSlot, startDate, durationMonths, candidateDates)
        if (res.success && res.dates) {
          setValidationResult(res.dates)
        } else {
          setValidationResult([])
        }
      } catch (err) {
        console.error('Error validating slots:', err)
      } finally {
        setLoadingValidation(false)
      }
    }

    validateSlots()
  }, [barberId, serviceId, timeSlot, startDate, candidateDates.join(',')])

  // Date selection toggle
  const toggleDateSelection = (dateStr: string) => {
    if (excludedDates.includes(dateStr)) {
      setExcludedDates(prev => prev.filter(d => d !== dateStr))
    } else {
      setExcludedDates(prev => [...prev, dateStr])
    }
  }

  // Conflicts calculation
  const selectedConflicts = useMemo(() => {
    return validationResult.filter(r => selectedDates.includes(r.date) && !r.available)
  }, [validationResult, selectedDates])

  const hasConflict = selectedConflicts.length > 0

  const formatDatePt = (dateStr: string) => {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-').map(Number)
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
  }

  // Handle Form Submit
  const handleCreatePackage = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!customerId && !customerSearch.trim()) {
      setErrorMsg('Selecione um cliente cadastrado ou digite o nome/apelido no campo.')
      return
    }
    if (!barberId) {
      setErrorMsg('Selecione o barbeiro responsável.')
      return
    }
    if (!serviceId) {
      setErrorMsg('Selecione o serviço do pacote.')
      return
    }
    if (!timeSlot) {
      setErrorMsg('Escolha o horário fixo das sessões.')
      return
    }
    if (!startDate) {
      setErrorMsg('Informe a data da 1ª sessão.')
      return
    }
    if (!packagePrice || Number(packagePrice) <= 0) {
      setErrorMsg('Informe um valor válido para o pacote.')
      return
    }
    if (hasConflict) {
      setErrorMsg(`Existem ${selectedConflicts.length} data(s) com conflito na agenda. Desmarque as datas conflitantes antes de salvar.`)
      return
    }

    startTransition(async () => {
      const res = await createPackageAction(
        customerId,
        barberId,
        serviceId,
        dayOfWeek,
        timeSlot,
        startDate,
        Number(packagePrice),
        durationMonths,
        selectedDates,
        isManualClient ? customerSearch.trim() : (customerId ? undefined : customerSearch.trim())
      )

      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        onSuccess(res.message)
      }
    })
  }

  if (loadingData) {
    return (
      <div className="py-12 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Carregando dados do pacote...</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleCreatePackage} className="space-y-5 text-left">
      {errorMsg && (
        <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-2 text-xs text-destructive">
          <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Section 1: Cliente & Barbeiro */}
      <div className="space-y-4 bg-secondary/20 p-4 rounded-xl border border-border/60">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-border/40 pb-2.5">
          <span className="text-[10px] uppercase font-bold text-primary tracking-wider block">1. Cliente & Profissional</span>

          {/* Mode Toggle Tabs */}
          <div className="flex items-center gap-1 bg-background p-1 rounded-lg border border-border/60 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => {
                setIsManualClient(false)
                setCustomerId('')
                setCustomerSearch('')
              }}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                !isManualClient
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Cliente Cadastrado
            </button>
            <button
              type="button"
              onClick={() => {
                setIsManualClient(true)
                setCustomerId('')
              }}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                isManualClient
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sem Cadastro / Apelido
            </button>
          </div>
        </div>

        {!isManualClient ? (
          /* Mode A: Registered Client Selector */
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground">Cliente Cadastrado</label>
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar cliente por nome ou telefone..."
                  value={customerSearch}
                  onChange={(e) => {
                    const val = e.target.value
                    setCustomerSearch(val)
                    const matches = customers.filter(c =>
                      c.full_name?.toLowerCase().includes(val.toLowerCase()) ||
                      c.phone?.toLowerCase().includes(val.toLowerCase())
                    )
                    if (matches.length === 1) {
                      setCustomerId(matches[0].id)
                    } else if (!val) {
                      setCustomerId('')
                    }
                  }}
                  className="w-full pl-10 pr-4 py-2 bg-background border border-border focus:border-primary rounded-lg text-base outline-none transition-all text-foreground"
                />
              </div>

              <select
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value)
                  const selected = customers.find(c => c.id === e.target.value)
                  if (selected) setCustomerSearch(selected.full_name)
                }}
                className="w-full px-3.5 py-2.5 bg-background border border-border focus:border-primary rounded-lg text-base text-foreground outline-none cursor-pointer font-medium"
              >
                <option value="">Selecione o cliente ({filteredCustomers.length} encontrado{filteredCustomers.length !== 1 ? 's' : ''})</option>
                {filteredCustomers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>

              {customerSearch.trim() && filteredCustomers.length === 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2 text-left">
                  <p className="text-xs text-amber-400 font-medium">
                    Nenhum cliente cadastrado encontrado para <strong>"{customerSearch.trim()}"</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsManualClient(true)
                      setCustomerId('')
                    }}
                    className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg cursor-pointer hover:bg-primary/90 transition-all flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Criar pacote para "{customerSearch.trim()}" sem cadastro
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Mode B: Manual / Unregistered Nickname Input */
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground">Nome ou Apelido do Cliente (Sem Cadastro)</label>
            <input
              type="text"
              placeholder="Digite o nome/apelido (ex: Beiço, Seu Zé)..."
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value)
                setCustomerId('')
              }}
              className="w-full px-3.5 py-2.5 bg-background border border-primary focus:border-primary rounded-lg text-base font-bold text-foreground outline-none shadow-sm"
              autoFocus
            />
            {customerSearch.trim() ? (
              <p className="text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                ✨ O pacote será gerado para o cliente sem cadastro: <strong>"{customerSearch.trim()}"</strong>
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground italic">
                Digite o nome ou apelido para prosseguir sem vincular a uma conta cadastrada.
              </p>
            )}
          </div>
        )}

        {/* Barber Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-foreground">Barbeiro Responsável</label>
          <select
            value={barberId}
            onChange={(e) => setBarberId(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-background border border-border focus:border-primary rounded-lg text-base text-foreground outline-none cursor-pointer font-medium"
            required
          >
            <option value="">Selecione o profissional</option>
            {barbers.map(b => (
              <option key={b.id} value={b.id}>{b.full_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Section 2: Serviço & Recorrência */}
      <div className="space-y-4 bg-secondary/20 p-4 rounded-xl border border-border/60">
        <span className="text-[10px] uppercase font-bold text-primary tracking-wider block">2. Serviço & Frequência</span>

        {/* Service Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-foreground">Serviço do Pacote</label>
          {!barberId ? (
            <p className="text-[10px] text-amber-400 italic bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
              Selecione primeiro o barbeiro para carregar os pacotes disponíveis.
            </p>
          ) : loadingBarberServices ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> Carregando pacotes do profissional...
            </div>
          ) : barberServices.length > 0 ? (
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-background border border-border focus:border-primary rounded-lg text-base text-foreground outline-none cursor-pointer font-medium"
              required
            >
              <option value="">Selecione o pacote ({barberServices.length} disponível{barberServices.length !== 1 ? 'is' : ''})</option>
              {barberServices.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} — R$ {Number(s.price).toFixed(2)}/mês ({s.duration} min)
                </option>
              ))}
            </select>
          ) : (
            <p className="text-[10px] text-muted-foreground italic bg-background p-2.5 rounded-lg border border-border">
              Nenhum pacote mensal encontrado para este profissional.
            </p>
          )}
        </div>

        {/* Day of Week + Duration Months */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Dia Fixo da Semana</label>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-background border border-border focus:border-primary rounded-lg text-base text-foreground outline-none cursor-pointer font-medium"
            >
              {WEEKDAY_NAMES.map((name, i) => (
                <option key={i} value={i}>{name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Duração / Frequência do Plano</label>
            <select
              value={durationMonths}
              onChange={(e) => setDurationMonths(parseInt(e.target.value) as 1 | 4 | 6)}
              className="w-full px-3.5 py-2.5 bg-background border border-border focus:border-primary rounded-lg text-base text-foreground outline-none cursor-pointer font-bold text-primary"
            >
              <option value={1}>
                1 mês {startDate ? `(${getSessionDatesForDuration(startDate, 1).length} sessões)` : ''}
              </option>
              <option value={4}>
                4 meses {startDate ? `(${getSessionDatesForDuration(startDate, 4).length} sessões)` : ''}
              </option>
              <option value={6}>
                6 meses {startDate ? `(${getSessionDatesForDuration(startDate, 6).length} sessões)` : ''}
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Section 3: Data de Início & Horários */}
      <div className="space-y-4 bg-secondary/20 p-4 rounded-xl border border-border/60">
        <span className="text-[10px] uppercase font-bold text-primary tracking-wider block">3. Data & Horário Fixo</span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Start Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Data da 1ª Sessão</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-background border border-border focus:border-primary rounded-lg text-base text-foreground outline-none font-medium"
              required
            />
            <p className="text-[10px] text-muted-foreground">
              Sugerido: próxima {WEEKDAY_NAMES[dayOfWeek].toLowerCase()}
            </p>
          </div>

          {/* Time Slot */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Horário das Sessões</label>
            {loadingSlots ? (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> Carregando horários livres...
              </div>
            ) : availableSlots.length > 0 ? (
              <select
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-background border border-border focus:border-primary rounded-lg text-base text-foreground outline-none cursor-pointer font-bold"
                required
              >
                <option value="">Escolha o horário fixo</option>
                {availableSlots.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            ) : (
              <p className="text-[10px] text-muted-foreground italic bg-background p-2.5 rounded-lg border border-border">
                {barberId && serviceId && startDate
                  ? 'Nenhum horário livre nesta data.'
                  : 'Selecione barbeiro, serviço e data.'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Section 4: Valor do Pacote */}
      <div className="space-y-2 bg-secondary/20 p-4 rounded-xl border border-border/60">
        <span className="text-[10px] uppercase font-bold text-primary tracking-wider block">4. Valor Total do Pacote</span>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-primary">R$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={packagePrice}
            onChange={(e) => setPackagePrice(e.target.value)}
            placeholder="0.00"
            className="w-full pl-9 pr-4 py-2.5 bg-background border border-border focus:border-primary rounded-lg text-base font-serif font-bold text-foreground outline-none"
            required
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          {isNoDiscountPackage
            ? `Preço calculado automaticamente: ${selectedDates.length} corte(s) x R$ 50,00 = R$ ${packagePrice} (cada corte desmarcado abates R$ 50,00).`
            : `Preço sugerido calculated automaticamente (R$ ${selectedService?.price || 150} por mês). Você pode alterar manualmente se desejar.`}
        </p>
      </div>

      {/* Live Availability & Date Selection Box */}
      {validationResult.length > 0 && (
        <div className="space-y-3 p-4 bg-secondary/40 border border-primary/30 rounded-xl shadow-inner text-left">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1.5 border-b border-border/40 pb-2.5">
            <div>
              <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" />
                Seleção de Datas & Verificação de Agenda
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {isNoDiscountPackage
                  ? 'Desmarque datas em que o cliente não puder vir — R$ 50,00 serão abatidos automaticamente por corte desmarcado.'
                  : 'Desmarque datas em que o cliente não puder vir — uma data de compensação será adicionada ao final.'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                {selectedDates.length}/{isNoDiscountPackage ? baseDates.length : targetSessions} sessões confirmadas
              </span>
            </div>
          </div>

          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {candidateDates.map((dateStr) => {
              const isExcluded = excludedDates.includes(dateStr)
              const isSelected = !isExcluded
              const valItem = validationResult.find(r => r.date === dateStr)
              const isAvailable = valItem ? valItem.available : true
              const isCompensation = !baseDates.includes(dateStr)

              return (
                <div
                  key={dateStr}
                  onClick={() => toggleDateSelection(dateStr)}
                  className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                    isExcluded
                      ? 'bg-secondary/30 border-border/30 opacity-60'
                      : !isAvailable
                      ? 'bg-destructive/10 border-destructive/40 shadow-sm'
                      : 'bg-background border-border/60 hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="w-4 h-4 accent-primary rounded cursor-pointer shrink-0"
                    />
                    <div className="flex flex-col">
                      <span className={`font-semibold flex items-center gap-1.5 ${
                        isExcluded
                          ? 'text-muted-foreground line-through'
                          : !isAvailable
                          ? 'text-destructive font-bold'
                          : 'text-foreground'
                      }`}>
                        {formatDatePt(dateStr)} ({WEEKDAY_SHORT[dayOfWeek]}) às {timeSlot}
                        {isCompensation && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25">
                            Compensação +1
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isExcluded ? (
                      <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/50">
                        {isNoDiscountPackage ? 'Desmarcado (-R$ 50,00)' : 'Desmarcado (sem agendamento)'}
                      </span>
                    ) : isAvailable ? (
                      <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/25 flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-500" /> Livre ✓
                      </span>
                    ) : (
                      <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/25 flex items-center gap-1">
                        <X className="w-3 h-3 text-destructive" /> Conflito ✕
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {hasConflict && (
            <p className="text-[11px] text-destructive font-bold bg-destructive/10 p-2.5 rounded-lg border border-destructive/20 text-center">
              ⚠ Existem conflitos em {selectedConflicts.length} data(s) agendada(s). Desmarque as datas conflitantes ou escolha outro horário/dia.
            </p>
          )}

          {!hasConflict && selectedDates.length === targetSessions && (
            <p className="text-[11px] text-emerald-500 font-bold bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20 text-center">
              ✓ Todas as {selectedDates.length} datas selecionadas estão livres na agenda!
            </p>
          )}
        </div>
      )}

      {loadingValidation && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" /> Validando datas na agenda...
        </div>
      )}

      {/* Helper hints explaining why button is disabled */}
      {!customerId && !customerSearch.trim() && (
        <p className="text-[11px] text-amber-400 font-semibold bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 text-center">
          💡 Selecione um cliente no menu ou digite o nome no campo 1.
        </p>
      )}
      {!customerId && customerSearch.trim() && (
        <p className="text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20 text-center">
          ✨ O pacote será gerado para o novo cliente <strong>"{customerSearch.trim()}"</strong>!
        </p>
      )}
      {(customerId || customerSearch.trim()) && !barberId && (
        <p className="text-[11px] text-amber-400 font-semibold bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 text-center">
          💡 Selecione o barbeiro responsável no campo 1.
        </p>
      )}
      {(customerId || customerSearch.trim()) && barberId && !serviceId && (
        <p className="text-[11px] text-amber-400 font-semibold bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 text-center">
          💡 Selecione o serviço do pacote no campo 2.
        </p>
      )}
      {(customerId || customerSearch.trim()) && barberId && serviceId && !timeSlot && (
        <p className="text-[11px] text-amber-400 font-semibold bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 text-center">
          💡 Escolha o horário fixo das sessões no campo 3.
        </p>
      )}

      {/* Submit Button & Cancel */}
      <div className="flex items-center gap-2.5 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="py-3.5 px-4 bg-secondary hover:bg-muted text-foreground font-semibold rounded-xl text-xs transition-all cursor-pointer"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={
            isPending ||
            loadingValidation ||
            (!customerId && !customerSearch.trim()) ||
            !barberId ||
            !serviceId ||
            !timeSlot ||
            !startDate ||
            !packagePrice ||
            hasConflict
          }
          className="flex-1 py-3.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin text-primary-foreground" /> Criando Pacote Mensal...</>
          ) : (
            <><Crown className="w-4 h-4 text-primary-foreground" /> Confirmar e Gerar Pacote ({selectedDates.length} sessões)</>
          )}
        </button>
      </div>
    </form>
  )
}
