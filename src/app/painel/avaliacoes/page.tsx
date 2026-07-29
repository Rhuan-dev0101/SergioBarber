'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Star, CheckCircle2, XCircle, Clock, Filter, 
  Search, User, Calendar, Loader2, AlertCircle, Sparkles, MessageSquare, RefreshCw 
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { DashboardSidebar } from '@/components/DashboardSidebar'

type ReviewStatus = 'pending' | 'approved' | 'rejected'

interface ReviewItem {
  id: string
  appointment_id: string
  customer_id: string
  barber_id: string
  rating: number
  comment: string | null
  status: ReviewStatus
  created_at: string
  customerName?: string
  barberName?: string
  serviceName?: string
  appointmentDate?: string
}

export default function AdminAvaliacoesPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [searchQuery, setSearchQuery] = useState('')
  const [isPending, startTransition] = useTransition()
  
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const loadData = async () => {
    try {
      setErrorMsg('')
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/entrar')
        return
      }

      // Check admin role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (profile?.role !== 'admin') {
        setUserRole(profile?.role || 'barber')
        setLoading(false)
        return
      }

      setUserRole('admin')

      // Fetch all reviews
      const { data: dbReviews, error: reviewsError } = await supabase
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false })

      if (reviewsError) {
        console.error('Error loading reviews:', reviewsError)
        setErrorMsg('Erro ao carregar avaliações do banco de dados.')
        setLoading(false)
        return
      }

      if (!dbReviews || dbReviews.length === 0) {
        setReviews([])
        setLoading(false)
        return
      }

      // Collect IDs for enrichment
      const customerIds = Array.from(new Set(dbReviews.map(r => r.customer_id)))
      const barberIds = Array.from(new Set(dbReviews.map(r => r.barber_id)))
      const apptIds = Array.from(new Set(dbReviews.map(r => r.appointment_id)))

      // Fetch Profiles (Customers)
      const { data: customerProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', customerIds)

      const customerMap = (customerProfiles || []).reduce((acc: any, c: any) => {
        acc[c.id] = c.full_name
        return acc
      }, {})

      // Fetch Barbers profiles
      // barber_id in reviews references public.barbers(id).
      // Let's query barbers joining profiles, or direct profiles if id matches.
      const { data: barberData } = await supabase
        .from('barbers')
        .select('id, profiles(full_name)')
        .in('id', barberIds)

      const barberMap: Record<string, string> = {}
      if (barberData && barberData.length > 0) {
        barberData.forEach((b: any) => {
          barberMap[b.id] = b.profiles?.full_name || 'Barbeiro'
        })
      }

      // Fallback profile query for barberIds not found in barbers table
      const missingBarberIds = barberIds.filter(id => !barberMap[id])
      if (missingBarberIds.length > 0) {
        const { data: fallbackProfiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', missingBarberIds)
        
        fallbackProfiles?.forEach((p: any) => {
          barberMap[p.id] = p.full_name
        })
      }

      // Fetch Appointments
      const { data: apptData } = await supabase
        .from('appointments')
        .select('id, start_time, services(name)')
        .in('id', apptIds)

      const apptMap = (apptData || []).reduce((acc: any, a: any) => {
        acc[a.id] = {
          startTime: a.start_time,
          serviceName: (a.services as any)?.name || 'Corte/Serviço'
        }
        return acc
      }, {})

      // Enrich reviews
      const enriched: ReviewItem[] = dbReviews.map((r: any) => ({
        ...r,
        customerName: customerMap[r.customer_id] || 'Cliente Desconhecido',
        barberName: barberMap[r.barber_id] || 'Barbeiro',
        serviceName: apptMap[r.appointment_id]?.serviceName || 'Serviço',
        appointmentDate: apptMap[r.appointment_id]?.startTime || r.created_at
      }))

      setReviews(enriched)
    } catch (err) {
      console.error('Error fetching admin reviews:', err)
      setErrorMsg('Erro inesperado ao carregar avaliações.')
    } finally {
      setLoading(false)
    }
  }

  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const handleUpdateStatus = (reviewId: string, newStatus: ReviewStatus) => {
    setActionFeedback(null)
    startTransition(async () => {
      try {
        const { error } = await supabase
          .from('reviews')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', reviewId)

        if (error) {
          setActionFeedback({
            type: 'error',
            message: `Erro ao alterar status: ${error.message}`
          })
        } else {
          setActionFeedback({
            type: 'success',
            message: `Avaliação ${newStatus === 'approved' ? 'aprovada' : 'rejeitada'} com sucesso!`
          })
          // Local update
          setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, status: newStatus } : r))
        }
      } catch (err: any) {
        setActionFeedback({
          type: 'error',
          message: 'Falha ao atualizar o status da avaliação.'
        })
      }
    })
  }

  const pendingCount = reviews.filter(r => r.status === 'pending').length
  const approvedCount = reviews.filter(r => r.status === 'approved').length
  const rejectedCount = reviews.filter(r => r.status === 'rejected').length

  const filteredReviews = reviews.filter(r => {
    if (activeTab !== 'all' && r.status !== activeTab) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchCustomer = r.customerName?.toLowerCase().includes(q)
      const matchBarber = r.barberName?.toLowerCase().includes(q)
      const matchComment = r.comment?.toLowerCase().includes(q)
      const matchService = r.serviceName?.toLowerCase().includes(q)
      return matchCustomer || matchBarber || matchComment || matchService
    }
    return true
  })

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background text-foreground">
        <DashboardSidebar />
        <main className="flex-1 p-8 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground mt-2">Carregando avaliações...</p>
        </main>
      </div>
    )
  }

  if (userRole !== 'admin') {
    return (
      <div className="flex min-h-screen bg-background text-foreground">
        <DashboardSidebar />
        <main className="flex-1 p-8 flex flex-col items-center justify-center text-center">
          <AlertCircle className="w-12 h-12 text-destructive mb-3" />
          <h2 className="text-xl font-serif font-bold">Acesso Restrito</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Esta página é exclusiva para administradores da barbearia.
          </p>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <DashboardSidebar />

      <main className="flex-1 p-4 sm:p-8 space-y-6 max-w-7xl mx-auto w-full">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/60 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-serif font-bold">Moderação de Avaliações</h1>
              {pendingCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                  {pendingCount} Pendente{pendingCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Aprove ou rejeite avaliações enviadas pelos clientes antes da exibição pública no site.
            </p>
          </div>

          <button
            onClick={() => loadData()}
            disabled={isPending}
            className="flex items-center gap-2 px-3.5 py-2 bg-secondary hover:bg-muted border border-border text-foreground text-xs font-semibold rounded-lg transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>

        {/* Feedback Alert */}
        {actionFeedback && (
          <div className={`p-4 rounded-lg border text-xs flex items-center justify-between gap-2 ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-destructive/10 border-destructive/20 text-destructive'
          }`}>
            <div className="flex items-center gap-2">
              {actionFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{actionFeedback.message}</span>
            </div>
            <button onClick={() => setActionFeedback(null)} className="text-muted-foreground hover:text-foreground">
              ✕
            </button>
          </div>
        )}

        {/* Control Bar: Tabs & Search */}
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-secondary/30 p-3 rounded-xl border border-border/60">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'pending'
                  ? 'bg-amber-500 text-black shadow-md font-bold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Pendentes ({pendingCount})
            </button>

            <button
              onClick={() => setActiveTab('approved')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'approved'
                  ? 'bg-emerald-600 text-white shadow-md font-bold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Aprovadas ({approvedCount})
            </button>

            <button
              onClick={() => setActiveTab('rejected')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'rejected'
                  ? 'bg-destructive text-destructive-foreground shadow-md font-bold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              Rejeitadas ({rejectedCount})
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'all'
                  ? 'bg-primary text-primary-foreground shadow-md font-bold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              Todas ({reviews.length})
            </button>
          </div>

          {/* Search bar */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar cliente, barbeiro, texto..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Reviews Grid / List */}
        {filteredReviews.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredReviews.map((review) => (
              <div
                key={review.id}
                className="glass p-5 rounded-xl border border-border/80 hover:border-primary/30 transition-all flex flex-col justify-between space-y-4 shadow-sm"
              >
                <div className="space-y-3">
                  {/* Top info row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">{review.customerName}</span>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-primary" />
                        Barbeiro: <strong className="text-foreground">{review.barberName}</strong>
                      </p>
                    </div>

                    {/* Status Badge */}
                    <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 ${
                      review.status === 'pending'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : review.status === 'approved'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-destructive/10 text-destructive border-destructive/30'
                    }`}>
                      {review.status === 'pending' && <Clock className="w-3 h-3" />}
                      {review.status === 'approved' && <CheckCircle2 className="w-3 h-3" />}
                      {review.status === 'rejected' && <XCircle className="w-3 h-3" />}
                      {review.status === 'pending' ? 'Pendente' : review.status === 'approved' ? 'Aprovada' : 'Rejeitada'}
                    </span>
                  </div>

                  {/* Rating Stars & Service */}
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-secondary/30 p-2.5 rounded-lg border border-border/40">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            review.rating >= star
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-muted-foreground/30'
                          }`}
                        />
                      ))}
                      <span className="text-xs font-bold text-amber-400 ml-1">
                        {review.rating}.0
                      </span>
                    </div>

                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-primary" />
                      {review.serviceName} • {formatDate(review.appointmentDate || review.created_at)}
                    </span>
                  </div>

                  {/* Comment */}
                  <div className="p-3 bg-card/60 rounded-lg border border-border/40 min-h-[60px] flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 text-primary/70 shrink-0 mt-0.5" />
                    {review.comment ? (
                      <p className="text-xs text-foreground italic leading-relaxed">
                        "{review.comment}"
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/60 italic">
                        Sem comentário em texto.
                      </p>
                    )}
                  </div>
                </div>

                {/* Bottom Action Buttons */}
                <div className="pt-3 border-t border-border/40 flex items-center justify-end gap-2">
                  {review.status !== 'rejected' && (
                    <button
                      onClick={() => handleUpdateStatus(review.id, 'rejected')}
                      disabled={isPending}
                      className="px-3.5 py-1.5 bg-destructive/10 hover:bg-destructive/20 border border-destructive/30 text-destructive text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Rejeitar
                    </button>
                  )}

                  {review.status !== 'approved' && (
                    <button
                      onClick={() => handleUpdateStatus(review.id, 'approved')}
                      disabled={isPending}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Aprovar
                    </button>
                  )}
                </div>

              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center bg-secondary/20 border border-border/60 rounded-xl space-y-3">
            <Star className="w-10 h-10 text-muted-foreground/40 mx-auto" />
            <h3 className="text-sm font-semibold text-foreground">Nenhuma avaliação encontrada</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {searchQuery ? 'Tente ajustar sua busca por nome ou termo.' : 'Não há avaliações nesta categoria no momento.'}
            </p>
          </div>
        )}

      </main>
    </div>
  )
}
