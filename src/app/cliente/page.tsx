'use client'

import React, { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Scissors, Calendar, Clock, User, Phone, Edit, Trash2, AlertCircle, CheckCircle, Loader2, ArrowRight, Wallet, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase'

function getAppointmentPrice(appt: any): number {
  if (!appt) return 0
  const payment = Array.isArray(appt.payments) ? appt.payments[0] : appt.payments
  if (payment && payment.total_amount !== undefined && payment.total_amount !== null && Number(payment.total_amount) > 0) {
    return Number(payment.total_amount)
  }
  return Number(appt.services?.price || 0)
}
import { cancelAppointmentAction } from './actions'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { formatWhatsAppLink } from '@/lib/settings'
import { apptShortCode } from '@/lib/utils'
import { CompleteProfileModal } from '@/components/CompleteProfileModal'
import { ReviewModal } from '@/components/ReviewModal'

export default function ClientePanel() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isPending, startTransition] = useTransition()
  const [settings, setSettings] = useState<any>(null)
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false)
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)
  const [selectedApptForReview, setSelectedApptForReview] = useState<any>(null)
  
  const supabase = createClient()

  const isProfileIncomplete = (prof: any) => {
    if (!prof) return false
    const name = prof.full_name || ''
    const hasMultipleWords = name.trim().split(/\s+/).length >= 2
    const phone = prof.phone || ''
    const isPhoneEmpty = !phone.trim()

    return !name.trim() || !hasMultipleWords || isPhoneEmpty
  }

  const handleAgendarClick = (e: React.MouseEvent) => {
    if (profile && isProfileIncomplete(profile)) {
      e.preventDefault()
      setIsCompleteModalOpen(true)
    }
  }

  const handleProfileComplete = async (fullName: string, phone: string) => {
    setIsCompleteModalOpen(false)
    await loadData()
    router.push('/cliente/agendar')
  }

  const loadData = async () => {
    try {
      // Fetch general settings
      const { data: config } = await supabase
        .from('business_settings')
        .select('*')
        .eq('key', 'general_settings')
        .single()
      if (config?.value) {
        setSettings(config.value)
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/entrar')
        return
      }

      // Fetch profile
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
      
      setProfile(prof)

      // Fetch appointments joining services and barbers
      // Note: Because relationship goes appointments -> barbers -> profiles,
      // we query barbers(id, profiles(full_name)) or similar.
      // To be resilient against DB structure changes, we can fetch profiles of barbers by subquery,
      // or join profiles. If our schema references public.profiles(id) directly for barber_id,
      // then we can join profiles! Let's write a join query:
      const { data: appts } = await supabase
        .from('appointments')
        .select(`
          id,
          start_time,
          end_time,
          status,
          notes,
          package_subscription_id,
          services (id, name, price, duration),
          payments (id, total_amount, deposit_amount, status, method),
          barber_id
        `)
        .eq('customer_id', session.user.id)
        .order('start_time', { ascending: true })

      // Fetch customer's existing reviews to check which appointments have been reviewed
      const { data: customerReviews } = await supabase
        .from('reviews')
        .select('id, appointment_id, rating, status, comment')
        .eq('customer_id', session.user.id)

      const reviewMap = (customerReviews || []).reduce((acc: any, r: any) => {
        acc[r.appointment_id] = r
        return acc
      }, {})

      // For barber names, let's load profiles for those barber_ids.
      if (appts && appts.length > 0) {
        const barberIds = Array.from(new Set(appts.map(a => a.barber_id)))
        const { data: barbers } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', barberIds)

        const barberMap = (barbers || []).reduce((acc: any, b: any) => {
          acc[b.id] = b.full_name
          return acc
        }, {})

        const enriched = appts.map(a => ({
          ...a,
          barberName: barberMap[a.barber_id] || 'Barbeiro',
          review: reviewMap[a.id] || null
        }))
        setAppointments(enriched)
      } else {
        setAppointments([])
      }
    } catch (err) {
      console.error('Error fetching customer data:', err)
      setErrorMsg('Erro ao carregar seus dados do servidor.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCancel = (apptId: string) => {
    setErrorMsg('')
    setSuccessMsg('')

    startTransition(async () => {
      const res = await cancelAppointmentAction(apptId)
      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg(res.message)
        loadData()
      }
    })
    setCancelTarget(null)
  }

  const isCancelable = (startTimeStr: string) => {
    const now = new Date()
    const start = new Date(startTimeStr)
    const diffHours = (start.getTime() - now.getTime()) / (1000 * 60 * 60)
    return diffHours >= 1
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  // Separate upcoming and past
  const nowStr = new Date().toISOString()
  const upcoming = appointments.filter(a => 
    a.start_time >= nowStr && 
    a.status !== 'completed' && 
    a.status !== 'cancelled' && 
    a.status !== 'no_show'
  )
  const past = appointments
    .filter(a =>
      a.status === 'completed' ||
      a.status === 'cancelled' ||
      a.status === 'no_show' ||
      a.start_time < nowStr
    )
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
  const hasHistory = past.length > 0
  const pendingReviewAppts = past.filter(a => a.status === 'completed' && !a.review)

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between">
        <Header />
        <div className="flex-grow flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Carregando seus agendamentos...</p>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      <Header />

      <main className="flex-grow py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Welcome Dashboard */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/40 pb-6">
            <div className="space-y-1">
              <h1 className="text-3xl font-serif font-bold text-foreground">Olá, {profile?.full_name?.split(' ')[0]}!</h1>
              <p className="text-xs text-muted-foreground">Bem-vindo à sua área exclusiva de agendamento</p>
            </div>
            
            <div className="flex gap-3 w-full sm:w-auto">
              <Link
                href="/cliente/perfil"
                className="flex-1 sm:flex-none text-center px-4 py-2.5 bg-secondary border border-border hover:bg-muted text-foreground font-semibold rounded text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <Edit className="w-3.5 h-3.5" />
                Editar Perfil
              </Link>
              <a
                href="#historico"
                className="flex-1 sm:flex-none text-center px-4 py-2.5 bg-secondary border border-border hover:bg-muted text-foreground font-semibold rounded text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <Clock className="w-3.5 h-3.5" />
                Histórico
              </a>
              <Link
                href="/cliente/agendar"
                onClick={handleAgendarClick}
                className="flex-1 sm:flex-none text-center px-5 py-2.5 bg-primary hover:bg-primary-hover text-primary-foreground font-bold rounded text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
              >
                <Calendar className="w-3.5 h-3.5 text-primary-foreground" />
                Agendar Horário
              </Link>
            </div>
          </div>

          {/* Prompt to review the barbershop after a completed haircut */}
          {pendingReviewAppts.length > 0 && (
            <div className="relative overflow-hidden p-6 sm:p-7 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-secondary/30 to-background shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-start gap-4 relative z-10">
                <div className="w-11 h-11 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                  <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-serif font-bold text-base sm:text-lg text-foreground">Como foi sua experiência na Osanchez Barbearia?</h3>
                  <p className="text-xs text-muted-foreground">
                    {pendingReviewAppts[0].services?.name || 'Seu último atendimento'} com {pendingReviewAppts[0].barberName} em {formatDate(pendingReviewAppts[0].start_time)}
                    {pendingReviewAppts.length > 1 && ` · +${pendingReviewAppts.length - 1} outro${pendingReviewAppts.length > 2 ? 's' : ''} corte${pendingReviewAppts.length > 2 ? 's' : ''} aguardando avaliação`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  const appt = pendingReviewAppts[0]
                  setSelectedApptForReview({
                    id: appt.id,
                    barber_id: appt.barber_id,
                    barberName: appt.barberName,
                    serviceName: appt.services?.name || 'Corte/Serviço',
                    dateFormatted: formatDate(appt.start_time)
                  })
                  setIsReviewModalOpen(true)
                }}
                className="relative z-10 w-full sm:w-auto shrink-0 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all shadow-md hover:shadow-amber-500/20 active:scale-95 cursor-pointer"
              >
                <Star className="w-3.5 h-3.5 fill-black text-black" />
                Avaliar Agora
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded flex items-start gap-2 text-xs text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded flex items-start gap-2 text-xs text-emerald-500">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Grid Layout: Appointments / Support info */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Appointments Section */}
            <div className="lg:col-span-8 space-y-8">
              {/* Upcoming section */}
              <div className="space-y-4">
                <h2 className="text-lg font-serif font-bold text-foreground flex items-center gap-2">
                  <Clock className="w-4.5 h-4.5 text-primary" />
                  Próximos Agendamentos
                </h2>
                
                {upcoming.length > 0 ? (
                  <div className="space-y-4">
                    {upcoming.map((appt) => (
                      <div 
                        key={appt.id}
                        className="glass p-5 rounded-lg border border-border hover:border-primary/20 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                      >
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs uppercase font-bold text-foreground font-serif">
                              {appt.services?.name || 'Serviço'}
                            </span>
                            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded uppercase font-semibold">
                              {appt.status === 'confirmed' ? 'Confirmado' : 'Aguardando Sinal'}
                            </span>
                            {appt.package_subscription_id && (
                              <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                                Pacote Mensal
                              </span>
                            )}
                            <span className="font-mono text-[10px] text-muted-foreground border border-border/60 bg-secondary/40 px-1.5 py-0.5 rounded tracking-widest">
                              {apptShortCode(appt.id)}
                            </span>
                          </div>

                          <div className="text-xs text-muted-foreground space-y-1">
                            <p className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-primary" />
                              {formatDate(appt.start_time)} às {formatTime(appt.start_time)}
                            </p>
                            <p className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-primary" />
                              Barbeiro: {appt.barberName}
                            </p>
                            <p className="flex items-center gap-1.5 font-semibold text-foreground">
                              <Wallet className="w-3.5 h-3.5 text-primary" />
                              {appt.package_subscription_id ? (
                                <span>Valor da Sessão: R$ {getAppointmentPrice(appt).toFixed(2)} (Pacote)</span>
                              ) : (
                                <span>Valor: R$ {getAppointmentPrice(appt).toFixed(2)} (Sinal 50%: R$ {(getAppointmentPrice(appt) * 0.5).toFixed(2)})</span>
                              )}
                            </p>
                            {appt.payments?.[0] && (
                              <p className="text-[10px] text-primary italic">
                                Status Pagamento: {appt.payments[0].status === 'pending' ? 'Sinal pendente (Enviar comprovante)' : appt.payments[0].status === 'paid' ? 'Pago' : 'Confirmado Manualmente'}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 w-full sm:w-auto self-stretch sm:self-center justify-end">
                          {isCancelable(appt.start_time) ? (
                            <button
                              onClick={() => setCancelTarget(appt.id)}
                              disabled={isPending}
                              className="px-3.5 py-2 bg-destructive/10 hover:bg-destructive/20 border border-destructive/25 text-destructive font-semibold rounded text-xs flex items-center justify-center gap-1.5 transition-all w-full sm:w-auto cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              Cancelar
                            </button>
                          ) : (
                            <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                              <span className="text-[10px] text-muted-foreground text-right block max-w-[170px] leading-normal italic">
                                Cancelamento indisponível (limite de 1 hora atingido)
                              </span>
                              <a
                                href={formatWhatsAppLink(
                                  settings?.whatsapp,
                                  `Olá! Sou ${profile?.full_name || 'Cliente'} e preciso cancelar meu agendamento com urgência.\nCódigo: ${apptShortCode(appt.id)}\nServiço: ${appt.services?.name || 'Serviço'} — ${appt.barberName || 'Barbeiro'}\nData: ${formatDate(appt.start_time)} às ${formatTime(appt.start_time)}`
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 bg-secondary hover:bg-muted border border-border text-foreground font-medium rounded text-[11px] flex items-center justify-center gap-1.5 transition-all w-full sm:w-auto text-center shadow-xs"
                              >
                                <Phone className="w-3 h-3 text-emerald-500 shrink-0" />
                                Cancelar pelo WhatsApp
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 sm:p-10 bg-gradient-to-b from-secondary/40 via-secondary/20 to-background rounded-xl border border-border/70 text-center space-y-4 shadow-sm relative overflow-hidden">
                    {/* Background subtle glow */}
                    <div className="absolute -top-12 -left-12 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
                    <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

                    {/* Icon badge */}
                    <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center text-primary shadow-inner">
                      <Calendar className="w-6 h-6" />
                    </div>

                    <div className="space-y-1 max-w-sm mx-auto">
                      <p className="text-sm font-semibold text-foreground">Você não possui agendamentos ativos no momento.</p>
                      <p className="text-xs text-muted-foreground">
                        {hasHistory
                          ? 'Que tal marcar seu próximo horário? Escolha o serviço e o barbeiro preferido em poucos cliques.'
                          : 'Escolha seu serviço e barbeiro preferido para garantir seu horário em poucos cliques.'}
                      </p>
                    </div>

                    <div className="pt-2">
                      <Link
                        href="/cliente/agendar"
                        onClick={handleAgendarClick}
                        className="inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-lg font-bold text-xs sm:text-sm text-primary-foreground bg-primary hover:bg-primary/90 border border-primary-light/30 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/35 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer group/btn"
                      >
                        <Scissors className="w-4 h-4 text-primary-foreground transition-transform group-hover/btn:rotate-12" />
                        <span>{hasHistory ? 'Agendar novo horário' : 'Agendar meu primeiro serviço'}</span>
                        <ArrowRight className="w-4 h-4 text-primary-foreground transition-transform group-hover/btn:translate-x-1" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Past history section */}
              <div id="historico" className="space-y-4 scroll-mt-24">
                <h2 className="text-lg font-serif font-bold text-foreground flex items-center gap-2">
                  <Clock className="w-4.5 h-4.5 text-primary" />
                  Histórico de Agendamentos
                </h2>
                
                {past.length > 0 ? (
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {past.map((appt) => (
                      <div 
                        key={appt.id}
                        className="p-4 rounded-lg bg-secondary/25 border border-border/50 flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-foreground">{appt.services?.name || 'Serviço'}</p>
                            <span className="font-mono text-[9px] text-muted-foreground/70 tracking-widest">{apptShortCode(appt.id)}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">{formatDate(appt.start_time)} às {formatTime(appt.start_time)} | {appt.barberName}</p>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {appt.status === 'completed' && !appt.review && (
                            <button
                              onClick={() => {
                                setSelectedApptForReview({
                                  id: appt.id,
                                  barber_id: appt.barber_id,
                                  barberName: appt.barberName,
                                  serviceName: appt.services?.name || 'Corte/Serviço',
                                  dateFormatted: formatDate(appt.start_time)
                                })
                                setIsReviewModalOpen(true)
                              }}
                              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-md hover:shadow-amber-500/20 active:scale-95 cursor-pointer animate-pulse"
                            >
                              <Star className="w-3.5 h-3.5 fill-black text-black" />
                              Avaliar Experiência
                            </button>
                          )}

                          {appt.status === 'completed' && appt.review && (
                            <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                              {appt.review.status === 'pending' ? `Avaliação em Análise (${appt.review.rating}★)` : `Avaliado (${appt.review.rating}★)`}
                            </span>
                          )}

                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                            appt.status === 'completed' 
                              ? 'bg-emerald-500/10 text-emerald-500' 
                              : appt.status === 'cancelled'
                              ? 'bg-destructive/10 text-destructive'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {appt.status === 'completed' ? 'Concluído' : appt.status === 'cancelled' ? 'Cancelado' : appt.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Nenhum histórico disponível.</p>
                )}
              </div>

            </div>

            {/* Sidebar Information / Help */}
            <div className="lg:col-span-4 space-y-6">
              {/* WhatsApp Support card */}
              <div className="glass p-6 rounded-lg border border-border space-y-4">
                <Phone className="w-8 h-8 text-primary" />
                <h3 className="font-serif font-bold text-base text-foreground">Precisa de Suporte?</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Dúvidas sobre o Pix de sinal, reagendamentos urgentes ou alteração de serviço? Entre em contato diretamente com nossa recepção no WhatsApp.
                </p>
                <a
                  href={formatWhatsAppLink(settings?.whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full text-center py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow-md block transition-all"
                >
                  Falar no WhatsApp
                </a>
              </div>

              {/* Rules Alert Card */}
              <div className="p-5 bg-secondary/35 rounded-lg border border-border/80 text-xs text-muted-foreground space-y-2">
                <h4 className="font-semibold text-foreground flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-primary" /> Regras Osanchez
                </h4>
                <ul className="list-disc pl-4 space-y-1.5 text-[11px] leading-normal">
                  <li>O cancelamento online livre expira <strong>1 hora</strong> antes da reserva.</li>
                  <li>Tolerância máxima a atrasos de <strong>10 minutos</strong>.</li>
                  <li>Reservas sem sinal Pix em até 2 horas podem ser canceladas pela barbearia.</li>
                </ul>
              </div>
            </div>

          </div>
        </div>
      </main>

      <Footer />

      <CompleteProfileModal
        isOpen={isCompleteModalOpen}
        initialFullName={profile?.full_name || ''}
        isBlocking={false}
        onClose={() => setIsCompleteModalOpen(false)}
        onComplete={handleProfileComplete}
      />

      <ReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => {
          setIsReviewModalOpen(false)
          setSelectedApptForReview(null)
        }}
        appointment={selectedApptForReview}
        onSuccess={() => {
          loadData()
        }}
      />

      {/* CANCEL CONFIRM MODAL */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="glass max-w-sm w-full rounded-lg border border-border shadow-2xl p-6 relative flex flex-col space-y-6">
            <div className="space-y-2 text-left">
              <h3 className="text-lg font-serif font-bold text-rose-500 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-500" />
                Cancelar Agendamento?
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Deseja realmente cancelar este agendamento? Esta ação não poderá ser desfeita.
              </p>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                disabled={isPending}
                className="px-4 py-2 bg-secondary hover:bg-muted text-foreground border border-border font-bold rounded text-xs transition-all cursor-pointer disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => handleCancel(cancelTarget)}
                disabled={isPending}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <Trash2 className="w-3.5 h-3.5 text-white" />}
                Sim, cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
