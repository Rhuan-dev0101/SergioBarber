'use client'

import React, { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  Scissors, Calendar, Clock, User, Phone, Edit, Trash2, 
  AlertCircle, CheckCircle, HelpCircle, Loader2, ArrowRight, Wallet 
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { cancelAppointmentAction } from './actions'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { formatWhatsAppLink } from '@/lib/settings'
import { CompleteProfileModal } from '@/components/CompleteProfileModal'

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
          services (id, name, price, duration),
          payments (id, total_amount, deposit_amount, status, method),
          barber_id
        `)
        .eq('customer_id', session.user.id)
        .order('start_time', { ascending: true })

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
          barberName: barberMap[a.barber_id] || 'Barbeiro'
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
    if (!confirm('Deseja realmente cancelar este agendamento?')) return
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
  }

  const isCancelable = (startTimeStr: string) => {
    const now = new Date()
    const start = new Date(startTimeStr)
    const diffHours = (start.getTime() - now.getTime()) / (1000 * 60 * 60)
    return diffHours >= 2
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
  const upcoming = appointments.filter(a => a.start_time >= nowStr && a.status !== 'cancelled')
  const past = appointments.filter(a => a.start_time < nowStr || a.status === 'cancelled')

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
                              Valor: R$ {Number(appt.services?.price).toFixed(2)} (Sinal 50%: R$ {(Number(appt.services?.price) * 0.5).toFixed(2)})
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
                              onClick={() => handleCancel(appt.id)}
                              disabled={isPending}
                              className="px-3.5 py-2 bg-destructive/10 hover:bg-destructive/20 border border-destructive/25 text-destructive font-semibold rounded text-xs flex items-center justify-center gap-1.5 transition-all w-full sm:w-auto cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              Cancelar
                            </button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground text-right block max-w-[150px] leading-normal italic">
                              Cancelamento indisponível (limite de 2 horas atingido)
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 bg-secondary/20 rounded-lg border border-border text-center text-xs text-muted-foreground space-y-3">
                    <p>Você não possui agendamentos ativos no momento.</p>
                    <Link
                      href="/cliente/agendar"
                      onClick={handleAgendarClick}
                      className="text-primary font-semibold hover:underline inline-flex items-center gap-1"
                    >
                      Agendar meu primeiro serviço <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>

              {/* Past history section */}
              <div className="space-y-4">
                <h2 className="text-lg font-serif font-bold text-foreground">Histórico de Agendamentos</h2>
                
                {past.length > 0 ? (
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {past.map((appt) => (
                      <div 
                        key={appt.id}
                        className="p-4 rounded-lg bg-secondary/25 border border-border/50 flex justify-between items-center text-xs gap-4"
                      >
                        <div className="space-y-1">
                          <p className="font-semibold text-foreground">{appt.services?.name || 'Serviço'}</p>
                          <p className="text-[10px] text-muted-foreground">{formatDate(appt.start_time)} às {formatTime(appt.start_time)} | {appt.barberName}</p>
                        </div>
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
                  href={formatWhatsAppLink(settings?.whatsapp || '5511999999999')}
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
                  <li>O cancelamento online livre expira <strong>2 horas</strong> antes da reserva.</li>
                  <li>Tolerância máxima a atrasos de <strong>10 minutos</strong>.</li>
                  <li>Reservas sem sinal Pix em até 2 horas podem ser canceladas automaticamente.</li>
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
    </div>
  )
}
