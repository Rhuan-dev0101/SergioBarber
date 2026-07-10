'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Scissors, DollarSign, Calendar, Clock, Check, X, 
  AlertCircle, CheckCircle2, Loader2, ArrowUpRight, TrendingUp, Search 
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { DashboardSidebar } from '@/components/DashboardSidebar'
import { confirmPaymentAction } from './actions'

export default function PainelFinanceiro() {
  const router = useRouter()
  const [payments, setPayments] = useState<any[]>([])
  const [filteredPayments, setFilteredPayments] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

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
          created_at,
          appointments (customer_id, services (name))
        `)
        .order('created_at', { ascending: false })

      if (payLogs && payLogs.length > 0) {
        // Fetch profiles to map names of customers
        const customerIds = Array.from(
          new Set(payLogs.map(p => {
            const appt: any = Array.isArray(p.appointments) ? p.appointments[0] : p.appointments
            return appt?.customer_id
          }).filter(Boolean))
        )

        const { data: customers } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', customerIds)

        const nameMap = (customers || []).reduce((acc: any, c: any) => {
          acc[c.id] = c.full_name
          return acc
        }, {})

        const enriched = payLogs.map(p => {
          let cName = 'Cliente Presencial'
          const appt: any = Array.isArray(p.appointments) ? p.appointments[0] : p.appointments
          if (appt?.customer_id) {
            cName = nameMap[appt.customer_id] || 'Cliente'
          }
          return {
            ...p,
            customerName: cName,
            serviceName: appt?.services?.name || 'Serviço'
          }
        })
        setPayments(enriched)
      } else {
        setPayments([])
      }
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
    if (p.status === 'confirmed_manually' || p.status === 'paid') {
      totalConfirmed += Number(p.total_amount)
      totalDeposits += Number(p.deposit_amount)
    } else if (p.status === 'pending') {
      totalPending += Number(p.deposit_amount)
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
        <div className="border-b border-border/40 pb-4">
          <h1 className="text-2xl font-serif font-bold text-foreground">Controle Financeiro</h1>
          <p className="text-xs text-muted-foreground">Verifique a entrada de caixa e aprove os depósitos de sinal Pix</p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded flex items-start gap-2 text-xs text-destructive">
            <AlertCircle className="w-4.5 h-4.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded flex items-start gap-2 text-xs text-emerald-500">
            <CheckCircle2 className="w-4.5 h-4.5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Finance stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          <div className="glass p-5 rounded-lg border border-border flex justify-between items-center">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Faturamento Total Confirmado</span>
              <span className="text-xl font-serif font-bold text-emerald-500">R$ {totalConfirmed.toFixed(2)}</span>
            </div>
            <div className="p-2 rounded bg-emerald-500/10 text-emerald-500">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          <div className="glass p-5 rounded-lg border border-border flex justify-between items-center">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Total em Sinais Pix Recebidos</span>
              <span className="text-xl font-serif font-bold text-foreground">R$ {totalDeposits.toFixed(2)}</span>
            </div>
            <div className="p-2 rounded bg-primary/10 text-primary">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div className="glass p-5 rounded-lg border border-border flex justify-between items-center">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Sinais Pix Pendentes</span>
              <span className="text-xl font-serif font-bold text-amber-500">R$ {totalPending.toFixed(2)}</span>
            </div>
            <div className="p-2 rounded bg-amber-500/10 text-amber-500">
              <Clock className="w-5 h-5" />
            </div>
          </div>

        </div>

        {/* Search & filters */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por cliente, serviço ou status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-secondary/40 border border-border focus:border-primary rounded text-xs outline-none text-foreground"
          />
        </div>

        {/* Payments list table */}
        <div className="glass rounded-lg border border-border overflow-x-auto shadow">
          <table className="w-full text-left border-collapse min-w-[700px]">
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
                  <tr key={p.id} className="hover:bg-secondary/15 transition-colors">
                    <td className="p-4 whitespace-nowrap text-muted-foreground font-mono">
                      {formatDate(p.created_at)} às {formatTime(p.created_at)}
                    </td>
                    <td className="p-4 font-medium text-foreground">
                      {p.customerName}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      {p.serviceName}
                    </td>
                    <td className="p-4 whitespace-nowrap font-mono text-foreground">
                      R$ {Number(p.total_amount).toFixed(2)}
                    </td>
                    <td className="p-4 whitespace-nowrap font-mono text-primary font-bold">
                      R$ {Number(p.deposit_amount).toFixed(2)}
                    </td>
                    <td className="p-4 whitespace-nowrap uppercase text-muted-foreground">
                      {p.method}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${
                        p.status === 'confirmed_manually' || p.status === 'paid'
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                          : p.status === 'refunded'
                          ? 'bg-destructive/10 text-destructive border border-destructive/20'
                          : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                      }`}>
                        {p.status === 'confirmed_manually' ? 'Confirmado' : p.status === 'paid' ? 'Pago' : p.status === 'refunded' ? 'Estornado' : 'Pendente'}
                      </span>
                    </td>
                    <td className="p-4 text-right whitespace-nowrap space-x-1">
                      {p.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleConfirmPayment(p.id, 'confirmed_manually')}
                            disabled={isPending}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-semibold cursor-pointer"
                          >
                            Confirmar Depósito
                          </button>
                          <button
                            onClick={() => handleConfirmPayment(p.id, 'paid')}
                            disabled={isPending}
                            className="px-2 py-1 bg-primary hover:bg-primary-hover text-primary-foreground rounded text-[10px] font-semibold cursor-pointer"
                          >
                            Pago Total
                          </button>
                        </>
                      )}
                      {(p.status === 'confirmed_manually' || p.status === 'paid') && (
                        <button
                          onClick={() => handleConfirmPayment(p.id, 'refunded')}
                          disabled={isPending}
                          className="px-2 py-1 bg-destructive/10 hover:bg-destructive/20 border border-destructive/20 text-destructive rounded text-[10px] font-semibold cursor-pointer"
                        >
                          Estornar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground italic">
                    Nenhum lançamento financeiro registrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </main>
    </div>
  )
}
