'use client'

import React, { useEffect, useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Scissors, DollarSign, Calendar, Clock, Check, X, 
  AlertCircle, CheckCircle2, Loader2, ArrowUpRight, TrendingUp, Search, Crown, FileText, Users, BarChart3
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { DashboardSidebar } from '@/components/DashboardSidebar'
import { ReceiptModal } from '@/components/ReceiptModal'
import { confirmPaymentAction } from './actions'

type BarberInfo = {
  id: string
  profile_id: string
  full_name: string
  photo_url?: string | null
}

export default function PainelFinanceiro() {
  const router = useRouter()
  const [payments, setPayments] = useState<any[]>([])
  const [barbers, setBarbers] = useState<BarberInfo[]>([])
  const [userRole, setUserRole] = useState<'admin' | 'barber' | null>(null)
  const [adminBarberId, setAdminBarberId] = useState<string>('')
  const [filterBarberId, setFilterBarberId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  const [selectedReceiptPaymentId, setSelectedReceiptPaymentId] = useState<string | null>(null)

  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isPending, startTransition] = useTransition()

  const supabase = createClient()

  const loadPayments = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/entrar')
        return
      }

      // Check auth role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', session.user.id)
        .single()
      
      if (!profile || (profile.role !== 'admin' && profile.role !== 'barber')) {
        router.push('/painel')
        return
      }

      setUserRole(profile.role)

      // Fetch active barbers for avatar filter (admin view)
      const { data: dbBarbers } = await supabase
        .from('barbers')
        .select('id, is_active, photo_url, profiles (id, full_name)')
        .eq('is_active', true)

      if (dbBarbers) {
        const formatted: BarberInfo[] = dbBarbers
          .filter((b: any) => b.profiles)
          .map((b: any) => ({
            id: b.id,
            profile_id: b.profiles?.id || b.id,
            full_name: b.profiles.full_name,
            photo_url: b.photo_url || (b.profiles.full_name?.toLowerCase()?.includes('sergio') ? '/barbers/sergio.jpg' : null)
          }))
        setBarbers(formatted)

        const me = formatted.find((b: any) => b.id === session.user.id || b.profile_id === session.user.id)
        if (me) {
          setAdminBarberId(me.id)
          setFilterBarberId((prev) => (prev ? prev : me.id))
        } else {
          setAdminBarberId(session.user.id)
          setFilterBarberId((prev) => (prev ? prev : session.user.id))
        }
      }

      // Fetch payment entries joining appointments
      const { data: payLogs } = await supabase
        .from('payments')
        .select(`
          id,
          appointment_id,
          total_amount,
          deposit_amount,
          status,
          method,
          notes,
          created_at,
          appointments (
            customer_id,
            barber_id,
            services (name)
          )
        `)
        .order('created_at', { ascending: false })

      // Fetch package subscriptions
      const { data: pkgSubs } = await supabase
        .from('package_subscriptions')
        .select(`
          id,
          customer_id,
          barber_id,
          package_price,
          payment_status,
          created_at,
          services (name)
        `)
        .order('created_at', { ascending: false })

      const paymentsList = payLogs || []
      const packagesList = pkgSubs || []

      // Map profiles for customer and barber names
      const allIds = new Set<string>()
      paymentsList.forEach(p => {
        const appt: any = Array.isArray(p.appointments) ? p.appointments[0] : p.appointments
        if (appt?.customer_id) allIds.add(appt.customer_id)
        if (appt?.barber_id) allIds.add(appt.barber_id)
      })
      packagesList.forEach(pkg => {
        if (pkg.customer_id) allIds.add(pkg.customer_id)
        if (pkg.barber_id) allIds.add(pkg.barber_id)
      })

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', Array.from(allIds))

      const nameMap = (profilesData || []).reduce((acc: any, c: any) => {
        acc[c.id] = c.full_name
        return acc
      }, {})

      const enrichedPayments = paymentsList.map(p => {
        const appt: any = Array.isArray(p.appointments) ? p.appointments[0] : p.appointments
        const barberId = appt?.barber_id || ''
        let cName = 'Cliente Presencial'
        if (appt?.customer_id) {
          cName = nameMap[appt.customer_id] || 'Cliente'
        }
        return {
          id: p.id,
          appointment_id: p.appointment_id,
          barberId,
          barberName: nameMap[barberId] || 'Barbeiro',
          total_amount: Number(p.total_amount),
          deposit_amount: Number(p.deposit_amount),
          status: p.status,
          method: p.method,
          created_at: p.created_at,
          customerName: cName,
          serviceName: appt?.services?.name || 'Serviço',
          isPackage: false,
          hasNoShowFee: typeof p.notes === 'string' && p.notes.includes('Taxa no-show')
        }
      })

      const enrichedPackages = packagesList.map(pkg => {
        const cName = nameMap[pkg.customer_id] || 'Cliente'
        const barberId = pkg.barber_id || ''
        return {
          id: `pkg_${pkg.id}`,
          appointment_id: null,
          barberId,
          barberName: nameMap[barberId] || 'Barbeiro',
          total_amount: Number(pkg.package_price),
          deposit_amount: 0,
          status: pkg.payment_status,
          method: 'pix',
          created_at: pkg.created_at,
          customerName: cName,
          serviceName: (pkg.services as any)?.name || 'Pacote Mensal',
          isPackage: true
        }
      })

      const merged = [...enrichedPayments, ...enrichedPackages].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      setPayments(merged)
    } catch (err) {
      console.error('Error fetching payments logs:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPayments()
  }, [])

  // Filter payments by barber selection
  const barberFilteredPayments = useMemo(() => {
    if (userRole === 'barber' && adminBarberId) {
      return payments.filter(p => p.barberId === adminBarberId)
    }
    if (!filterBarberId || filterBarberId === 'all') {
      return payments
    }
    return payments.filter(p => p.barberId === filterBarberId)
  }, [payments, filterBarberId, userRole, adminBarberId])

  // Filter payments by search query
  const searchFilteredPayments = useMemo(() => {
    let result = barberFilteredPayments
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(p => 
        p.customerName.toLowerCase().includes(q) ||
        p.serviceName.toLowerCase().includes(q) ||
        p.status.toLowerCase().includes(q) ||
        p.barberName.toLowerCase().includes(q)
      )
    }
    return result
  }, [barberFilteredPayments, searchQuery])

  // Per-barber summary stats for "Todos" view & admin breakdown
  const perBarberStats = useMemo(() => {
    return barbers.map(b => {
      const bPayments = payments.filter(p => p.barberId === b.id)
      let confirmed = 0
      let deposits = 0
      let pending = 0
      let count = 0

      bPayments.forEach(p => {
        if (p.isPackage) {
          if (p.status === 'paid') confirmed += Number(p.total_amount)
        } else {
          if (p.status === 'confirmed_manually' || p.status === 'paid') {
            confirmed += Number(p.total_amount)
            if (p.method === 'pix') deposits += Number(p.deposit_amount)
          } else if (p.status === 'pending') {
            if (p.method === 'pix') pending += Number(p.deposit_amount)
          }
        }
        count++
      })

      return {
        barberId: b.id,
        fullName: b.full_name,
        firstName: b.full_name.split(' ')[0],
        photoUrl: b.photo_url,
        confirmed,
        deposits,
        pending,
        count
      }
    })
  }, [barbers, payments])

  // Total confirmed across all barbers for percentage calculation
  const grandTotalConfirmed = useMemo(() => {
    return perBarberStats.reduce((acc, b) => acc + b.confirmed, 0)
  }, [perBarberStats])

  const handleConfirmPayment = (payId: string, status: 'confirmed_manually' | 'paid' | 'refunded') => {
    setErrorMsg('')
    setSuccessMsg('')

    startTransition(async () => {
      const res = await confirmPaymentAction(payId, status)
      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg(res.message)
        loadPayments()
      }
    })
  }

  // Calculate metrics for current barber filter selection
  let totalConfirmed = 0
  let totalDeposits = 0
  let totalPending = 0

  barberFilteredPayments.forEach(p => {
    if (p.isPackage) {
      if (p.status === 'paid') {
        totalConfirmed += Number(p.total_amount)
      }
    } else {
      if (p.status === 'confirmed_manually' || p.status === 'paid') {
        totalConfirmed += Number(p.total_amount)
        if (p.method === 'pix') {
          totalDeposits += Number(p.deposit_amount)
        }
      } else if (p.status === 'pending') {
        if (p.method === 'pix') {
          totalPending += Number(p.deposit_amount)
        }
      }
    }
  })

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col md:flex-row justify-center items-center gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Carregando painel financeiro...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <DashboardSidebar />

      <main className="flex-grow p-6 sm:p-8 space-y-6 overflow-y-auto">
        
        {/* Title */}
        <div className="border-b border-border/40 pb-6">
          <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-2">
            <DollarSign className="w-7 h-7 text-emerald-500 shrink-0" />
            Controle Financeiro & Fluxo de Caixa 💰
          </h1>
          <p className="text-xs text-muted-foreground">Acompanhe entradas de caixa, liquidações e faturamento por barbeiro</p>
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
                Filtrar Financeiro por Barbeiro:
              </span>
              <span className="text-[11px] text-muted-foreground font-semibold">
                Exibindo {barberFilteredPayments.length} de {payments.length} lançamento(s)
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
                    ({payments.length})
                  </span>
                </div>
              </button>

              {/* Barber Avatars */}
              {barbers.map((b) => {
                const isSelected = filterBarberId === b.id
                const count = payments.filter(p => p.barberId === b.id).length
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

        {/* ── Per-Barber Comparison Section ("Todos" View / Admin Executive Breakdown) ── */}
        {userRole === 'admin' && filterBarberId === 'all' && (
          <div className="glass p-5 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-secondary/30 to-transparent space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
                <h3 className="font-serif font-bold text-base text-foreground">
                  Comparativo de Desempenho por Barbeiro
                </h3>
              </div>
              <span className="text-xs text-muted-foreground font-medium">
                Faturamento Total Liquidado: <strong className="text-emerald-400 font-mono font-bold">R$&nbsp;{grandTotalConfirmed.toFixed(2)}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {perBarberStats.map((stat) => {
                const pct = grandTotalConfirmed > 0 ? Math.round((stat.confirmed / grandTotalConfirmed) * 100) : 0

                return (
                  <div
                    key={stat.barberId}
                    className="p-4 rounded-xl bg-card/80 border border-border/60 space-y-3 shadow-md hover:border-primary/40 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full border border-primary/40 overflow-hidden shrink-0 bg-secondary flex items-center justify-center text-primary font-bold">
                          {stat.photoUrl ? (
                            <img src={stat.photoUrl} alt={stat.fullName} className="w-full h-full object-cover" />
                          ) : (
                            stat.firstName.charAt(0)
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-foreground">{stat.fullName}</h4>
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            {stat.count} transações
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                        {pct}%
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Faturamento Liquidado:</span>
                        <span className="font-bold font-mono text-emerald-400">R$&nbsp;{stat.confirmed.toFixed(2)}</span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden border border-border/40">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-1 border-t border-border/30">
                      <span>Sinais Pix: <strong className="text-foreground">R$&nbsp;{stat.deposits.toFixed(2)}</strong></span>
                      {stat.pending > 0 && (
                        <span className="text-amber-400 font-semibold">Pendente: R$&nbsp;{stat.pending.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Finance stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          <div className="glass p-5 rounded-2xl border border-emerald-500/30 flex justify-between items-center shadow-lg shadow-emerald-500/5 bg-gradient-to-br from-emerald-500/5 to-transparent">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider block">
                Faturamento Total Liquidado
                {filterBarberId !== 'all' && (
                  <span className="text-foreground font-extrabold ml-1">
                    ({barbers.find(b => b.id === filterBarberId)?.full_name.split(' ')[0] || 'Barbeiro'})
                  </span>
                )}
              </span>
              <span className="text-2xl font-serif font-bold text-emerald-500">R$&nbsp;{totalConfirmed.toFixed(2)}</span>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>

          <div className="glass p-5 rounded-2xl border border-primary/30 flex justify-between items-center shadow-lg shadow-primary/5 bg-gradient-to-br from-primary/5 to-transparent">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-primary tracking-wider block">Sinais Pix Confirmados</span>
              <span className="text-2xl font-serif font-bold text-foreground">R$&nbsp;{totalDeposits.toFixed(2)}</span>
            </div>
            <div className="p-3 rounded-xl bg-primary/15 text-primary border border-primary/20">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>

          <div className="glass p-5 rounded-2xl border border-amber-500/30 flex justify-between items-center shadow-lg shadow-amber-500/5 bg-gradient-to-br from-amber-500/5 to-transparent">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-amber-500 tracking-wider block">Sinais Pix Pendentes</span>
              <span className="text-2xl font-serif font-bold text-amber-500">R$&nbsp;{totalPending.toFixed(2)}</span>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/20">
              <Clock className="w-6 h-6" />
            </div>
          </div>

        </div>

        {/* Search & filters */}
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por cliente, serviço, barbeiro ou status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-secondary/50 border border-border focus:border-primary rounded-xl text-base outline-none text-foreground font-medium"
          />
        </div>

        {/* Payments list table */}
        <div className="glass rounded-xl border border-border/80 overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse min-w-[750px]">
            <thead>
              <tr className="bg-secondary/40 border-b border-border/60 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                <th className="p-4">Data Registro</th>
                <th className="p-4">Cliente</th>
                <th className="p-4">Barbeiro</th>
                <th className="p-4">Serviço</th>
                <th className="p-4">Valor Total</th>
                <th className="p-4">Sinal (50%)</th>
                <th className="p-4">Método</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-xs">
              {searchFilteredPayments.length > 0 ? (
                searchFilteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="p-4 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                      {formatDate(p.created_at)} às {formatTime(p.created_at)}
                    </td>
                    <td className="p-4 font-semibold text-foreground">
                      <div className="flex items-center gap-2">
                        <span>{p.customerName}</span>
                        {p.isPackage && (
                          <span className="inline-flex items-center gap-0.5 bg-primary/15 text-primary border border-primary/25 text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wide">
                            <Crown className="w-2.5 h-2.5" />
                            PACOTE
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 whitespace-nowrap font-medium">
                      <span className="inline-flex items-center gap-1 bg-secondary text-foreground border border-border/80 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        <Scissors className="w-3 h-3 text-primary" />
                        {p.barberName?.split(' ')[0]}
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap text-muted-foreground font-medium">
                      {p.serviceName}
                    </td>
                    <td className="p-4 whitespace-nowrap font-mono text-foreground font-bold">
                      <div className="flex flex-col gap-1">
                        <span>R$&nbsp;{Number(p.total_amount).toFixed(2)}</span>
                        {p.hasNoShowFee && (
                          <span className="text-[8px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/25 tracking-wider inline-block w-fit">
                            Taxa No-Show
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 whitespace-nowrap font-mono text-primary font-bold">
                      {p.isPackage ? (
                        <span className="text-muted-foreground font-sans text-[11px] font-normal">—</span>
                      ) : (
                        `R$ ${Number(p.deposit_amount).toFixed(2)}`
                      )}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className={`text-[9px] uppercase font-bold px-2.5 py-1 rounded-full border ${
                        p.method === 'cash'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : p.method === 'card'
                          ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                          : p.method === 'pix'
                          ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                          : 'bg-muted text-muted-foreground border-border'
                      }`}>
                        {p.method === 'cash' ? 'Dinheiro' : p.method === 'card' ? 'Cartão' : p.method === 'pix' ? 'Pix' : (p.method || '—')}
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className={`text-[9px] uppercase font-bold px-2.5 py-1 rounded-full border ${
                        p.status === 'confirmed_manually' || p.status === 'paid'
                          ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/25' 
                          : p.status === 'refunded' || p.status === 'cancelled'
                          ? 'bg-destructive/15 text-destructive border-destructive/25'
                          : 'bg-amber-500/15 text-amber-500 border-amber-500/25'
                      }`}>
                        {p.status === 'confirmed_manually'
                          ? 'Confirmado ✓'
                          : p.status === 'paid'
                          ? 'Pago ✓'
                          : p.status === 'refunded' || p.status === 'cancelled'
                          ? 'Estornado ✕'
                          : 'Pendente ⏳'}
                      </span>
                    </td>
                    <td className="p-4 text-right whitespace-nowrap space-x-1.5">
                      {p.isPackage ? (
                        <>
                          {p.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleConfirmPayment(p.id, 'paid')}
                                disabled={isPending}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all shadow"
                              >
                                Marcar como Pago
                              </button>
                              <button
                                onClick={() => handleConfirmPayment(p.id, 'refunded')}
                                disabled={isPending}
                                className="px-2.5 py-1 bg-destructive/10 hover:bg-destructive/20 border border-destructive/20 text-destructive rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                              >
                                Cancelar
                              </button>
                            </>
                          )}
                          {p.status === 'paid' && (
                            <>
                              <button
                                onClick={() => setSelectedReceiptPaymentId(p.id)}
                                className="px-2.5 py-1 bg-primary/15 hover:bg-primary/25 border border-primary/30 text-primary font-bold rounded-lg text-[10px] cursor-pointer transition-all inline-flex items-center gap-1 shadow-sm"
                                title="Emitir Recibo"
                              >
                                <FileText className="w-3 h-3 text-primary" />
                                <span>Recibo</span>
                              </button>
                              <button
                                onClick={() => handleConfirmPayment(p.id, 'refunded')}
                                disabled={isPending}
                                className="px-2.5 py-1 bg-destructive/10 hover:bg-destructive/20 border border-destructive/20 text-destructive rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                              >
                                Estornar
                              </button>
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          {p.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleConfirmPayment(p.id, 'confirmed_manually')}
                                disabled={isPending}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all shadow"
                              >
                                Confirmar Sinal
                              </button>
                              <button
                                onClick={() => handleConfirmPayment(p.id, 'paid')}
                                disabled={isPending}
                                className="px-2.5 py-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-[10px] font-bold cursor-pointer transition-all shadow"
                              >
                                Pago Total
                              </button>
                            </>
                          )}
                          {(p.status === 'confirmed_manually' || p.status === 'paid') && (
                            <>
                              <button
                                onClick={() => setSelectedReceiptPaymentId(p.id)}
                                className="px-2.5 py-1 bg-primary/15 hover:bg-primary/25 border border-primary/30 text-primary font-bold rounded-lg text-[10px] cursor-pointer transition-all inline-flex items-center gap-1 shadow-sm"
                                title="Emitir Recibo"
                              >
                                <FileText className="w-3 h-3 text-primary" />
                                <span>Recibo</span>
                              </button>
                              <button
                                onClick={() => handleConfirmPayment(p.id, 'refunded')}
                                disabled={isPending}
                                className="px-2.5 py-1 bg-destructive/10 hover:bg-destructive/20 border border-destructive/20 text-destructive rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                              >
                                Estornar
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-muted-foreground italic">
                    Nenhum lançamento financeiro encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Receipt Modal */}
        {selectedReceiptPaymentId && (
          <ReceiptModal
            paymentId={selectedReceiptPaymentId}
            onClose={() => setSelectedReceiptPaymentId(null)}
          />
        )}

      </main>
    </div>
  )
}
