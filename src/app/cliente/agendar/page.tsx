'use client'

import React, { useState, useEffect, useTransition, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { 
  Scissors, Calendar, Clock, ChevronRight, ChevronLeft, 
  Check, AlertCircle, ArrowLeft, Loader2, DollarSign, 
  MessageSquare, User, CheckCircle2 
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { createAppointmentAction, getBarberMonthAvailabilityAction } from './actions'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { formatWhatsAppLink } from '@/lib/settings'
import { CompleteProfileModal } from '@/components/CompleteProfileModal'
import { BookingErrorBoundary } from '@/components/BookingErrorBoundary'

// Local fallbacks in case database is empty
const STATIC_SERVICES = [
  { id: '1', name: 'Corte', duration: 60, price: 50.00, description: 'Corte clássico ou moderno com acabamento na navalha.' },
  { id: '2', name: 'Cabelo + Barba', duration: 90, price: 85.00, description: 'Serviço completo de corte e barba com toalha quente.' },
  { id: '3', name: 'Infantil', duration: 40, price: 50.00, description: 'Corte infantil com paciência e estilo para os pequenos.' },
  { id: '4', name: 'Barba', duration: 30, price: 45.00, description: 'Alinhamento de barba com terapia de toalha quente.' }
]

const STATIC_BARBERS = [
  { id: 'sergio-uuid', name: 'Sergio Sanchez', role: 'Barbeiro Master' },
  { id: 'enzo-uuid', name: 'Enzo', role: 'Especialista' }
]

function AgendarWizardInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preSelectedBarberId = searchParams.get('barberId')
  const [step, setStep] = useState(1)
  
  // Database state
  const [barbers, setBarbers] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [loadingDb, setLoadingDb] = useState(true)

  // Profile check state
  const [profile, setProfile] = useState<any>(null)
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false)

  // Calendar UI State
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date())
  const [monthAvailability, setMonthAvailability] = useState<Record<string, any>>({})
  const [loadingCalendar, setLoadingCalendar] = useState(false)

  const isProfileIncomplete = (prof: any) => {
    if (!prof) return false
    const name = prof.full_name || ''
    const hasMultipleWords = name.trim().split(/\s+/).length >= 2
    const phone = prof.phone || ''
    const isPhoneEmpty = !phone.trim()

    return !name.trim() || !hasMultipleWords || isPhoneEmpty
  }

  const handleProfileComplete = (fullName: string, phone: string) => {
    setIsCompleteModalOpen(false)
    setProfile((prev: any) => prev ? { ...prev, full_name: fullName, phone } : null)
  }

  // Selection states
  const [selectedBarber, setSelectedBarber] = useState<any>(null)
  const [selectedService, setSelectedService] = useState<any>(null)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedTime, setSelectedTime] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)

  // Time slots logic
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Booking submit transition
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState('')
  const [successInfo, setSuccessInfo] = useState<any>(null)
  const [settings, setSettings] = useState<any>(null)

  // Pix generation state
  const [pixPayload, setPixPayload] = useState<string>('')
  const [pixQrCode, setPixQrCode] = useState<string>('')
  const [loadingPix, setLoadingPix] = useState<boolean>(false)
  const [copiedPix, setCopiedPix] = useState<boolean>(false)

  const supabase = createClient()

  // Load general config and barbers
  useEffect(() => {
    async function loadData() {
      try {
        // Fetch profile and check completeness
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
          
          if (prof) {
            setProfile(prof)
            if (isProfileIncomplete(prof)) {
              setIsCompleteModalOpen(true)
            }
          }
        }

        // Fetch general settings
        const { data: config } = await supabase
          .from('business_settings')
          .select('*')
          .eq('key', 'general_settings')
          .single()
        if (config?.value) {
          setSettings(config.value)
        }

        // Fetch active barbers
        const { data: dbBarbers } = await supabase
          .from('barbers')
          .select('id, is_active, profiles(full_name, role)')
          .eq('is_active', true)

        if (dbBarbers && dbBarbers.length > 0) {
          const formatted = dbBarbers
            .filter((b: any) => b.profiles)
            .map((b: any) => ({
              id: b.id,
              name: (b.profiles as any).full_name,
              role: (b.profiles as any).role === 'admin' ? 'Fundador & Master' : 'Especialista'
            }))
          setBarbers(formatted)

          if (preSelectedBarberId) {
            const matched = formatted.find(b => b.id === preSelectedBarberId)
            if (matched) {
              setSelectedBarber(matched)
              setStep(2) // Skip step 1 if pre-selected
            }
          }
        } else {
          setBarbers(STATIC_BARBERS)
          if (preSelectedBarberId) {
            const matched = STATIC_BARBERS.find(b => b.id === preSelectedBarberId)
            if (matched) {
              setSelectedBarber(matched)
              setStep(2)
            }
          }
        }
      } catch (err) {
        console.error('Error loading database info, falling back:', err)
        setBarbers(STATIC_BARBERS)
        if (preSelectedBarberId) {
          const matched = STATIC_BARBERS.find(b => b.id === preSelectedBarberId)
          if (matched) {
            setSelectedBarber(matched)
            setStep(2)
          }
        }
      } finally {
        setLoadingDb(false)
      }
    }
    loadData()
  }, [supabase, preSelectedBarberId])

  // Load services dynamically based on selected barber
  useEffect(() => {
    if (!selectedBarber) {
      setServices([])
      return
    }

    async function loadBarberServices() {
      setLoadingDb(true)
      try {
        if (selectedBarber.id === 'sergio-uuid' || selectedBarber.id === 'enzo-uuid') {
          setServices(STATIC_SERVICES)
          return
        }

        const { data: dbBarberServices } = await supabase
          .from('barber_services')
          .select('price, duration, is_active, service_id, services(id, name, description)')
          .eq('barber_id', selectedBarber.id)
          .eq('is_active', true)

        if (dbBarberServices && dbBarberServices.length > 0) {
          const formattedServices = dbBarberServices
            .filter((bs: any) => bs.services)
            .map((bs: any) => ({
              id: bs.service_id,
              name: bs.services.name,
              description: bs.services.description || '',
              duration: bs.duration,
              price: Number(bs.price)
            }))
          setServices(formattedServices)
        } else {
          setServices([])
        }
      } catch (err) {
        console.error('Error loading barber services:', err)
        setServices([])
      } finally {
        setLoadingDb(false)
      }
    }

    loadBarberServices()
  }, [selectedBarber, supabase])

  // Recalculate slots when barber, service or date changes
  useEffect(() => {
    if (!selectedBarber || !selectedService || !selectedDate) {
      setSlots([])
      return
    }

    async function loadSlots() {
      setLoadingSlots(true)
      setSelectedTime('')
      try {
        // We call the API endpoint or Server Action. Since we want dynamic, we can fetch
        const res = await fetch(`/api/booking/slots?barberId=${selectedBarber.id}&dateStr=${selectedDate}&duration=${selectedService.duration}`)
        const data = await res.json()
        setSlots(data.slots || [])
      } catch (error) {
        console.error('Error fetching slots:', error)
        setSlots([])
      } finally {
        setLoadingSlots(false)
      }
    }

    loadSlots()
  }, [selectedBarber, selectedService, selectedDate])

  // Load month availability dynamically
  useEffect(() => {
    if (!selectedBarber || !selectedService) {
      setMonthAvailability({})
      return
    }

    async function loadMonthAvailability() {
      setLoadingCalendar(true)
      try {
        const year = currentMonth.getFullYear()
        const month = currentMonth.getMonth() + 1 // 1-indexed
        
        const res = await getBarberMonthAvailabilityAction(
          selectedBarber.id,
          year,
          month,
          selectedService.duration
        )

        if (res.success) {
          setMonthAvailability(res.availability)
        } else {
          setMonthAvailability({})
        }
      } catch (err) {
        console.error('Error loading month availability:', err)
        setMonthAvailability({})
      } finally {
        setLoadingCalendar(false)
      }
    }

    loadMonthAvailability()
  }, [selectedBarber, selectedService, currentMonth])

  // Generate Pix data when appointment is pre-reserved
  useEffect(() => {
    if (!successInfo) return

    async function generatePixData() {
      setLoadingPix(true)
      try {
        const { QrCodePix } = await import('qrcode-pix')
        
        // Clean transaction ID (must be alphanumeric, max 25 chars for EMV)
        const cleanTxId = (successInfo.appointmentId || '')
          .replace(/[^a-zA-Z0-9]/g, '')
          .slice(0, 25) || 'AGENDAMENTO'

        const qrCodePix = QrCodePix({
          version: '01',
          key: settings?.pixKey || '11979739903',
          name: settings?.pixName || 'Osanchez Barbearia',
          city: 'SAO PAULO',
          transactionId: cleanTxId,
          value: successInfo.deposit,
        })

        const payload = qrCodePix.payload()
        const base64 = await qrCodePix.base64()
        
        setPixPayload(payload)
        setPixQrCode(base64)
      } catch (err) {
        console.error('Error generating Pix payload/QR code:', err)
      } finally {
        setLoadingPix(false)
      }
    }

    generatePixData()
  }, [successInfo, settings])

  const handleCopyPix = async () => {
    if (!pixPayload) return
    try {
      await navigator.clipboard.writeText(pixPayload)
      setCopiedPix(true)
      setTimeout(() => {
        setCopiedPix(false)
      }, 2000)
    } catch (err) {
      console.error('Failed to copy Pix payload:', err)
    }
  }

  // Helper to generate calendar days for month grid
  const getCalendarDays = () => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth() // 0-indexed
    
    const firstDay = new Date(year, month, 1)
    const firstDayOfWeek = firstDay.getDay() // 0 = Sunday, ..., 6 = Saturday
    const totalDays = new Date(year, month + 1, 0).getDate()

    const days = []

    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({ blank: true, dateStr: '', dayNum: 0 })
    }

    for (let d = 1; d <= totalDays; d++) {
      const formattedMonth = String(month + 1).padStart(2, '0')
      const formattedDay = String(d).padStart(2, '0')
      const dateStr = `${year}-${formattedMonth}-${formattedDay}`
      days.push({ blank: false, dateStr, dayNum: d })
    }

    return days
  }

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]

  const handlePrevMonth = () => {
    const today = new Date()
    const firstOfCurrentView = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
    const firstOfToday = new Date(today.getFullYear(), today.getMonth(), 1)
    
    if (firstOfCurrentView <= firstOfToday) {
      return
    }
    
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const isPrevMonthDisabled = () => {
    const today = new Date()
    return currentMonth.getFullYear() <= today.getFullYear() && currentMonth.getMonth() <= today.getMonth()
  }

  // São Paulo local today string to check past dates and today styling
  const now = new Date()
  const todayLocalStr = now.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).split('/').reverse().join('-')

  const handleConfirmBooking = () => {
    setErrorMsg('')
    if (!acceptTerms) {
      setErrorMsg('Você deve aceitar as regras de cancelamento e comparecimento.')
      return
    }

    startTransition(async () => {
      const res = await createAppointmentAction(
        selectedBarber.id,
        selectedService.id,
        selectedDate,
        selectedTime,
        notes
      )

      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessInfo({
          appointmentId: res.appointmentId,
          barber: selectedBarber.name,
          service: selectedService.name,
          price: selectedService.price,
          deposit: selectedService.price * 0.5,
          date: selectedDate,
          time: selectedTime
        })
      }
    })
  }

  const formatDateText = (dateStr: string) => {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  if (loadingDb) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between">
        <Header />
        <div className="flex-grow flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Carregando painel de agendamento...</p>
        </div>
        <Footer />
      </div>
    )
  }

  // Render Success Screen
  if (successInfo) {
    const waMessage = encodeURIComponent(
      `Olá! Gostaria de confirmar meu agendamento na Osanchez Barbearia.\n` +
      `Código: ${successInfo.appointmentId}\n` +
      `Serviço: ${successInfo.service}\n` +
      `Barbeiro: ${successInfo.barber}\n` +
      `Data: ${formatDateText(successInfo.date)} às ${successInfo.time}\n` +
      `Sinal de 50% via Pix: R$ ${successInfo.deposit.toFixed(2)} (Aguardando comprovante)`
    )

    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-grow py-12 px-4 flex items-center justify-center">
          <div className="max-w-md w-full glass p-8 rounded-lg border border-border text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-serif font-bold text-foreground">Horário Pré-Reservado!</h2>
              <p className="text-xs text-muted-foreground">
                Seu agendamento foi registrado com sucesso. Para confirmar definitivamente, efetue o sinal Pix de 50%.
              </p>
            </div>

            {/* Price Details */}
            <div className="bg-secondary/40 p-5 rounded-lg border border-border/60 text-left space-y-3">
              <div className="flex justify-between text-xs text-muted-foreground border-b border-border/40 pb-2">
                <span>Serviço:</span>
                <span className="font-semibold text-foreground">{successInfo.service}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground border-b border-border/40 pb-2">
                <span>Barbeiro:</span>
                <span className="font-semibold text-foreground">{successInfo.barber}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground border-b border-border/40 pb-2">
                <span>Data/Hora:</span>
                <span className="font-semibold text-foreground">{formatDateText(successInfo.date)} às {successInfo.time}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Valor Total:</span>
                <span className="font-semibold text-foreground">R$ {successInfo.price.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-primary font-bold pt-1">
                <span>Sinal Exigido (50%):</span>
                <span>R$ {successInfo.deposit.toFixed(2)}</span>
              </div>
            </div>

            {/* Pix Info */}
            <div className="p-5 bg-secondary/35 rounded-lg border border-border/60 text-xs text-left space-y-4 shadow-inner">
              <p className="font-semibold text-primary flex items-center gap-1.5 text-sm">
                <DollarSign className="w-4 h-4 text-primary" /> Instruções de Pagamento Pix
              </p>
              
              <div className="space-y-1">
                <p className="text-muted-foreground">
                  Chave Pix {settings?.pixType === 'cnpj' ? 'CNPJ' : settings?.pixType === 'email' ? 'E-mail' : settings?.pixType === 'phone' ? 'Celular' : settings?.pixType === 'evp' ? 'Chave Aleatória (EVP)' : 'CNPJ'}:{' '}
                  <span className="font-mono text-foreground font-semibold text-sm">{settings?.pixKey || '12.345.678/0001-90'}</span>
                </p>
                <p className="text-[10px] text-muted-foreground leading-normal">
                  Efetue a transferência do sinal de 50% (R$ {successInfo.deposit.toFixed(2)}) e envie o comprovante pelo WhatsApp clicando no botão abaixo para aprovação manual.
                </p>
              </div>

              {/* QR Code and Copia e Cola */}
              <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-background/50 rounded-lg border border-border/40">
                {loadingPix ? (
                  <div className="w-32 h-32 flex flex-col items-center justify-center bg-secondary/50 rounded border border-border/30 gap-1.5 shrink-0">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-wider">Gerando QR...</span>
                  </div>
                ) : pixQrCode ? (
                  <div className="bg-white p-2 rounded-lg shrink-0 border border-border shadow-md">
                    <img 
                      src={pixQrCode} 
                      alt="QR Code Pix" 
                      className="w-32 h-32 block"
                    />
                  </div>
                ) : (
                  <div className="w-32 h-32 flex flex-col items-center justify-center bg-secondary/50 rounded border border-border/30 text-[9px] text-rose-500 shrink-0 text-center px-2">
                    Falha ao gerar QR Code
                  </div>
                )}

                <div className="flex-grow space-y-2.5 w-full text-center sm:text-left">
                  <p className="text-[11px] font-semibold text-foreground">Pague com o Pix Copia e Cola ou QR Code</p>
                  <p className="text-[10px] text-muted-foreground leading-normal font-sans">
                    Você pode escanear o QR Code ao lado ou copiar o código Pix abaixo para realizar o pagamento no aplicativo do seu banco.
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyPix}
                    disabled={!pixPayload}
                    className={`w-full sm:w-auto px-4 py-2 rounded text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer ${
                      copiedPix
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-primary hover:bg-primary-hover text-primary-foreground'
                    }`}
                  >
                    {copiedPix ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5" />
                        Copiar código Pix
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* WA button */}
            <a
              href={formatWhatsAppLink(settings?.whatsapp || '5511999999999', waMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs transition-all shadow-md flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-4 h-4 text-white" />
              Enviar Comprovante no WhatsApp
            </a>

            <div className="pt-2">
              <Link href="/cliente" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                Ir para Meus Agendamentos
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      <Header />

      <main className="flex-grow py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header Wizard Info */}
          <div className="flex justify-between items-center pb-4 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Scissors className="w-5 h-5 text-primary rotate-45" />
              <h1 className="text-xl font-serif font-bold text-foreground">Novo Agendamento</h1>
            </div>
            <span className="text-xs text-muted-foreground">Passo {step} de 5</span>
          </div>

          {/* Form Card */}
          <div className="glass p-6 sm:p-8 rounded-lg border border-border shadow-2xl space-y-6">
            
            {errorMsg && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded flex items-start gap-2 text-xs text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <BookingErrorBoundary>
              {/* STEP 1: Select Barber */}
              {step === 1 && (
              <div key="step-1" className="space-y-4">
                <h3 className="font-serif font-semibold text-lg text-foreground">Escolha o Profissional</h3>
                <p className="text-xs text-muted-foreground">Selecione o barbeiro de sua preferência para realizar o serviço</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {barbers.map((barber) => (
                    <button
                      key={barber.id}
                      onClick={() => setSelectedBarber(barber)}
                      className={`p-5 rounded-lg border text-left flex items-center justify-between transition-all cursor-pointer ${
                        selectedBarber?.id === barber.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground/35 bg-secondary/35'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-serif font-bold">
                          {barber.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-serif font-semibold text-sm text-foreground">{barber.name}</h4>
                          <span className="text-[10px] text-primary">{barber.role}</span>
                        </div>
                      </div>
                      {selectedBarber?.id === barber.id && <Check className="w-5 h-5 text-primary shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 2: Select Service */}
            {step === 2 && (
              <div key="step-2" className="space-y-4">
                <h3 className="font-serif font-semibold text-lg text-foreground">Selecione o Serviço</h3>
                <p className="text-xs text-muted-foreground">Escolha qual serviço gostaria de fazer hoje</p>

                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {services.length > 0 ? (
                    services.map((service) => (
                      <button
                        key={service.id}
                        onClick={() => setSelectedService(service)}
                        className={`w-full p-4 rounded-lg border text-left flex items-start justify-between transition-all cursor-pointer ${
                          selectedService?.id === service.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-muted-foreground/35 bg-secondary/35'
                        }`}
                      >
                        <div className="space-y-1 pr-4">
                          <h4 className="font-serif font-semibold text-sm text-foreground">{service.name}</h4>
                          <p className="text-[11px] text-muted-foreground line-clamp-1">{service.description}</p>
                          <span className="inline-block text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded font-mono uppercase mt-1">
                            {service.duration} min
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-serif font-bold text-primary">R$ {Number(service.price).toFixed(2)}</span>
                          {selectedService?.id === service.id && <Check className="w-4 h-4 text-primary" />}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-6 bg-secondary/20 rounded border border-border text-center text-xs text-muted-foreground">
                      Este profissional ainda não possui serviços cadastrados. Por favor, volte e escolha outro profissional.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 3: Select Date */}
            {step === 3 && (
              <div key="step-3" className="space-y-4">
                <div className="border-b border-border/40 pb-2">
                  <h3 className="font-serif font-semibold text-lg text-foreground">Selecione a Data</h3>
                  <p className="text-xs text-muted-foreground">Escolha um dos próximos dias disponíveis para agendamento (Domingo e Segunda fechados)</p>
                </div>

                {/* Calendar Header with Navigation */}
                <div className="flex items-center justify-between bg-secondary/40 border border-border/50 rounded-t-lg p-4">
                  <span className="font-serif font-bold text-sm text-foreground uppercase tracking-wider">
                    {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isPrevMonthDisabled() || loadingCalendar}
                      onClick={handlePrevMonth}
                      className="p-1.5 rounded bg-secondary border border-border hover:bg-muted text-foreground disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      aria-label="Mês anterior"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={loadingCalendar}
                      onClick={handleNextMonth}
                      className="p-1.5 rounded bg-secondary border border-border hover:bg-muted text-foreground disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      aria-label="Próximo mês"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Calendar Grid Container */}
                <div className="glass border-x border-b border-border/50 rounded-b-lg p-4 relative min-h-[280px]">
                  
                  {loadingCalendar && (
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] flex flex-col items-center justify-center gap-1.5 z-10 rounded-b-lg">
                      <Loader2 className="w-7 h-7 animate-spin text-primary" />
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Carregando Calendário...</span>
                    </div>
                  )}

                  {/* Weekdays header */}
                  <div className="grid grid-cols-7 gap-1 text-center mb-2">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((wd) => (
                      <span key={wd} className="text-[10px] uppercase font-bold text-muted-foreground py-1">
                        {wd}
                      </span>
                    ))}
                  </div>

                  {/* Days grid */}
                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                    {getCalendarDays().map((day, idx) => {
                      if (day.blank) {
                        return <div key={`blank-${idx}`} className="aspect-square" />
                      }

                      const dateStr = day.dateStr
                      const dayVal = day.dayNum
                      const isToday = dateStr === todayLocalStr
                      const isSelected = selectedDate === dateStr
                      
                      const avail = monthAvailability[dateStr]
                      const isPast = dateStr < todayLocalStr
                      
                      const isClosed = isPast ? false : (avail?.isClosed ?? false)
                      const isFullyBooked = isPast ? false : (avail?.isFullyBooked ?? false)
                      const hasSlots = isPast ? false : (avail?.hasSlots ?? false)
                      
                      const isDisabled = isPast || isClosed || isFullyBooked

                      let btnClasses = "aspect-square rounded-lg border text-center flex flex-col items-center justify-center gap-0.5 text-xs font-semibold relative transition-all "
                      let statusText = null

                      if (isSelected) {
                        btnClasses += "border-primary bg-primary text-primary-foreground shadow-lg scale-105 z-10 cursor-pointer font-bold"
                      } else if (isDisabled) {
                        btnClasses += "border-border/30 bg-secondary/10 text-muted-foreground/30 opacity-40 cursor-not-allowed "
                        if (isClosed) {
                          btnClasses += "line-through"
                        }
                      } else {
                        btnClasses += "border-border hover:border-primary/60 bg-secondary/35 text-foreground cursor-pointer hover:bg-primary/5 active:scale-95"
                      }

                      if (isClosed && !isPast) {
                        statusText = <span className="text-[7px] text-muted-foreground/45 uppercase font-bold block scale-75 truncate max-w-full">Folga</span>
                      } else if (isFullyBooked && !isPast) {
                        statusText = <span className="text-[7px] text-rose-500/60 uppercase font-bold block scale-75 truncate max-w-full font-sans">Lotado</span>
                      } else if (hasSlots && !isPast && !isSelected) {
                        statusText = <span className="text-[7px] text-primary/70 uppercase font-bold block scale-75 truncate max-w-full">Livre</span>
                      }

                      return (
                        <button
                          key={dateStr}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => setSelectedDate(dateStr)}
                          className={btnClasses}
                        >
                          <span className="text-xs sm:text-sm">{dayVal}</span>
                          {statusText}
                          
                          {isToday && !isSelected && (
                            <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: Select Time Slot */}
            {step === 4 && (
              <div key="step-4" className="space-y-4">
                <h3 className="font-serif font-semibold text-lg text-foreground">Escolha o Horário</h3>
                <p className="text-xs text-muted-foreground">Horários disponíveis para {selectedBarber?.name} em {formatDateText(selectedDate)}</p>

                {loadingSlots ? (
                  <div key="loading-slots" className="py-8 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">Calculando horários livres...</span>
                  </div>
                ) : slots.length > 0 ? (
                  <div key="slots-grid" className="grid grid-cols-3 sm:grid-cols-6 gap-2 max-h-60 overflow-y-auto pr-1">
                    {slots.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => setSelectedTime(slot)}
                        className={`py-2 rounded border text-center font-semibold text-xs transition-all cursor-pointer ${
                          selectedTime === slot
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border hover:border-primary/40 bg-secondary/30 text-foreground'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div key="no-slots-fallback" className="p-6 bg-secondary/20 rounded border border-border text-center text-xs text-muted-foreground">
                    Infelizmente, todos os horários estão preenchidos para este profissional na data escolhida. Por favor, volte e escolha outro dia ou outro barbeiro.
                  </div>
                )}
              </div>
            )}

            {/* STEP 5: Review & Confirm */}
            {step === 5 && (
              <div key="step-5" className="space-y-4">
                <h3 className="font-serif font-semibold text-lg text-foreground">Revisar Agendamento</h3>
                <p className="text-xs text-muted-foreground">Revise os detalhes da sua reserva antes de submeter</p>

                <div className="space-y-3 bg-secondary/35 p-5 rounded-lg border border-border/60">
                  <div className="flex justify-between items-center border-b border-border/40 pb-2.5 text-xs text-muted-foreground">
                    <span>Profissional:</span>
                    <span className="font-semibold text-foreground">{selectedBarber?.name}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-border/40 pb-2.5 text-xs text-muted-foreground">
                    <span>Serviço Escolhido:</span>
                    <span className="font-semibold text-foreground">{selectedService?.name} ({selectedService?.duration}min)</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-border/40 pb-2.5 text-xs text-muted-foreground">
                    <span>Data Reservada:</span>
                    <span className="font-semibold text-foreground">{formatDateText(selectedDate)}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-border/40 pb-2.5 text-xs text-muted-foreground">
                    <span>Horário Reservado:</span>
                    <span className="font-semibold text-foreground">{selectedTime}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-muted-foreground pb-2">
                    <span>Preço Total do Serviço:</span>
                    <span className="font-semibold text-foreground">R$ {Number(selectedService?.price).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold text-primary pt-1.5 border-t border-border/40">
                    <span>Sinal via Pix (50%):</span>
                    <span>R$ {(Number(selectedService?.price) * 0.5).toFixed(2)}</span>
                  </div>
                </div>

                {/* Additional Notes */}
                <div className="space-y-1.5">
                  <label htmlFor="notes" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Observações / Notas (Opcional)</label>
                  <textarea
                    id="notes"
                    placeholder="Ex: Gostaria de corte baixo na lateral, tenho alergia a certa pomada..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={isPending}
                    rows={2}
                    className="w-full p-3 bg-secondary border border-border focus:border-primary rounded text-xs text-foreground placeholder:text-muted-foreground outline-none resize-none"
                  />
                </div>

                {/* Confirm Rules Accept */}
                <label className="flex items-start gap-2.5 text-xs text-muted-foreground cursor-pointer select-none pt-2">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    disabled={isPending}
                    className="mt-0.5 rounded accent-primary w-4 h-4 cursor-pointer"
                    required
                  />
                  <span>
                    Confirmo o agendamento e declaro-me ciente de que atrasos superiores a <strong>10 minutos</strong> configuram no-show, e de que o cancelamento do sinal integral exige aviso de{' '}
                    <strong>2 horas</strong> de antecedência.
                  </span>
                </label>
              </div>
            )}
            </BookingErrorBoundary>

            {/* Navigation Buttons */}
            <div className="flex justify-between gap-4 border-t border-border/40 pt-4 mt-6">
              {step > 1 ? (
                <button
                  onClick={() => setStep(step - 1)}
                  disabled={isPending}
                  className="px-4 py-2.5 bg-secondary hover:bg-muted text-foreground border border-border rounded text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Voltar
                </button>
              ) : (
                <Link
                  href="/cliente"
                  className="px-4 py-2.5 bg-secondary hover:bg-muted text-foreground border border-border rounded text-xs font-semibold flex items-center gap-1 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Cancelar
                </Link>
              )}

              {step < 5 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={
                    (step === 1 && !selectedBarber) ||
                    (step === 2 && !selectedService) ||
                    (step === 3 && !selectedDate) ||
                    (step === 4 && !selectedTime)
                  }
                  className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-primary-foreground rounded text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
                >
                  Continuar
                  <ChevronRight className="w-4 h-4 text-primary-foreground" />
                </button>
              ) : (
                <button
                  onClick={handleConfirmBooking}
                  disabled={isPending || !acceptTerms}
                  className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-primary-foreground rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
                >
                  {isPending ? (
                    <span key="loading" className="flex items-center gap-1.5 justify-center">
                      <Loader2 className="w-4 h-4 animate-spin text-primary-foreground" />
                      Registrando...
                    </span>
                  ) : (
                    <span key="normal" className="flex items-center gap-1.5 justify-center">
                      Confirmar Agendamento
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </span>
                  )}
                </button>
              )}
            </div>

          </div>
        </div>
      </main>

      <Footer />

      <CompleteProfileModal
        isOpen={isCompleteModalOpen}
        initialFullName={profile?.full_name || ''}
        isBlocking={true}
        onComplete={handleProfileComplete}
      />
    </div>
  )
}

export default function AgendarWizard() {
  return (
    <Suspense fallback={
      <div className="flex flex-col min-h-screen bg-background items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <AgendarWizardInner />
    </Suspense>
  )
}

