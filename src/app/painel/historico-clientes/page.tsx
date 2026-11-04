'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  History, Search, Loader2, Calendar, Phone, DollarSign, 
  UserCheck, Scissors, ArrowUpDown, MessageCircle, AlertCircle
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { DashboardSidebar } from '@/components/DashboardSidebar'

export type ClientHistoryItem = {
  customerId: string
  customerName: string
  customerPhone: string
  customerEmail: string
  totalVisits: number
  lastVisitDate: string
  totalSpent: number
  servicesSummary: string[]
}

export default function HistoricoClientesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<{ id: string; name: string; role: string } | null>(null)
  
  const [historyList, setHistoryList] = useState<ClientHistoryItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'spent' | 'visits'>('recent')

  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          router.push('/entrar')
          return
        }

        // Fetch current logged-in user profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('id', session.user.id)
          .single()

        if (!profile || (profile.role !== 'admin' && profile.role !== 'barber')) {
          router.push('/painel')
          return
        }

        setUserProfile({
          id: profile.id,
          name: profile.full_name,
          role: profile.role
        })

        // Fetch ALL completed appointments ONLY for this specific barber (barber_id === session.user.id)
        const { data: dbAppointments, error } = await supabase
          .from('appointments')
          .select(`
            id,
            customer_id,
            start_time,
            status,
            service_id,
            services(name, price),
            profiles:customer_id(id, full_name, phone, email)
          `)
          .eq('barber_id', session.user.id)
          .eq('status', 'completed')
          .order('start_time', { ascending: false })

        if (error) {
          console.error('Error fetching barber client history:', error)
          setHistoryList([])
          return
        }

        if (!dbAppointments || dbAppointments.length === 0) {
          setHistoryList([])
          return
        }

        // Fetch payment records for these appointments
        const apptIds = dbAppointments.map(a => a.id)
        const paymentMap: Record<string, number> = {}

        if (apptIds.length > 0) {
          const { data: payments } = await supabase
            .from('payments')
            .select('appointment_id, total_amount')
            .in('appointment_id', apptIds)

          payments?.forEach(p => {
            if (p.appointment_id) {
              paymentMap[p.appointment_id] = Number(p.total_amount || 0)
            }
          })
        }

        // Group appointments by unique customer_id
        const customerMap: Record<string, ClientHistoryItem> = {}

        dbAppointments.forEach((appt: any) => {
          const cId = appt.customer_id
          if (!cId) return

          const servicePrice = Number((appt.services as any)?.price || 0)
          const paidAmount = paymentMap[appt.id] !== undefined ? paymentMap[appt.id] : servicePrice

          const profileData = appt.profiles as any
          const cName = profileData?.full_name || 'Cliente Sem Cadastro'
          const cPhone = profileData?.phone || 'Não informado'
          const cEmail = profileData?.email || ''
          const serviceName = (appt.services as any)?.name || 'Serviço'

          if (!customerMap[cId]) {
            customerMap[cId] = {
              customerId: cId,
              customerName: cName,
              customerPhone: cPhone,
              customerEmail: cEmail,
              totalVisits: 1,
              lastVisitDate: appt.start_time,
              totalSpent: paidAmount,
              servicesSummary: [serviceName]
            }
          } else {
            customerMap[cId].totalVisits += 1
            customerMap[cId].totalSpent += paidAmount
            
            if (serviceName && !customerMap[cId].servicesSummary.includes(serviceName)) {
              customerMap[cId].servicesSummary.push(serviceName)
            }

            // Keep the most recent appointment date as lastVisitDate
            if (new Date(appt.start_time).getTime() > new Date(customerMap[cId].lastVisitDate).getTime()) {
              customerMap[cId].lastVisitDate = appt.start_time
            }
          }
        })

        const aggregated = Object.values(customerMap)
        setHistoryList(aggregated)

      } catch (err) {
        console.error('Error loading history page:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router, supabase])

  // Filter & Sort
  const filteredList = historyList.filter(item => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase().trim()
    return (
      item.customerName.toLowerCase().includes(q) ||
      item.customerPhone.toLowerCase().includes(q)
    )
  }).sort((a, b) => {
    if (sortBy === 'spent') {
      return b.totalSpent - a.totalSpent
    }
    if (sortBy === 'visits') {
      return b.totalVisits - a.totalVisits
    }
    // Default: 'recent'
    return new Date(b.lastVisitDate).getTime() - new Date(a.lastVisitDate).getTime()
  })

  // Calculations for Stat Summary Cards
  const totalUniqueCustomers = historyList.length
  const totalCompletedVisits = historyList.reduce((acc, item) => acc + item.totalVisits, 0)
  const totalRevenueGenerated = historyList.reduce((acc, item) => acc + item.totalSpent, 0)

  const formatDatePt = (isoStr: string) => {
    if (!isoStr) return '—'
    const date = new Date(isoStr)
    return date.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }) + ' às ' + date.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const cleanPhoneForWhatsapp = (phone: string) => {
    const numbers = phone.replace(/\D/g, '')
    if (!numbers) return null
    return numbers.startsWith('55') ? numbers : `55${numbers}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col md:flex-row justify-center items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground font-medium">Carregando seu histórico de clientes...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <DashboardSidebar />

      <main className="flex-grow p-5 sm:p-8 space-y-6 overflow-y-auto">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/40 pb-6">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-foreground flex items-center gap-2.5">
              <History className="w-6 h-6 sm:w-7 sm:h-7 text-primary shrink-0" />
              Meu Histórico de Clientes
            </h1>
            <p className="text-xs text-muted-foreground">
              Visualização pessoal exclusiva dos clientes que você ({userProfile?.name}) atendeu presencialmente
            </p>
          </div>
        </div>

        {/* Stats Summary Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass p-4 rounded-xl border border-border/60 space-y-1 shadow-sm">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
              <span>Clientes Atendidos</span>
              <UserCheck className="w-4 h-4 text-primary" />
            </div>
            <div className="text-2xl font-serif font-bold text-foreground">
              {totalUniqueCustomers}
            </div>
            <p className="text-[10px] text-muted-foreground">Clientes únicos com visitas concluídas por você</p>
          </div>

          <div className="glass p-4 rounded-xl border border-border/60 space-y-1 shadow-sm">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
              <span>Atendimentos Concluídos</span>
              <Scissors className="w-4 h-4 text-primary" />
            </div>
            <div className="text-2xl font-serif font-bold text-foreground">
              {totalCompletedVisits}
            </div>
            <p className="text-[10px] text-muted-foreground">Cortes/serviços finalizados por você</p>
          </div>

          <div className="glass p-4 rounded-xl border border-border/60 space-y-1 shadow-sm">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
              <span>Total Faturado</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-mono font-bold text-emerald-400">
              R$&nbsp;{totalRevenueGenerated.toFixed(2)}
            </div>
            <p className="text-[10px] text-muted-foreground">Soma paga dos seus atendimentos</p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-secondary/30 p-3.5 rounded-xl border border-border/50">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              aria-label="Buscar cliente por nome ou telefone" placeholder="Buscar cliente por nome ou telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border border-border focus:border-primary rounded-lg text-base outline-none text-foreground"
            />
          </div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-primary shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3.5 py-2 bg-background border border-border focus:border-primary rounded-lg text-base text-foreground font-medium outline-none cursor-pointer"
            >
              <option value="recent">Mais Recente Primeiro</option>
              <option value="spent">Maior Valor Gasto</option>
              <option value="visits">Mais Visitas Concluídas</option>
            </select>
          </div>
        </div>

        {/* Clients List */}
        {filteredList.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredList.map((item) => {
              const whatsappNum = cleanPhoneForWhatsapp(item.customerPhone)

              return (
                <div
                  key={item.customerId}
                  className="glass p-5 rounded-2xl border border-border/80 hover:border-primary/40 transition-all duration-200 space-y-4 shadow-md flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Header: Customer Name & Phone */}
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-1">
                        <h3 className="font-serif font-bold text-lg text-foreground tracking-tight line-clamp-1">
                          {item.customerName}
                        </h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                          <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span>{item.customerPhone}</span>
                        </p>
                      </div>

                      {whatsappNum && (
                        <a
                          href={`https://wa.me/${whatsappNum}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl transition-all cursor-pointer shrink-0"
                          title="Conversar no WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                      )}
                    </div>

                    {/* Stats Grid for this customer */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-secondary/40 p-3 rounded-xl border border-border/50">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">Visitas Concluídas</span>
                        <span className="font-serif font-extrabold text-foreground text-sm">
                          {item.totalVisits} {item.totalVisits === 1 ? 'visita' : 'visitas'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">Total Gasto Com Você</span>
                        <span className="font-mono font-extrabold text-emerald-400 text-sm">
                          R$&nbsp;{item.totalSpent.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Last Visit Info */}
                    <div className="space-y-1 text-xs">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Último Atendimento:</span>
                      <div className="flex items-center gap-1.5 text-foreground font-semibold bg-background p-2 rounded-lg border border-border/60">
                        <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>{formatDatePt(item.lastVisitDate)}</span>
                      </div>
                    </div>

                    {/* Services Summary Tags */}
                    {item.servicesSummary.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Serviços Realizados:</span>
                        <div className="flex flex-wrap gap-1">
                          {item.servicesSummary.map((svc, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20"
                            >
                              {svc}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              )
            })}
          </div>
        ) : (
          <div className="glass p-10 rounded-2xl border border-border/80 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto" />
            <h3 className="font-serif font-bold text-lg text-foreground">Nenhum histórico encontrado</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              {searchQuery
                ? `Nenhum cliente atendeu ao filtro "${searchQuery}". Tente buscar por outro nome ou telefone.`
                : 'Você ainda não possui atendimentos concluídos registrados no seu perfil.'}
            </p>
          </div>
        )}

      </main>
    </div>
  )
}
