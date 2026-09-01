'use client'

import React, { useState, useEffect, useTransition, Suspense, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { 
  Scissors, Calendar, Clock, ChevronRight, ChevronLeft, 
  Check, AlertCircle, ArrowLeft, Loader2, DollarSign, 
  MessageSquare, User, CheckCircle2, QrCode, Banknote, CreditCard, Star, Award, Sparkles, Sunrise, Sun, Moon, ShieldCheck 
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { createAppointmentAction, getBarberMonthAvailabilityAction, checkNoShowFeeAction } from './actions'
import type { NoShowFeeInfo } from '@/lib/no-show'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { formatWhatsAppLink } from '@/lib/settings'
import { apptShortCode } from '@/lib/utils'
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
  {
    id: 'sergio-uuid',
    name: 'Sergio Sanchez',
    role: 'Fundador & Master',
    bio: 'Especialista em visagismo facial e cortes de alto nível.',
    avatar_url: '/barbers/sergio.jpg',
    specialties: ['Cortes Clássicos', 'Visagismo Facial', 'Barba Terapia'],
    experience_years: 10,
    rating: '0.0'
  },
  {
    id: 'enzo-uuid',
    name: 'Enzo',
    role: 'Barbeiro Especialista',
    bio: 'Especialista em cortes contemporâneos, degradê de precisão e design de barba.',
    avatar_url: '',
    specialties: ['Fade / Degradê', 'Design de Barba', 'Corte Moderno'],
    experience_years: 5,
    rating: '0.0'
  }
]

// Picks a distinct line icon per service category so cards don't all look identical
function ServiceIcon({ name, className }: { name: string; className?: string }) {
  const n = (name || '').toLowerCase()
  const hasCabelo = n.includes('cabelo') || n.includes('corte')
  const hasBarba = n.includes('barba')

  if (hasCabelo && hasBarba) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="6" cy="6" r="2.6" /><circle cx="6" cy="18" r="2.6" />
        <line x1="19" y1="5" x2="9" y2="14" /><line x1="9" y1="10" x2="19" y2="19" />
      </svg>
    )
  }
  if (hasBarba) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M5 19 L14 10" /><path d="M12.5 8.5 L18.5 14.5 L15 18 L9 12 Z" />
      </svg>
    )
  }
  if (n.includes('infantil') || n.includes('kids') || n.includes('criança') || n.includes('crianca')) {
    return <Star className={className} />
  }
  return <Scissors className={className} />
}

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
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'cash' | 'card'>('pix')
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

  // No-show fee state
  const [noShowFeeInfo, setNoShowFeeInfo] = useState<NoShowFeeInfo | null>(null)

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

          // Check for outstanding no-show fee
          const feeInfo = await checkNoShowFeeAction()
          if (feeInfo) {
            setNoShowFeeInfo(feeInfo)
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
          .select('id, is_active, bio, avatar_url, photo_url, specialties, experience_years, profiles(full_name, role)')
          .eq('is_active', true)

        // Fetch approved reviews to compute real rating
        const { data: approvedReviews } = await supabase
          .from('reviews')
          .select('barber_id, rating')
          .eq('status', 'approved')

        const ratingsMap: Record<string, { total: number; count: number }> = {}
        if (approvedReviews && approvedReviews.length > 0) {
          approvedReviews.forEach(r => {
            if (!ratingsMap[r.barber_id]) ratingsMap[r.barber_id] = { total: 0, count: 0 }
            ratingsMap[r.barber_id].total += r.rating
            ratingsMap[r.barber_id].count += 1
          })
        }

        if (dbBarbers && dbBarbers.length > 0) {
          const formatted = dbBarbers
            .filter((b: any) => b.profiles)
            .map((b: any) => {
              const fullName = (b.profiles as any).full_name || 'Barbeiro'
              const isSergio = fullName.toLowerCase().includes('sergio')
              const stats = ratingsMap[b.id]
              const calcRating = stats && stats.count > 0 ? (stats.total / stats.count).toFixed(1) : '0.0'

              return {
                id: b.id,
                name: fullName,
                role: (b.profiles as any).role === 'admin' ? 'Fundador & Master' : 'Barbeiro Especialista',
                bio: b.bio || 'Barbeiro profissional da equipe Osanchez Barbearia.',
                avatar_url: b.photo_url || b.avatar_url || (isSergio ? '/barbers/sergio.jpg' : ''),
                specialties: b.specialties && b.specialties.length > 0
                  ? b.specialties
                  : (isSergio ? ['Cortes Clássicos', 'Visagismo Facial', 'Barba Terapia'] : ['Fade / Degradê', 'Design de Barba', 'Corte Moderno']),
                experience_years: b.experience_years || (isSergio ? 10 : 5),
                rating: calcRating
              }
            })
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
          .select('price, duration, is_active, service_id, description, services(id, name, description)')
          .eq('barber_id', selectedBarber.id)
          .eq('is_active', true)

        if (dbBarberServices && dbBarberServices.length > 0) {
          const formattedServices = dbBarberServices
            .filter((bs: any) => bs.services)
            .map((bs: any) => ({
              id: bs.service_id,
              name: bs.services.name,
              description: (bs.description && bs.description.trim() !== '') ? bs.description.trim() : (bs.services.description || ''),
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

        // Format the Pix key based on key type
        const rawKey = settings?.pixKey || '11979739903'
        const rawType = settings?.pixType || 'phone'
        
        let formattedKey = rawKey.trim()
        if (rawType === 'phone' || rawType === 'celular' || /^\d{10,11}$/.test(formattedKey.replace(/\D/g, ''))) {
          // If it is a phone key, format it to international format with '+' sign: +55...
          let digits = formattedKey.replace(/\D/g, '')
          if (digits.length === 10 || digits.length === 11) {
            digits = '55' + digits
          }
          formattedKey = `+${digits}`
        } else if (rawType === 'cnpj' || rawType === 'cpf') {
          // CNPJ/CPF keys should be digits only
          formattedKey = formattedKey.replace(/\D/g, '')
        }

        // Clean beneficiary name to ASCII-only uppercase and enforce 25 char limit
        const rawName = settings?.pixName || 'Osanchez Barbearia'
        const cleanName = rawName
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9 ]/g, '')
          .toUpperCase()
          .slice(0, 25)
          .trim() || 'OSANCHEZ BARBEARIA'

        const cleanCity = 'SAO PAULO' // 9 characters (limit is 15)

        const qrCodePix = QrCodePix({
          version: '01',
          key: formattedKey,
          name: cleanName,
          city: cleanCity,
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
    let copySuccessful = false
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(pixPayload)
        copySuccessful = true
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = pixPayload
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        copySuccessful = document.execCommand('copy')
        document.body.removeChild(textarea)
      }
    } catch (err) {
      console.error('Failed to copy Pix payload using clipboard API, trying fallback:', err)
      try {
        const textarea = document.createElement('textarea')
        textarea.value = pixPayload
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        copySuccessful = document.execCommand('copy')
        document.body.removeChild(textarea)
      } catch (fallbackErr) {
        console.error('Fallback copy also failed:', fallbackErr)
      }
    }

    if (copySuccessful) {
      setCopiedPix(true)
      setTimeout(() => {
        setCopiedPix(false)
      }, 3000)
    }
  }

  // Helper to generate calendar days for month grid (memoized to prevent re-computation)
  const calendarDays = useMemo(() => {
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
  }, [currentMonth])

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]

  const handlePrevMonth = useCallback(() => {
    const today = new Date()
    const firstOfCurrentView = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
    const firstOfToday = new Date(today.getFullYear(), today.getMonth(), 1)
    
    if (firstOfCurrentView <= firstOfToday) {
      return
    }
    
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }, [currentMonth])

  const handleNextMonth = useCallback(() => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }, [])

  const isPrevMonthDisabled = useCallback(() => {
    const today = new Date()
    return currentMonth.getFullYear() <= today.getFullYear() && currentMonth.getMonth() <= today.getMonth()
  }, [currentMonth])

  // São Paulo local today string to check past dates and today styling
  const todayLocalStr = useMemo(() => {
    const now = new Date()
    return now.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).split('/').reverse().join('-')
  }, [])

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
        notes,
        paymentMethod
      )

      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        const feeAmount = noShowFeeInfo?.fee || 0
        const totalPrice = selectedService.price + feeAmount
        setSuccessInfo({
          appointmentId: res.appointmentId,
          customerName: profile?.full_name || '',
          barber: selectedBarber.name,
          service: selectedService.name,
          price: totalPrice,
          deposit: totalPrice * 0.5,
          date: selectedDate,
          time: selectedTime,
          method: paymentMethod
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
    // Plain-text message: formatWhatsAppLink calls encodeURIComponent() once internally.
    // Do NOT pre-encode; double-encoding produces raw %20/%0A/%C3%A1 visible to the user.
    const shortCode = apptShortCode(successInfo.appointmentId)
    const senderName = successInfo.customerName || 'Cliente'
    const isPix = !successInfo.method || successInfo.method === 'pix'
    const methodLabel = successInfo.method === 'cash' ? 'Dinheiro' : successInfo.method === 'card' ? 'Cartão' : 'Pix'

    const waMessage = isPix
      ? [
          `Olá! Sou ${senderName} e gostaria de confirmar meu agendamento na Osanchez Barbearia.`,
          `Código: ${shortCode}`,
          `Serviço: ${successInfo.service} — ${successInfo.barber}`,
          `Data: ${formatDateText(successInfo.date)} às ${successInfo.time}`,
          `Sinal de 50% via Pix: R$ ${successInfo.deposit.toFixed(2)} (Aguardando comprovante)`,
        ].join('\n')
      : [
          `Olá! Sou ${senderName} e gostaria de confirmar meu agendamento na Osanchez Barbearia.`,
          `Código: ${shortCode}`,
          `Serviço: ${successInfo.service} — ${successInfo.barber}`,
          `Data: ${formatDateText(successInfo.date)} às ${successInfo.time}`,
          `Forma de pagamento: ${methodLabel} (pagamento presencial)`,
        ].join('\n')

    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-grow py-12 px-4 flex items-center justify-center">
          <div className="max-w-md w-full glass p-8 rounded-lg border border-border text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-serif font-bold text-foreground">
                {isPix ? 'Horário Pré-Reservado!' : 'Horário Agendado!'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isPix
                  ? 'Seu agendamento foi registrado com sucesso. Para confirmar definitivamente, efetue o sinal Pix de 50%.'
                  : 'Pagamento na barbearia — Você poderá pagar pessoalmente no dia do atendimento.'}
              </p>
            </div>

            {/* Price Details */}
            <div className="bg-secondary/40 p-5 rounded-lg border border-border/60 text-left space-y-3">
              {/* Short reference code — prominently at top */}
              <div className="flex justify-between items-center border-b border-border/40 pb-2">
                <span className="text-xs text-muted-foreground">Ref. Agendamento:</span>
                <span className="font-mono font-bold text-primary tracking-widest text-sm">{shortCode}</span>
              </div>
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
              {isPix ? (
                <div className="flex justify-between text-sm text-primary font-bold pt-1 border-t border-border/40">
                  <span>Sinal Exigido (50%):</span>
                  <span>R$ {successInfo.deposit.toFixed(2)}</span>
                </div>
              ) : (
                <div className="flex justify-between text-xs text-primary font-bold pt-1 border-t border-border/40">
                  <span>Forma de Pagamento:</span>
                  <span>{methodLabel} (Presencial)</span>
                </div>
              )}
            </div>

            {/* Pix Info OR Presencial Info */}
            {isPix ? (
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
                    <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleCopyPix}
                        disabled={!pixPayload}
                        className={`w-full sm:w-auto px-4 py-2 rounded text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer ${
                          copiedPix
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                            : 'bg-primary hover:bg-primary-hover text-primary-foreground'
                        }`}
                      >
                        {copiedPix ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-white" />
                            Copiado com Sucesso!
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5" />
                            Copiar código Pix
                          </>
                        )}
                      </button>

                      {copiedPix && (
                        <div className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-200">
                          <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                          <span>Código Pix copiado para a área de transferência!</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-5 bg-secondary/35 rounded-lg border border-border/60 text-xs text-left space-y-3 shadow-inner">
                <p className="font-semibold text-primary flex items-center gap-1.5 text-sm">
                  {successInfo.method === 'cash' ? (
                    <Banknote className="w-4.5 h-4.5 text-emerald-500" />
                  ) : (
                    <CreditCard className="w-4.5 h-4.5 text-sky-500" />
                  )}
                  Pagamento na barbearia
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Você poderá pagar pessoalmente no dia do atendimento.
                </p>
                <div className="p-3 bg-background/50 rounded border border-border/40 text-[11px] space-y-1">
                  <span className="text-muted-foreground block">Opção selecionada:</span>
                  <span className="font-bold text-foreground block">
                    {successInfo.method === 'cash' ? 'Dinheiro' : 'Cartão (Débito / Crédito)'} — Presencial
                  </span>
                </div>
              </div>
            )}

            {/* WA button */}
            <a
              href={formatWhatsAppLink(settings?.whatsapp, waMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs transition-all shadow-md flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-4 h-4 text-white" />
              {isPix ? 'Enviar Comprovante no WhatsApp' : 'Confirme seu horário aqui'}
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
            <span className="text-xs text-muted-foreground">Passo {step} de 6</span>
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
                <div key="step-1" className="space-y-6 animate-in fade-in-50 duration-300">
                  <div className="space-y-1.5 text-left border-b border-border/40 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-semibold text-[10px] uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-primary" /> Passo 1 de 6
                      </span>
                      <span className="text-xs text-muted-foreground">• Seleção de Profissional</span>
                    </div>
                    <h3 className="font-serif font-bold text-xl sm:text-2xl text-foreground">Escolha o Profissional</h3>
                    <p className="text-xs text-muted-foreground">Selecione o especialista de sua preferência para cuidar do seu visual com excelência.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {barbers.map((barber) => {
                      const isSelected = selectedBarber?.id === barber.id
                      return (
                        <div
                          key={barber.id}
                          onClick={() => setSelectedBarber(barber)}
                          className={`relative group p-5 rounded-xl border text-left transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between ${
                            isSelected
                              ? 'border-primary bg-gradient-to-br from-primary/15 via-primary/5 to-transparent shadow-lg shadow-primary/10 ring-1 ring-primary/40'
                              : 'border-border/70 hover:border-primary/50 bg-secondary/30 hover:bg-secondary/50 shadow-sm hover:shadow-md'
                          }`}
                        >
                          {/* Background glow when selected */}
                          {isSelected && (
                            <div className="absolute -top-10 -right-10 w-28 h-28 bg-primary/20 rounded-full blur-xl pointer-events-none" />
                          )}

                          <div className="space-y-4 relative z-10">
                            {/* Card Header: Avatar + Info + Checkmark */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3.5">
                                {/* Avatar */}
                                <div className={`relative w-14 h-14 rounded-full border-2 p-0.5 shrink-0 overflow-hidden shadow-md transition-all duration-300 ${
                                  isSelected ? 'border-primary ring-2 ring-primary/30 scale-105' : 'border-border/80 group-hover:border-primary/50'
                                }`}>
                                  {barber.avatar_url ? (
                                    <img
                                      src={barber.avatar_url}
                                      alt={barber.name}
                                      className="w-full h-full object-cover rounded-full transition-transform duration-300 group-hover:scale-105"
                                    />
                                  ) : (
                                    <div className="w-full h-full rounded-full bg-gradient-to-tr from-primary/30 via-secondary to-muted flex items-center justify-center text-primary font-serif font-bold text-xl shadow-inner">
                                      {barber.name.charAt(0)}
                                    </div>
                                  )}
                                  {/* Online status indicator */}
                                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-background rounded-full" title="Disponível para agendamento" />
                                </div>

                                {/* Name & Role */}
                                <div className="space-y-1">
                                  <h4 className="font-serif font-bold text-base text-foreground group-hover:text-primary transition-colors">
                                    {barber.name}
                                  </h4>
                                  <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                    {barber.role}
                                  </span>
                                </div>
                              </div>

                              {/* Selected Badge */}
                              {isSelected ? (
                                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md animate-in zoom-in-75 duration-200 shrink-0">
                                  <Check className="w-4 h-4 text-primary-foreground stroke-[3]" />
                                </div>
                              ) : (
                                <div className="w-7 h-7 rounded-full border border-border/80 group-hover:border-primary/40 flex items-center justify-center shrink-0 transition-colors">
                                  <div className="w-2.5 h-2.5 rounded-full bg-transparent group-hover:bg-primary/30 transition-colors" />
                                </div>
                              )}
                            </div>

                            {/* Rating & Experience */}
                            <div className="flex items-center gap-3 text-xs pt-1 border-t border-border/30">
                              <div className="flex items-center gap-1 font-bold text-amber-400">
                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                <span>{barber.rating || '5.0'}</span>
                              </div>
                              <span className="text-muted-foreground/40">•</span>
                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Award className="w-3.5 h-3.5 text-primary" />
                                <span>{barber.experience_years ? `${barber.experience_years}+ anos exp.` : 'Master Barbeiro'}</span>
                              </div>
                            </div>

                            {/* Specialties tags */}
                            {barber.specialties && barber.specialties.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-0.5">
                                {barber.specialties.map((spec: string, idx: number) => (
                                  <span
                                    key={idx}
                                    className="text-[10px] px-2 py-0.5 rounded bg-background/60 text-muted-foreground border border-border/50 font-medium"
                                  >
                                    {spec}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Footer Selection Indicator */}
                          <div className={`mt-4 pt-3 border-t text-[11px] font-semibold flex items-center justify-between transition-colors ${
                            isSelected ? 'border-primary/30 text-primary' : 'border-border/40 text-muted-foreground/70 group-hover:text-foreground'
                          }`}>
                            <span>{isSelected ? 'Profissional Selecionado' : 'Clique para selecionar'}</span>
                            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isSelected ? 'translate-x-0.5 text-primary' : 'group-hover:translate-x-1'}`} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

            {/* STEP 2: Select Service */}
            {step === 2 && (
              <div key="step-2" className="space-y-6 animate-in fade-in-50 duration-300">
                <div className="space-y-1.5 text-left border-b border-border/40 pb-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-semibold text-[10px] uppercase tracking-wider flex items-center gap-1">
                        <Scissors className="w-3 h-3 text-primary" /> Passo 2 de 6
                      </span>
                      <span className="text-xs text-muted-foreground">• Seleção de Serviço</span>
                    </div>

                    {/* Selected Barber Chip */}
                    {selectedBarber && (
                      <div className="flex items-center gap-2 bg-secondary/60 border border-border/60 px-3 py-1 rounded-full text-xs">
                        <span className="text-[11px] text-muted-foreground">Barbeiro:</span>
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          {selectedBarber.name}
                        </span>
                      </div>
                    )}
                  </div>

                  <h3 className="font-serif font-bold text-xl sm:text-2xl text-foreground">Selecione o Serviço</h3>
                  <p className="text-xs text-muted-foreground">Escolha o serviço desejado com a garantia de atendimento de excelência e produtos premium.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {services.length > 0 ? (
                    services.map((service) => {
                      const isSelected = selectedService?.id === service.id
                      const [priceInt, priceDec] = Number(service.price).toFixed(2).split('.')

                      return (
                        <div
                          key={service.id}
                          onClick={() => setSelectedService(service)}
                          className={`relative p-4 rounded-2xl text-left transition-all duration-300 cursor-pointer flex flex-col gap-2 ${
                            isSelected
                              ? 'border-2 border-primary bg-gradient-to-br from-primary/[0.18] to-[#17171d] shadow-lg shadow-primary/15'
                              : 'border-[1.5px] border-white/[0.22] bg-[#17171d] hover:border-primary/50'
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center animate-in zoom-in-75 duration-200">
                              <Check className="w-3.5 h-3.5 text-primary-foreground stroke-[3]" />
                            </div>
                          )}

                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                            isSelected
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-primary/10 border border-primary/25 text-primary'
                          }`}>
                            <ServiceIcon name={service.name} className="w-5 h-5" />
                          </div>

                          <h4 className="font-serif font-bold text-sm text-foreground mt-0.5">
                            {service.name}
                          </h4>

                          <div className="font-serif font-extrabold text-xl text-primary leading-none">
                            R$&nbsp;{priceInt}<span className="text-xs font-semibold">,{priceDec}</span>
                          </div>

                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-background/50 border border-border/60 px-2 py-0.5 rounded-full w-fit mt-0.5">
                            <Clock className="w-2.5 h-2.5 text-primary" /> {service.duration} min
                          </span>
                        </div>
                      )
                    })
                  ) : (
                    <div className="col-span-2 p-8 bg-secondary/20 rounded-xl border border-border/70 text-center space-y-3 text-xs text-muted-foreground">
                      <p className="font-semibold text-foreground text-sm">Nenhum serviço encontrado</p>
                      <p>Este profissional ainda não possui serviços cadastrados nesta categoria. Por favor, volte e escolha outro profissional.</p>
                    </div>
                  )}
                </div>

                {/* ── Pacote Mensal Banner ── */}
                <div className="rounded-xl border border-primary/25 bg-gradient-to-r from-primary/10 via-secondary/30 to-background p-5 relative overflow-hidden shadow-sm hover:shadow-md transition-all mt-4">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />
                  <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-primary-foreground bg-primary px-2.5 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1 shadow-sm">
                          <Sparkles className="w-3 h-3 text-primary-foreground" /> Planos VIP Mensais
                        </span>
                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm">
                          <CreditCard className="w-3 h-3 text-emerald-400" /> Pagamento efetuado SOMENTE no 1º atendimento
                        </span>
                      </div>
                      <p className="font-serif font-bold text-base text-foreground">Prefere praticidade e máxima economia?</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        • <strong className="text-foreground">Pacote Corte:</strong> 4 cortes por <span className="font-bold text-primary">R$&nbsp;150</span> <span className="line-through text-muted-foreground/70">R$&nbsp;200</span> (Economize R$&nbsp;50).<br />
                        • <strong className="text-foreground">Pacote Cabelo + Barba:</strong> 4 combos por <span className="font-bold text-primary">R$&nbsp;250</span> <span className="line-through text-muted-foreground/70">R$&nbsp;340</span> (Economize R$&nbsp;90).
                      </p>
                    </div>
                    <a
                      href={formatWhatsAppLink(settings?.whatsapp, 'Olá! Gostaria de mais informações sobre os Pacotes Mensais (Corte R$150 ou Cabelo+Barba R$250).')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 px-5 py-3 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 cursor-pointer whitespace-nowrap group"
                    >
                      <MessageSquare className="w-4 h-4 text-primary-foreground transition-transform group-hover:scale-110" />
                      <span>Assinar no WhatsApp</span>
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Select Date */}
            {step === 3 && (
              <div key="step-3" className="space-y-6 animate-in fade-in-50 duration-300">
                <div className="space-y-1.5 text-left border-b border-border/40 pb-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-semibold text-[10px] uppercase tracking-wider flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-primary" /> Passo 3 de 6
                      </span>
                      <span className="text-xs text-muted-foreground">• Seleção de Data</span>
                    </div>

                    {/* Selected Context Chips */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedBarber && (
                        <div className="flex items-center gap-1.5 bg-secondary/60 border border-border/60 px-2.5 py-0.5 rounded-full text-[11px]">
                          <span className="text-muted-foreground">Barbeiro:</span>
                          <span className="font-semibold text-foreground">{selectedBarber.name}</span>
                        </div>
                      )}
                      {selectedService && (
                        <div className="flex items-center gap-1.5 bg-secondary/60 border border-border/60 px-2.5 py-0.5 rounded-full text-[11px]">
                          <span className="text-muted-foreground">Serviço:</span>
                          <span className="font-semibold text-primary">{selectedService.name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <h3 className="font-serif font-bold text-xl sm:text-2xl text-foreground">Escolha a Data do Atendimento</h3>
                  <p className="text-xs text-muted-foreground">Selecione um dos dias livres no calendário para consultar os horários disponíveis.</p>
                </div>

                {/* Calendar Container */}
                <div className="rounded-xl border border-border/70 bg-gradient-to-b from-secondary/30 via-background to-background p-4 sm:p-5 space-y-4 shadow-sm relative">
                  {/* Calendar Header Control Bar */}
                  <div className="flex items-center justify-between bg-secondary/60 border border-border/60 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span className="font-serif font-bold text-sm sm:text-base text-foreground uppercase tracking-wider">
                        {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isPrevMonthDisabled() || loadingCalendar}
                        onClick={handlePrevMonth}
                        className="p-2 rounded-lg bg-background border border-border hover:border-primary/50 text-foreground hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all shadow-sm"
                        aria-label="Mês anterior"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={loadingCalendar}
                        onClick={handleNextMonth}
                        className="p-2 rounded-lg bg-background border border-border hover:border-primary/50 text-foreground hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all shadow-sm"
                        aria-label="Próximo mês"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Calendar Grid Box */}
                  <div className="relative min-h-[290px]">
                    {loadingCalendar && (
                      <div className="absolute inset-0 bg-background/75 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 z-20 rounded-lg">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Verificando Agenda...</span>
                      </div>
                    )}

                    {/* Weekdays Header */}
                    <div className="grid grid-cols-7 gap-1 text-center pb-2 mb-2 border-b border-border/40">
                      {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((wd) => (
                        <span key={wd} className="text-[11px] uppercase font-bold text-muted-foreground/80 tracking-wider">
                          {wd}
                        </span>
                      ))}
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                      {calendarDays.map((day, idx) => {
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

                        let btnClasses = "aspect-square rounded-xl border text-center flex flex-col items-center justify-center gap-0.5 text-xs font-semibold relative transition-all duration-200 "
                        let statusText = null

                        if (isSelected) {
                          btnClasses += "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-105 z-10 cursor-pointer font-bold ring-2 ring-primary/40"
                        } else if (isDisabled) {
                          btnClasses += "border-border/30 bg-secondary/10 text-muted-foreground/30 opacity-40 cursor-not-allowed "
                          if (isClosed) {
                            btnClasses += "line-through"
                          }
                        } else {
                          btnClasses += "border-border/70 hover:border-primary/60 bg-secondary/30 hover:bg-primary/10 text-foreground cursor-pointer hover:scale-105 active:scale-95 shadow-sm"
                        }

                        if (isClosed && !isPast) {
                          statusText = <span className="text-[8px] text-muted-foreground/50 uppercase font-bold block truncate max-w-full">Folga</span>
                        } else if (isFullyBooked && !isPast) {
                          statusText = <span className="text-[8px] text-rose-500 uppercase font-bold block truncate max-w-full">Lotado</span>
                        } else if (hasSlots && !isPast && !isSelected) {
                          statusText = <span className="text-[8px] text-emerald-500 font-bold block truncate max-w-full">Livre</span>
                        }

                        return (
                          <button
                            key={dateStr}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => setSelectedDate(dateStr)}
                            className={btnClasses}
                          >
                            <span className={`text-xs sm:text-sm ${isSelected ? 'text-primary-foreground' : 'text-foreground'}`}>{dayVal}</span>
                            {statusText}
                            
                            {isToday && !isSelected && (
                              <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-primary shadow-sm" title="Hoje" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Calendar Legend Bar */}
                  <div className="flex flex-wrap items-center justify-center gap-4 pt-3 border-t border-border/40 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span>Disponível</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                      <span>Selecionado</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      <span>Lotado</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
                      <span>Folga / Fechado</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: Select Time Slot */}
            {step === 4 && (
              <div key="step-4" className="space-y-6 animate-in fade-in-50 duration-300">
                <div className="space-y-1.5 text-left border-b border-border/40 pb-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-semibold text-[10px] uppercase tracking-wider flex items-center gap-1">
                        <Clock className="w-3 h-3 text-primary" /> Passo 4 de 6
                      </span>
                      <span className="text-xs text-muted-foreground">• Seleção de Horário</span>
                    </div>

                    {/* Selected Context Chips */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedBarber && (
                        <div className="flex items-center gap-1.5 bg-secondary/60 border border-border/60 px-2.5 py-0.5 rounded-full text-[11px]">
                          <span className="text-muted-foreground">Barbeiro:</span>
                          <span className="font-semibold text-foreground">{selectedBarber.name}</span>
                        </div>
                      )}
                      {selectedDate && (
                        <div className="flex items-center gap-1.5 bg-secondary/60 border border-border/60 px-2.5 py-0.5 rounded-full text-[11px]">
                          <span className="text-muted-foreground">Data:</span>
                          <span className="font-semibold text-primary">{formatDateText(selectedDate)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <h3 className="font-serif font-bold text-xl sm:text-2xl text-foreground">Escolha o Horário</h3>
                  <p className="text-xs text-muted-foreground">
                    Selecione o horário ideal para o seu atendimento com {selectedBarber?.name} no dia {formatDateText(selectedDate)}.
                  </p>
                </div>

                {loadingSlots ? (
                  <div key="loading-slots" className="py-12 flex flex-col items-center justify-center gap-3 bg-secondary/20 rounded-xl border border-border/60">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <div className="text-center space-y-1">
                      <span className="text-xs font-bold text-foreground block">Buscando Horários Disponíveis</span>
                      <span className="text-[11px] text-muted-foreground">Verificando encaixes e tempo de serviço...</span>
                    </div>
                  </div>
                ) : slots.length > 0 ? (() => {
                  const morningSlots = slots.filter(s => parseInt(s.split(':')[0], 10) < 12)
                  const afternoonSlots = slots.filter(s => {
                    const hour = parseInt(s.split(':')[0], 10)
                    return hour >= 12 && hour < 18
                  })
                  const eveningSlots = slots.filter(s => parseInt(s.split(':')[0], 10) >= 18)

                  const renderSlotButton = (slot: string) => {
                    const isSelected = selectedTime === slot
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedTime(slot)}
                        className={`relative group py-2.5 px-3 rounded-xl border text-center font-bold text-xs sm:text-sm transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                          isSelected
                            ? 'border-primary bg-gradient-to-br from-primary via-primary/95 to-primary-hover text-primary-foreground shadow-lg shadow-primary/30 scale-105 ring-2 ring-primary/40'
                            : 'border-border/70 hover:border-primary/60 bg-secondary/35 hover:bg-primary/10 text-foreground shadow-sm hover:scale-105 active:scale-95'
                        }`}
                      >
                        <Clock className={`w-3.5 h-3.5 transition-colors ${
                          isSelected ? 'text-primary-foreground' : 'text-muted-foreground/60 group-hover:text-primary'
                        }`} />
                        <span>{slot}</span>
                      </button>
                    )
                  }

                  return (
                    <div className="space-y-6">
                      {/* Manhã */}
                      {morningSlots.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-xs font-bold text-foreground border-b border-border/30 pb-2">
                            <Sunrise className="w-4 h-4 text-amber-400" />
                            <span className="font-serif text-sm">Manhã</span>
                            <span className="text-[10px] text-muted-foreground font-sans font-normal">({morningSlots.length} disponíveis)</span>
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                            {morningSlots.map(renderSlotButton)}
                          </div>
                        </div>
                      )}

                      {/* Tarde */}
                      {afternoonSlots.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-xs font-bold text-foreground border-b border-border/30 pb-2">
                            <Sun className="w-4 h-4 text-amber-500" />
                            <span className="font-serif text-sm">Tarde</span>
                            <span className="text-[10px] text-muted-foreground font-sans font-normal">({afternoonSlots.length} disponíveis)</span>
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                            {afternoonSlots.map(renderSlotButton)}
                          </div>
                        </div>
                      )}

                      {/* Noite */}
                      {eveningSlots.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-xs font-bold text-foreground border-b border-border/30 pb-2">
                            <Moon className="w-4 h-4 text-sky-400" />
                            <span className="font-serif text-sm">Fim de Tarde & Noite</span>
                            <span className="text-[10px] text-muted-foreground font-sans font-normal">({eveningSlots.length} disponíveis)</span>
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                            {eveningSlots.map(renderSlotButton)}
                          </div>
                        </div>
                      )}

                      {/* Selection Confirmation Banner */}
                      {selectedTime && (
                        <div className="p-4 bg-gradient-to-r from-emerald-500/15 via-primary/10 to-background border border-emerald-500/30 rounded-xl flex items-center justify-between gap-3 text-xs shadow-sm animate-in fade-in-50 duration-200">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                              <Check className="w-4 h-4 text-emerald-500 stroke-[3]" />
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Horário Confirmado</span>
                              <span className="font-bold text-foreground text-sm">
                                {selectedTime} hs <span className="font-normal text-muted-foreground">({formatDateText(selectedDate)})</span>
                              </span>
                            </div>
                          </div>
                          <span className="text-[11px] font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                            Reservado
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })() : (
                  <div key="no-slots-fallback" className="p-8 bg-secondary/20 rounded-xl border border-border/70 text-center space-y-3 text-xs text-muted-foreground">
                    <div className="mx-auto w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                      <Clock className="w-5 h-5" />
                    </div>
                    <p className="font-semibold text-foreground text-sm">Agenda Lotada nesta data</p>
                    <p className="max-w-md mx-auto">
                      Infelizmente, todos os horários para {selectedBarber?.name} no dia {formatDateText(selectedDate)} já foram preenchidos. Por favor, selecione outro dia no calendário.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* STEP 5: Payment Method */}
            {step === 5 && (
              <div key="step-5" className="space-y-6 animate-in fade-in-50 duration-300">
                <div className="space-y-1.5 text-left border-b border-border/40 pb-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-semibold text-[10px] uppercase tracking-wider flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-primary" /> Passo 5 de 6
                      </span>
                      <span className="text-xs text-muted-foreground">• Forma de Pagamento</span>
                    </div>

                    {/* Selected Context Summary */}
                    {selectedService && (
                      <div className="flex items-center gap-1.5 bg-secondary/60 border border-border/60 px-2.5 py-0.5 rounded-full text-[11px]">
                        <span className="text-muted-foreground">Valor do Serviço:</span>
                        <span className="font-bold text-primary">R$&nbsp;{Number(selectedService.price).toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  <h3 className="font-serif font-bold text-xl sm:text-2xl text-foreground">Escolha a Forma de Pagamento</h3>
                  <p className="text-xs text-muted-foreground">Selecione a opção de sua preferência para concluir ou sinalizar seu agendamento com segurança.</p>
                </div>

                {/* Payment Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Pix */}
                  <div
                    onClick={() => setPaymentMethod('pix')}
                    className={`relative group p-5 rounded-xl border text-left transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between ${
                      paymentMethod === 'pix'
                        ? 'border-primary bg-gradient-to-br from-primary/15 via-primary/5 to-transparent shadow-lg shadow-primary/10 ring-1 ring-primary/40 scale-[1.02]'
                        : 'border-border/70 hover:border-primary/50 bg-secondary/30 hover:bg-secondary/50 shadow-sm hover:shadow-md'
                    }`}
                  >
                    {paymentMethod === 'pix' && (
                      <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary/20 rounded-full blur-xl pointer-events-none" />
                    )}

                    <div className="space-y-3 relative z-10">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 text-primary flex items-center justify-center shadow-inner">
                          <QrCode className="w-5 h-5 text-primary" />
                        </div>
                        {paymentMethod === 'pix' ? (
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md animate-in zoom-in-75 duration-200">
                            <Check className="w-3.5 h-3.5 text-primary-foreground stroke-[3]" />
                          </div>
                        ) : (
                          <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                            50% Sinal
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        <h4 className="font-serif font-bold text-sm text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                          Pix (Sinal)
                        </h4>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Sinal de 50% (R$&nbsp;{(Number(selectedService?.price || 0) / 2).toFixed(2)}) via QR Code / Copia e Cola.
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border/30 mt-3 text-[10px] font-semibold text-primary flex items-center justify-between">
                      <span>Reserva Imediata</span>
                      <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>

                  {/* Dinheiro */}
                  <div
                    onClick={() => setPaymentMethod('cash')}
                    className={`relative group p-5 rounded-xl border text-left transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between ${
                      paymentMethod === 'cash'
                        ? 'border-primary bg-gradient-to-br from-primary/15 via-primary/5 to-transparent shadow-lg shadow-primary/10 ring-1 ring-primary/40 scale-[1.02]'
                        : 'border-border/70 hover:border-primary/50 bg-secondary/30 hover:bg-secondary/50 shadow-sm hover:shadow-md'
                    }`}
                  >
                    {paymentMethod === 'cash' && (
                      <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary/20 rounded-full blur-xl pointer-events-none" />
                    )}

                    <div className="space-y-3 relative z-10">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-500 flex items-center justify-center shadow-inner">
                          <Banknote className="w-5 h-5 text-emerald-500" />
                        </div>
                        {paymentMethod === 'cash' && (
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md animate-in zoom-in-75 duration-200">
                            <Check className="w-3.5 h-3.5 text-primary-foreground stroke-[3]" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <h4 className="font-serif font-bold text-sm text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                          Dinheiro no Local
                        </h4>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Pagamento presencial do valor total na barbearia no dia do seu atendimento.
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border/30 mt-3 text-[10px] font-semibold text-emerald-500 flex items-center justify-between">
                      <span>Pagamento Presencial</span>
                      <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>

                  {/* Cartão */}
                  <div
                    onClick={() => setPaymentMethod('card')}
                    className={`relative group p-5 rounded-xl border text-left transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between ${
                      paymentMethod === 'card'
                        ? 'border-primary bg-gradient-to-br from-primary/15 via-primary/5 to-transparent shadow-lg shadow-primary/10 ring-1 ring-primary/40 scale-[1.02]'
                        : 'border-border/70 hover:border-primary/50 bg-secondary/30 hover:bg-secondary/50 shadow-sm hover:shadow-md'
                    }`}
                  >
                    {paymentMethod === 'card' && (
                      <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary/20 rounded-full blur-xl pointer-events-none" />
                    )}

                    <div className="space-y-3 relative z-10">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/25 text-sky-500 flex items-center justify-center shadow-inner">
                          <CreditCard className="w-5 h-5 text-sky-500" />
                        </div>
                        {paymentMethod === 'card' && (
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md animate-in zoom-in-75 duration-200">
                            <Check className="w-3.5 h-3.5 text-primary-foreground stroke-[3]" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <h4 className="font-serif font-bold text-sm text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                          Cartão Débito / Crédito
                        </h4>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Pagamento na maquininha na barbearia no momento do atendimento.
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border/30 mt-3 text-[10px] font-semibold text-sky-500 flex items-center justify-between">
                      <span>Maquininha no Local</span>
                      <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>

                {/* Security Guarantee Box */}
                <div className="p-4 bg-secondary/30 rounded-xl border border-border/60 flex items-center gap-3 text-xs text-muted-foreground">
                  <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
                  <p className="leading-relaxed">
                    <strong className="text-foreground font-semibold">Garantia Osanchez Barbearia:</strong> Seu agendamento é protegido. Você pode reagendar ou cancelar sem custos com até 1 hora de antecedência.
                  </p>
                </div>
              </div>
            )}

            {/* STEP 6: Review & Confirm */}
            {step === 6 && (
              <div key="step-6" className="space-y-4">
                <h3 className="font-serif font-semibold text-lg text-foreground">Revisar Agendamento</h3>
                <p className="text-xs text-muted-foreground">Revise os detalhes da sua reserva antes de submeter</p>

                {/* No-show fee warning banner */}
                {noShowFeeInfo && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="space-y-1.5 text-xs">
                      <p className="font-bold text-amber-500">Taxa por não comparecimento</p>
                      <p className="text-muted-foreground leading-relaxed">
                        Identificamos que você não compareceu ao seu agendamento anterior
                        (<strong className="text-foreground">{noShowFeeInfo.date}</strong>, {noShowFeeInfo.serviceName}).
                        Uma taxa de <strong className="text-amber-500">R$ {noShowFeeInfo.fee.toFixed(2)}</strong> (50% do valor daquele serviço) será adicionada ao pagamento deste agendamento.
                      </p>
                    </div>
                  </div>
                )}

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
                    <span>Preço do Serviço:</span>
                    <span className="font-semibold text-foreground">R$ {Number(selectedService?.price).toFixed(2)}</span>
                  </div>
                  {noShowFeeInfo && (
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-amber-500/20">
                      <span className="text-amber-500 font-semibold">Taxa por falta anterior:</span>
                      <span className="font-bold text-amber-500">+ R$ {noShowFeeInfo.fee.toFixed(2)}</span>
                    </div>
                  )}
                  {noShowFeeInfo && (
                    <div className="flex justify-between items-center text-xs text-muted-foreground pb-2">
                      <span>Valor Total com Taxa:</span>
                      <span className="font-bold text-foreground">R$ {(Number(selectedService?.price) + noShowFeeInfo.fee).toFixed(2)}</span>
                    </div>
                  )}
                  {paymentMethod === 'pix' ? (
                    <div className="flex justify-between items-center text-sm font-bold text-primary pt-1.5 border-t border-border/40">
                      <span>Sinal via Pix (50%):</span>
                      <span>R$ {((Number(selectedService?.price) + (noShowFeeInfo?.fee || 0)) * 0.5).toFixed(2)}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center text-xs font-bold text-primary pt-1.5 border-t border-border/40">
                      <span>Forma de Pagamento:</span>
                      <span>{paymentMethod === 'cash' ? 'Dinheiro' : 'Cartão'} (Presencial)</span>
                    </div>
                  )}
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

                {/* Confirm Rules Accept - Highlighted Card for High Visibility */}
                <div 
                  onClick={() => !isPending && setAcceptTerms(!acceptTerms)}
                  className={`p-4 sm:p-5 rounded-xl border-2 transition-all cursor-pointer select-none ${
                    acceptTerms 
                      ? 'bg-emerald-950/30 border-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.15)]' 
                      : 'bg-amber-500/10 border-amber-500/60 hover:border-amber-400 hover:bg-amber-500/15 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <div className="relative flex items-center justify-center pt-0.5">
                      <input
                        type="checkbox"
                        id="acceptTermsCheckbox"
                        checked={acceptTerms}
                        onChange={(e) => setAcceptTerms(e.target.checked)}
                        disabled={isPending}
                        className="w-6 h-6 sm:w-7 sm:h-7 rounded-md accent-amber-500 cursor-pointer focus:ring-2 focus:ring-amber-400 transition-transform active:scale-95"
                        onClick={(e) => e.stopPropagation()}
                        required
                      />
                    </div>
                    
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2">
                        {acceptTerms ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-wider bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/40">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            Regras Confirmadas
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/40">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                            Toque aqui para aceitar e agendar
                          </span>
                        )}
                      </div>

                      <p className={`text-sm sm:text-base leading-relaxed ${acceptTerms ? 'text-zinc-100 font-medium' : 'text-zinc-100 font-semibold'}`}>
                        Confirmo o agendamento e declaro-me ciente de que atrasos superiores a{' '}
                        <strong className="text-amber-400 font-bold underline decoration-amber-400/50">10 minutos</strong> configuram no-show, e de que o cancelamento do sinal integral exige aviso de{' '}
                        <strong className="text-amber-400 font-bold underline decoration-amber-400/50">1 hora</strong> de antecedência.
                      </p>

                      {!acceptTerms && (
                        <p className="text-xs text-amber-300/90 font-semibold pt-1">
                          👉 É necessário marcar a caixa acima para liberar o botão de confirmação.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
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

              {step < 6 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={
                    (step === 1 && !selectedBarber) ||
                    (step === 2 && !selectedService) ||
                    (step === 3 && !selectedDate) ||
                    (step === 4 && !selectedTime) ||
                    (step === 5 && !paymentMethod)
                  }
                  className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-primary-foreground rounded text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
                >
                  Continuar
                  <ChevronRight className="w-4 h-4 text-primary-foreground" />
                </button>
              ) : (
                <div className="flex flex-col items-end gap-1.5 ml-auto">
                  <button
                    onClick={handleConfirmBooking}
                    disabled={isPending || !acceptTerms}
                    className={`px-6 py-3 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer transition-all shadow-md ${
                      !acceptTerms 
                        ? 'bg-primary/40 text-primary-foreground/50 cursor-not-allowed opacity-60' 
                        : 'bg-primary hover:bg-primary-hover text-primary-foreground shadow-primary/25 hover:scale-[1.02]'
                    }`}
                  >
                    {isPending ? (
                      <span key="loading" className="flex items-center gap-2 justify-center">
                        <Loader2 className="w-4 h-4 animate-spin text-primary-foreground" />
                        Registrando...
                      </span>
                    ) : (
                      <span key="normal" className="flex items-center gap-2 justify-center">
                        Confirmar Agendamento
                        <Check className="w-4 h-4 text-primary-foreground" />
                      </span>
                    )}
                  </button>
                  {!acceptTerms && (
                    <span className="text-[11px] text-amber-400 font-medium text-right animate-pulse">
                      * Marque a caixinha de regras acima
                    </span>
                  )}
                </div>
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

