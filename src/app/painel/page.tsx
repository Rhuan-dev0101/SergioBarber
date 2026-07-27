import React from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { 
  Scissors, Calendar, Clock, DollarSign, Users, Sparkles, 
  ArrowUpRight, AlertCircle, TrendingUp, CheckCircle, XCircle,
  ArrowRight, ShieldCheck, Award, UserCheck, ChevronRight
} from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase'
import { DashboardSidebar } from '@/components/DashboardSidebar'

export default async function PainelDashboard() {
  const supabase = await createServerSupabaseClient()

  // 1. Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/entrar')
  }

  // 2. Fetch role
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'barber')) {
    redirect('/cliente')
  }

  const isAdmin = profile.role === 'admin'

  // 3. Query appointments, services, payments, and customer details
  // Filter by barber if not admin
  let query = supabase
    .from('appointments')
    .select(`
      id,
      start_time,
      status,
      services (name, price),
      payments (total_amount, deposit_amount, status),
      customer:profiles (full_name),
      barber_id
    `)

  if (!isAdmin) {
    query = query.eq('barber_id', user.id)
  }

  const { data: appointments, error: queryError } = await query

  if (queryError) {
    console.error('Error fetching dashboard data:', queryError)
  }

  const apptsList = appointments || []

  // 3.1 Query paid package subscriptions
  let pkgQuery = supabase
    .from('package_subscriptions')
    .select('package_price, payment_status, barber_id')
    .eq('payment_status', 'paid')

  if (!isAdmin) {
    pkgQuery = pkgQuery.eq('barber_id', user.id)
  }

  const { data: paidPackages, error: pkgError } = await pkgQuery

  if (pkgError) {
    console.error('Error fetching paid packages for dashboard:', pkgError)
  }

  const packagesList = paidPackages || []

  // 4. Calculate metrics
  const now = new Date()
  const todayStr = now.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).split('/').reverse().join('-') // yyyy-mm-dd

  let todayCount = 0
  let upcomingCount = 0
  let completedCount = 0
  let cancelledCount = 0
  let totalRevenue = 0
  let pendingRevenue = 0

  const serviceCounts: Record<string, number> = {}

  apptsList.forEach((appt: any) => {
    const apptDateStr = appt.start_time.split('T')[0]
    
    // Status counting
    if (appt.status === 'completed') {
      completedCount++
    } else if (appt.status === 'cancelled') {
      cancelledCount++
    }

    if (apptDateStr === todayStr && appt.status !== 'cancelled') {
      todayCount++
    }

    if (appt.start_time >= now.toISOString() && appt.status !== 'cancelled') {
      upcomingCount++
    }

    // Revenue counting
    const payment = appt.payments?.[0]
    const service = appt.services
    if (payment) {
      if (payment.status === 'paid' || payment.status === 'confirmed_manually') {
        totalRevenue += Number(payment.total_amount)
      } else if (payment.status === 'pending') {
        // Pending signal is deposit
        pendingRevenue += Number(payment.deposit_amount)
      }
    } else if (service && appt.status === 'completed') {
      // If completed but no payment log found, assume paid total
      totalRevenue += Number(service.price)
    }

    // Services counting
    if (service && appt.status !== 'cancelled') {
      serviceCounts[service.name] = (serviceCounts[service.name] || 0) + 1
    }
  })

  // Add paid packages revenue to total revenue
  packagesList.forEach((pkg: any) => {
    totalRevenue += Number(pkg.package_price)
  })

  // Fetch all barbers to map names
  const { data: barbersList } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'barber')

  const barberMap = (barbersList || []).reduce((acc: any, b: any) => {
    acc[b.id] = b.full_name
    return acc
  }, {})

  // Calculate stats by barber
  const barberStats: Record<string, { count: number; revenue: number }> = {}
  apptsList.forEach((appt: any) => {
    if (appt.status !== 'cancelled') {
      const barberName = barberMap[appt.barber_id] || 'Outros'
      if (!barberStats[barberName]) {
        barberStats[barberName] = { count: 0, revenue: 0 }
      }
      barberStats[barberName].count++
      
      const payment = appt.payments?.[0]
      if (payment && (payment.status === 'paid' || payment.status === 'confirmed_manually')) {
        barberStats[barberName].revenue += Number(payment.total_amount)
      }
    }
  })

  // Add paid packages to barber workload stats
  packagesList.forEach((pkg: any) => {
    const barberName = barberMap[pkg.barber_id] || 'Outros'
    if (!barberStats[barberName]) {
      barberStats[barberName] = { count: 0, revenue: 0 }
    }
    barberStats[barberName].revenue += Number(pkg.package_price)
  })

  // Get top services
  const topServices = Object.entries(serviceCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)

  const firstName = profile.full_name?.split(' ')[0] || 'Barbeiro'
  const dateFormatted = new Date().toLocaleDateString('pt-BR', { dateStyle: 'long' })

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <DashboardSidebar />

      <main className="flex-grow p-6 sm:p-8 space-y-8 overflow-y-auto">
        
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/40 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-serif font-bold text-foreground">Olá, {firstName}! ✂️</h1>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {isAdmin ? 'Gestão Geral' : 'Painel do Barbeiro'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Bem-vindo à sua visão geral de desempenho e agendamentos</p>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-primary bg-primary/10 px-3.5 py-2 rounded-xl border border-primary/25 shadow-sm">
            <Calendar className="w-4 h-4 text-primary" />
            <span>Hoje: {dateFormatted}</span>
          </div>
        </div>

        {/* Stats Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          
          {/* Card 1: Today's Appointments */}
          <div className="relative overflow-hidden p-6 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/15 via-secondary/30 to-background shadow-md group hover:border-primary/60 transition-all duration-300">
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex justify-between items-start relative z-10">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Agendamentos Hoje</span>
                <div className="text-3xl sm:text-4xl font-serif font-bold text-foreground group-hover:text-primary transition-colors">{todayCount}</div>
                <p className="text-[11px] text-muted-foreground leading-normal">Clientes programados para hoje</p>
              </div>
              <div className="p-3 rounded-xl bg-primary/15 border border-primary/25 text-primary shadow-inner">
                <Calendar className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Card 2: Upcoming Appointments */}
          <div className="relative overflow-hidden p-6 rounded-xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-secondary/30 to-background shadow-md group hover:border-sky-500/60 transition-all duration-300">
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-sky-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex justify-between items-start relative z-10">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Agendamentos Ativos</span>
                <div className="text-3xl sm:text-4xl font-serif font-bold text-foreground group-hover:text-sky-400 transition-colors">{upcomingCount}</div>
                <p className="text-[11px] text-muted-foreground leading-normal">Futuros horários na agenda</p>
              </div>
              <div className="p-3 rounded-xl bg-sky-500/15 border border-sky-500/25 text-sky-400 shadow-inner">
                <Clock className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Card 3: Cash Inflow */}
          <div className="relative overflow-hidden p-6 rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-secondary/30 to-background shadow-md group hover:border-emerald-500/60 transition-all duration-300">
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex justify-between items-start relative z-10">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Faturamento Confirmado</span>
                <div className="text-2xl sm:text-3xl font-serif font-bold text-emerald-500">R$&nbsp;{totalRevenue.toFixed(2)}</div>
                <p className="text-[11px] text-muted-foreground leading-normal">Liquidado (Pix, cartões e presencial)</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-500 shadow-inner">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Card 4: Forecast Pending Signals */}
          <div className="relative overflow-hidden p-6 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-secondary/30 to-background shadow-md group hover:border-amber-500/60 transition-all duration-300">
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex justify-between items-start relative z-10">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Sinais Pendentes</span>
                <div className="text-2xl sm:text-3xl font-serif font-bold text-amber-400">R$&nbsp;{pendingRevenue.toFixed(2)}</div>
                <p className="text-[11px] text-muted-foreground leading-normal">Sinais Pix aguardando aprovação</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-400 shadow-inner">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </div>

        </div>

        {/* Detailed Stats Graphs / Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left panel: Top Services and Barber workload */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Workload by Barber */}
            <div className="glass p-6 sm:p-7 rounded-xl border border-border/80 space-y-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <h3 className="font-serif font-bold text-base text-foreground uppercase tracking-wider flex items-center gap-2">
                  <UserCheck className="w-4.5 h-4.5 text-primary" /> Desempenho por Profissional
                </h3>
                <span className="text-[11px] text-muted-foreground font-semibold">Total de Atendimentos</span>
              </div>
              
              {Object.keys(barberStats).length > 0 ? (
                <div className="space-y-5">
                  {Object.entries(barberStats).map(([barberName, stats]) => {
                    const percentage = Math.min(100, Math.round((stats.count / (apptsList.length || 1)) * 100))
                    return (
                      <div key={barberName} className="space-y-2">
                        <div className="flex justify-between items-center text-xs font-semibold">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-primary/30 to-secondary border border-primary/30 text-primary font-serif font-bold flex items-center justify-center text-xs">
                              {barberName.charAt(0)}
                            </div>
                            <span className="text-foreground font-bold">{barberName}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-primary font-mono font-bold bg-primary/10 px-2 py-0.5 rounded border border-primary/20 text-[11px]">
                              {stats.count} atendimento{stats.count !== 1 ? 's' : ''}
                            </span>
                            <span className="text-emerald-500 font-bold font-serif text-sm">
                              R$&nbsp;{stats.revenue.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-secondary/80 h-3 rounded-full overflow-hidden p-0.5 border border-border/40">
                          <div 
                            className="bg-gradient-to-r from-primary via-primary/90 to-primary-hover h-full rounded-full transition-all duration-500 shadow-sm" 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic text-center py-4">Nenhum atendimento registrado no momento.</p>
              )}
            </div>

            {/* Today's appointments schedule list */}
            <div className="glass p-6 sm:p-7 rounded-xl border border-border/80 space-y-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <h3 className="font-serif font-bold text-base text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4.5 h-4.5 text-primary" /> Próximos Clientes Hoje
                </h3>
                <Link
                  href="/painel/agendamentos"
                  className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                >
                  Ver Agenda Completa <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              
              <div className="space-y-3">
                {apptsList.filter((a: any) => a.start_time.split('T')[0] === todayStr && a.status !== 'cancelled').length > 0 ? (
                  apptsList
                    .filter((a: any) => a.start_time.split('T')[0] === todayStr && a.status !== 'cancelled')
                    .sort((a, b) => a.start_time.localeCompare(b.start_time))
                    .map((appt: any) => (
                      <div 
                        key={appt.id}
                        className="flex justify-between items-center p-4 rounded-xl bg-secondary/35 hover:bg-secondary/60 border border-border/60 text-xs transition-all shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                            {new Date(appt.start_time).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="space-y-0.5">
                            <p className="font-bold text-foreground text-sm">{appt.customer?.full_name || 'Cliente'}</p>
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                              <Scissors className="w-3 h-3 text-primary" />
                              <span>{appt.services?.name}</span>
                            </p>
                          </div>
                        </div>

                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                          appt.status === 'completed' 
                            ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/25' 
                            : 'bg-primary/15 text-primary border border-primary/25'
                        }`}>
                          {appt.status === 'completed' ? 'Concluído' : 'Confirmado'}
                        </span>
                      </div>
                    ))
                ) : (
                  <div className="p-8 bg-secondary/20 rounded-xl border border-border/60 text-center space-y-2">
                    <p className="text-xs text-muted-foreground italic">Nenhum agendamento programado para o dia de hoje.</p>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Right panel: Top Services / Operations metrics */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* Top Services chart */}
            <div className="glass p-6 sm:p-7 rounded-xl border border-border/80 space-y-5 shadow-sm">
              <h3 className="font-serif font-bold text-base text-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/40 pb-3">
                <Sparkles className="w-4.5 h-4.5 text-primary" /> Serviços Populares
              </h3>

              {topServices.length > 0 ? (
                <div className="space-y-4">
                  {topServices.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs p-3 rounded-lg bg-secondary/30 border border-border/50">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-primary/15 border border-primary/25 font-bold text-primary font-serif text-xs flex items-center justify-center shrink-0">
                          #{idx + 1}
                        </span>
                        <span className="text-foreground font-semibold">{item.name}</span>
                      </div>
                      <span className="text-primary font-bold font-mono text-xs bg-background/80 px-2.5 py-1 rounded-full border border-border/60">
                        {item.count} realizaçõ{item.count !== 1 ? 'es' : 'ão'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic text-center py-4">Nenhum serviço registrado.</p>
              )}
            </div>

            {/* Quick Status Ratios */}
            <div className="glass p-6 sm:p-7 rounded-xl border border-border/80 space-y-5 shadow-sm">
              <h3 className="font-serif font-bold text-base text-foreground uppercase tracking-wider border-b border-border/40 pb-3">
                Status da Agenda
              </h3>
              
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/25 space-y-1.5 shadow-sm">
                  <CheckCircle className="w-5 h-5 text-emerald-500 mx-auto" />
                  <span className="text-[10px] text-muted-foreground uppercase block font-bold tracking-wider">Concluídos</span>
                  <span className="text-2xl font-serif font-bold text-foreground">{completedCount}</span>
                </div>
                <div className="p-4 bg-destructive/10 rounded-xl border border-destructive/25 space-y-1.5 shadow-sm">
                  <XCircle className="w-5 h-5 text-destructive mx-auto" />
                  <span className="text-[10px] text-muted-foreground uppercase block font-bold tracking-wider">Cancelados</span>
                  <span className="text-2xl font-serif font-bold text-foreground">{cancelledCount}</span>
                </div>
              </div>
            </div>

          </div>

        </div>

      </main>
    </div>
  )
}
