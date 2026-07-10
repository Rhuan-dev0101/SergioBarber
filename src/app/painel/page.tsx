import React from 'react'
import { redirect } from 'next/navigation'
import { 
  Scissors, Calendar, Clock, DollarSign, Users, Sparkles, 
  ArrowUpRight, AlertCircle, TrendingUp, CheckCircle, XCircle 
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

  // Get top services
  const topServices = Object.entries(serviceCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <DashboardSidebar />

      <main className="flex-grow p-6 sm:p-8 space-y-8 overflow-y-auto">
        
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-border/40 pb-4">
          <div>
            <h1 className="text-2xl font-serif font-bold text-foreground">Visão Geral</h1>
            <p className="text-xs text-muted-foreground">Indicadores e resumo operacional da barbearia</p>
          </div>
          <div className="text-xs font-semibold text-muted-foreground bg-secondary px-3 py-1.5 rounded border border-border">
            Hoje: {new Date().toLocaleDateString('pt-BR', { dateStyle: 'long' })}
          </div>
        </div>

        {/* Stats Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Today's Appointments */}
          <div className="glass p-6 rounded-lg border border-border flex justify-between items-start">
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Agendamentos Hoje</span>
              <div className="text-3xl font-serif font-bold text-foreground">{todayCount}</div>
              <p className="text-[10px] text-muted-foreground leading-normal">Agendados para realização na data de hoje</p>
            </div>
            <div className="p-2.5 rounded bg-primary/10 text-primary">
              <Calendar className="w-5 h-5" />
            </div>
          </div>

          {/* Card 2: Upcoming Appointments */}
          <div className="glass p-6 rounded-lg border border-border flex justify-between items-start">
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Agendamentos Ativos</span>
              <div className="text-3xl font-serif font-bold text-foreground">{upcomingCount}</div>
              <p className="text-[10px] text-muted-foreground leading-normal">Agendamentos ativos futuros na agenda</p>
            </div>
            <div className="p-2.5 rounded bg-primary/10 text-primary">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          {/* Card 3: Cash Inflow */}
          <div className="glass p-6 rounded-lg border border-border flex justify-between items-start">
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Faturamento Confirmado</span>
              <div className="text-2xl font-serif font-bold text-emerald-500">R$ {totalRevenue.toFixed(2)}</div>
              <p className="text-[10px] text-muted-foreground leading-normal">Total liquidado (Pix e pagamentos presenciais)</p>
            </div>
            <div className="p-2.5 rounded bg-emerald-500/10 text-emerald-500">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          {/* Card 4: Forecast Pending Signals */}
          <div className="glass p-6 rounded-lg border border-border flex justify-between items-start">
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Sinais Pendentes</span>
              <div className="text-2xl font-serif font-bold text-amber-500">R$ {pendingRevenue.toFixed(2)}</div>
              <p className="text-[10px] text-muted-foreground leading-normal">Sinais Pix gerados e aguardando liquidação</p>
            </div>
            <div className="p-2.5 rounded bg-amber-500/10 text-amber-500">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

        </div>

        {/* Detailed Stats Graphs / Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left panel: Top Services and Barber workload */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Workload by Barber */}
            <div className="glass p-6 rounded-lg border border-border space-y-4">
              <h3 className="font-serif font-semibold text-sm text-foreground uppercase tracking-wider">Desempenho por Profissional</h3>
              
              {Object.keys(barberStats).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(barberStats).map(([barberName, stats]) => (
                    <div key={barberName} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-foreground">{barberName}</span>
                        <span className="text-muted-foreground">{stats.count} cortes | R$ {stats.revenue.toFixed(2)}</span>
                      </div>
                      <div className="w-full bg-secondary h-2.5 rounded overflow-hidden">
                        <div 
                          className="bg-primary h-full rounded" 
                          style={{ width: `${Math.min(100, (stats.count / (apptsList.length || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Nenhum atendimento registrado.</p>
              )}
            </div>

            {/* Today's appointments schedule list */}
            <div className="glass p-6 rounded-lg border border-border space-y-4">
              <h3 className="font-serif font-semibold text-sm text-foreground uppercase tracking-wider">Próximos Clientes Hoje</h3>
              
              <div className="space-y-3">
                {apptsList.filter((a: any) => a.start_time.split('T')[0] === todayStr && a.status !== 'cancelled').length > 0 ? (
                  apptsList
                    .filter((a: any) => a.start_time.split('T')[0] === todayStr && a.status !== 'cancelled')
                    .sort((a, b) => a.start_time.localeCompare(b.start_time))
                    .map((appt: any) => (
                      <div 
                        key={appt.id}
                        className="flex justify-between items-center p-3 rounded bg-secondary/40 border border-border/50 text-xs"
                      >
                        <div className="space-y-1">
                          <p className="font-semibold text-foreground">{appt.customer?.full_name || 'Cliente'}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {appt.services?.name} | {new Date(appt.start_time).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                          appt.status === 'completed' 
                            ? 'bg-emerald-500/10 text-emerald-500' 
                            : 'bg-primary/10 text-primary'
                        }`}>
                          {appt.status === 'completed' ? 'Concluído' : 'Confirmado'}
                        </span>
                      </div>
                    ))
                ) : (
                  <p className="text-xs text-muted-foreground italic text-center py-4">Nenhum agendamento programado para hoje.</p>
                )}
              </div>
            </div>

          </div>

          {/* Right panel: Top Services / Operations metrics */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Top Services chart */}
            <div className="glass p-6 rounded-lg border border-border space-y-4">
              <h3 className="font-serif font-semibold text-sm text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" /> Serviços Populares
              </h3>

              {topServices.length > 0 ? (
                <div className="space-y-4">
                  {topServices.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary font-serif text-sm">#{idx + 1}</span>
                        <span className="text-foreground">{item.name}</span>
                      </div>
                      <span className="text-muted-foreground font-semibold bg-secondary px-2 py-0.5 rounded border border-border">
                        {item.count} vezes
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Nenhum serviço registrado.</p>
              )}
            </div>

            {/* Quick Status Ratios */}
            <div className="glass p-6 rounded-lg border border-border space-y-4">
              <h3 className="font-serif font-semibold text-sm text-foreground uppercase tracking-wider">Status da Agenda</h3>
              
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 bg-emerald-500/5 rounded border border-emerald-500/20 space-y-1">
                  <CheckCircle className="w-4.5 h-4.5 text-emerald-500 mx-auto" />
                  <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Concluídos</span>
                  <span className="text-lg font-serif font-bold text-foreground">{completedCount}</span>
                </div>
                <div className="p-3 bg-destructive/5 rounded border border-destructive/20 space-y-1">
                  <XCircle className="w-4.5 h-4.5 text-destructive mx-auto" />
                  <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Cancelados</span>
                  <span className="text-lg font-serif font-bold text-foreground">{cancelledCount}</span>
                </div>
              </div>
            </div>

          </div>

        </div>

      </main>
    </div>
  )
}
