'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Scissors, DollarSign, Calendar, Clock, Check, X, 
  AlertCircle, CheckCircle2, Loader2, ArrowUpRight, TrendingUp, Search, Crown, FileText
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { DashboardSidebar } from '@/components/DashboardSidebar'
import { ReceiptModal } from '@/components/ReceiptModal'
import { confirmPaymentAction } from './actions'

export default function PainelFinanceiro() {
  const router = useRouter()
  const [payments, setPayments] = useState<any[]>([])
  const [filteredPayments, setFilteredPayments] = useState<any[]>([])
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

      // Check admin auth
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()
      
      if (!profile || profile.role !== 'admin') {
        router.push('/painel') // regular barbers redirect to overview
        return
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
          appointments (customer_id, services (name))
        `)
        .order('created_at', { ascending: false })

      // Fetch package subscriptions
      const { data: pkgSubs } = await supabase
        .from('package_subscriptions')
        .select(`
          id,
          customer_id,
          package_price,
          payment_status,
          created_at,
          services (name)
        `)

      const paymentsList = payLogs || []
      const packagesList = pkgSubs || []

      // Fetch profiles to map names of customers
      const payCustomerIds = paymentsList.map(p => {
        const appt: any = Array.isArray(p.appointments) ? p.appointments[0] : p.appointments
        return appt?.customer_id
      }).filter(Boolean)

      const pkgCustomerIds = packagesList.map(pkg => pkg.customer_id).filter(Boolean)

      const customerIds = Array.from(new Set([...payCustomerIds, ...pkgCustomerIds]))

      const { data: customers } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', customerIds)

      const nameMap = (customers || []).reduce((acc: any, c: any) => {
        acc[c.id] = c.full_name
        return acc
      }, {})

      const enrichedPayments = paymentsList.map(p => {
        let cName = 'Cliente Presencial'
        const appt: any = Array.isArray(p.appointments) ? p.appointments[0] : p.appointments
        if (appt?.customer_id) {
          cName = nameMap[appt.customer_id] || 'Cliente'
        }
        return {
          id: p.id,
          appointment_id: p.appointment_id,
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
        return {
          id: `pkg_${pkg.id}`,
          appointment_id: null,
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

  // Filter payments
  useEffect(() => {
    let result = payments
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(p => 
        p.customerName.toLowerCase().includes(q) ||
        p.serviceName.toLowerCase().includes(q) ||
        p.status.toLowerCase().includes(q)
      )
    }
    setFilteredPayments(result)
  }, [payments, searchQuery])

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

  // Calculate metrics
  let totalConfirmed = 0
  let totalDeposits = 0
  let totalPending = 0

  payments.forEach(p => {
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
          <p className="text-xs text-muted-foreground">Acompanhe entradas de caixa, estornos e aprove sinaleiras via Pix dos agendamentos</p>
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

        {/* Finance stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          <div className="glass p-5 rounded-2xl border border-emerald-500/30 flex justify-between items-center shadow-lg shadow-emerald-500/5 bg-gradient-to-br from-emerald-500/5 to-transparent">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider block">Faturamento Total Liquidado</span>
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
            placeholder="Buscar por cliente, serviço ou status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-secondary/50 border border-border focus:border-primary rounded-xl text-xs outline-none text-foreground font-medium"
          />
        </div>

        {/* Payments list table */}
        <div className="glass rounded-xl border border-border/80 overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse min-w-[750px]">
            <thead>
              <tr className="bg-secondary/40 border-b border-border/60 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                <th className="p-4">Data Registro</th>
                <th className="p-4">Cliente</th>
                <th className="p-4">Serviço</th>
                <th className="p-4">Valor Total</th>
                <th className="p-4">Sinal (50%)</th>
                <th className="p-4">Método</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-xs">
              {filteredPayments.length > 0 ? (
                filteredPayments.map((p) => (
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
                  <td colSpan={8} className="p-10 text-center text-muted-foreground italic">
                    Nenhum lançamento financeiro registrado.
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
