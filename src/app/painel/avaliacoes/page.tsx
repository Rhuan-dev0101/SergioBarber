'use client'

import Image from 'next/image'
import React, { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Star, CheckCircle2, XCircle, Clock, Filter, 
  Search, User, Calendar, Loader2, AlertCircle, Sparkles, MessageSquare, RefreshCw,
  Trash2, Eye, X, Image as ImageIcon, Award, BarChart3
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
  photo_url?: string | null
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
  const [barberFilter, setBarberFilter] = useState<string>('all')
  const [isPending, startTransition] = useTransition()
  
  const [errorMsg, setErrorMsg] = useState('')
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  
  // Modal states
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; customer: string } | null>(null)

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

  useEffect(() => {
    loadData()
  }, [])

  // Action 1 & 2: Update status (Approve / Reprove)
  const handleUpdateStatus = (reviewId: string, newStatus: ReviewStatus) => {
    setActionFeedback(null)
    startTransition(async () => {
      try {
        const { error } = await supabase
          .from('reviews')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', reviewId)

        if (error) {
          console.error(error)
          setActionFeedback({
            type: 'error',
            message: 'Não foi possível alterar o status da avaliação. Tente novamente.'
          })
        } else {
          setActionFeedback({
            type: 'success',
            message: `Avaliação ${newStatus === 'approved' ? 'aprovada' : 'reprovada'} com sucesso!`
          })
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

  // Action 3: Delete review permanently
  const handleDeleteReview = (reviewId: string) => {
    setActionFeedback(null)
    startTransition(async () => {
      try {
        const { error } = await supabase
          .from('reviews')
          .delete()
          .eq('id', reviewId)

        if (error) {
          console.error(error)
          setActionFeedback({
            type: 'error',
            message: 'Não foi possível excluir a avaliação. Tente novamente.'
          })
        } else {
          setActionFeedback({
            type: 'success',
            message: 'Avaliação apagada permanentemente com sucesso.'
          })
          setReviews(prev => prev.filter(r => r.id !== reviewId))
        }
      } catch (err: any) {
        setActionFeedback({
          type: 'error',
          message: 'Falha ao apagar avaliação.'
        })
      } finally {
        setDeleteConfirmId(null)
      }
    })
  }

  // Counts & Calculations
  const pendingCount = reviews.filter(r => r.status === 'pending').length
  const approvedCount = reviews.filter(r => r.status === 'approved').length
  const rejectedCount = reviews.filter(r => r.status === 'rejected').length
  
  const approvedReviews = reviews.filter(r => r.status === 'approved')
  const avgRating = approvedReviews.length > 0 
    ? (approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length).toFixed(1)
    : '0.0'

  // Extract unique barbers for filtering
  const barberList = Array.from(new Set(reviews.map(r => r.barberName).filter(Boolean)))

  // Filtered reviews
  const filteredReviews = reviews.filter(r => {
    if (activeTab !== 'all' && r.status !== activeTab) return false
    if (barberFilter !== 'all' && r.barberName !== barberFilter) return false
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
      <div className="flex flex-col md:flex-row min-h-screen bg-background text-foreground">
        <DashboardSidebar />
        <main className="flex-1 p-8 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground mt-3 font-medium">Carregando central de avaliações...</p>
        </main>
      </div>
    )
  }

  if (userRole !== 'admin') {
    return (
      <div className="flex flex-col md:flex-row min-h-screen bg-background text-foreground">
        <DashboardSidebar />
        <main className="flex-1 p-8 flex flex-col items-center justify-center text-center">
          <AlertCircle className="w-12 h-12 text-destructive mb-3" />
          <h2 className="text-xl font-serif font-bold">Acesso Restrito</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Esta página de moderação é exclusiva para administradores da barbearia.
          </p>
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background text-foreground">
      <DashboardSidebar />

      <main className="flex-1 p-4 sm:p-8 space-y-6 max-w-7xl mx-auto w-full">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/60 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-foreground">Avaliações de Clientes</h1>
              {pendingCount > 0 && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {pendingCount} Pendente{pendingCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Gerencie, aprove, reprove ou apague avaliações enviadas pelos clientes sobre os cortes executados.
            </p>
          </div>

          <button
            onClick={() => loadData()}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-muted border border-border/80 text-foreground text-xs font-semibold rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>

        {/* Feedback Alert Banner */}
        {actionFeedback && (
          <div className={`p-4 rounded-xl border text-xs sm:text-sm flex items-center justify-between gap-3 shadow-md ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-destructive/10 border-destructive/30 text-destructive'
          }`}>
            <div className="flex items-center gap-2">
              {actionFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span className="font-medium">{actionFeedback.message}</span>
            </div>
            <button aria-label="Fechar aviso" onClick={() => setActionFeedback(null)} className="text-muted-foreground hover:text-foreground p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
          <div className="bg-card/70 border border-border/70 p-4 rounded-xl space-y-1 shadow-sm">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Total de Avaliações</span>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-serif font-bold text-foreground">{reviews.length}</span>
              <BarChart3 className="w-5 h-5 text-muted-foreground/40" />
            </div>
          </div>

          <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl space-y-1 shadow-sm">
            <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">Pendentes</span>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-serif font-bold text-amber-400">{pendingCount}</span>
              <Clock className="w-5 h-5 text-amber-400/50" />
            </div>
          </div>

          <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl space-y-1 shadow-sm">
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">Aprovadas</span>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-serif font-bold text-emerald-400">{approvedCount}</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-400/50" />
            </div>
          </div>

          <div className="bg-destructive/5 border border-destructive/20 p-4 rounded-xl space-y-1 shadow-sm">
            <span className="text-[11px] font-semibold text-destructive uppercase tracking-wider block">Reprovadas</span>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-serif font-bold text-destructive">{rejectedCount}</span>
              <XCircle className="w-5 h-5 text-destructive/50" />
            </div>
          </div>

          <div className="col-span-2 lg:col-span-1 bg-primary/5 border border-primary/20 p-4 rounded-xl space-y-1 shadow-sm">
            <span className="text-[11px] font-semibold text-primary uppercase tracking-wider block">Média Aprovadas</span>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-serif font-bold text-amber-400">{avgRating}</span>
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              </div>
              <Award className="w-5 h-5 text-primary/50" />
            </div>
          </div>
        </div>

        {/* Control Toolbar: Tabs, Barbers Filter & Search */}
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 bg-secondary/30 p-3.5 rounded-2xl border border-border/60">
          
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'pending'
                  ? 'bg-amber-500 text-black shadow-md font-bold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Pendentes ({pendingCount})
            </button>

            <button
              onClick={() => setActiveTab('approved')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'approved'
                  ? 'bg-emerald-600 text-white shadow-md font-bold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Aprovadas ({approvedCount})
            </button>

            <button
              onClick={() => setActiveTab('rejected')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'rejected'
                  ? 'bg-destructive text-destructive-foreground shadow-md font-bold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              Reprovadas ({rejectedCount})
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-primary text-primary-foreground shadow-md font-bold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              }`}
            >
              Todas ({reviews.length})
            </button>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            {/* Barber filter */}
            {barberList.length > 0 && (
              <div className="relative w-full sm:w-auto">
                <select
                  value={barberFilter}
                  onChange={(e) => setBarberFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 rounded-xl bg-background border border-border text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer pr-8"
                >
                  <option value="all">Todos Barbeiros</option>
                  {barberList.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Buscar cliente, barbeiro, comentário" placeholder="Buscar cliente, barbeiro, comentário..."
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-background border border-border text-base text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {searchQuery && (
                <button aria-label="Limpar busca"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Reviews Cards Grid */}
        {filteredReviews.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReviews.map((review) => (
              <div
                key={review.id}
                className="bg-card/90 border border-border/80 rounded-2xl p-5 hover:border-primary/40 transition-all duration-200 flex flex-col justify-between space-y-4 shadow-md group"
              >
                <div className="space-y-3.5">
                  
                  {/* Top Bar: Customer & Status Badge */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-secondary/80 border border-primary/20 flex items-center justify-center text-primary font-serif font-bold text-base shrink-0">
                        {review.customerName ? review.customerName.charAt(0).toUpperCase() : 'C'}
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="font-semibold text-sm text-foreground leading-tight line-clamp-1">
                          {review.customerName}
                        </h4>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <User className="w-3 h-3 text-primary" />
                          Barbeiro: <strong className="text-foreground font-medium">{review.barberName}</strong>
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span className={`text-[10px] uppercase font-extrabold px-2.5 py-1 rounded-full border flex items-center gap-1 shrink-0 ${
                      review.status === 'pending'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : review.status === 'approved'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-destructive/10 text-destructive border-destructive/30'
                    }`}>
                      {review.status === 'pending' && <Clock className="w-3 h-3" />}
                      {review.status === 'approved' && <CheckCircle2 className="w-3 h-3" />}
                      {review.status === 'rejected' && <XCircle className="w-3 h-3" />}
                      {review.status === 'pending' ? 'Pendente' : review.status === 'approved' ? 'Aprovada' : 'Reprovada'}
                    </span>
                  </div>

                  {/* Rating Stars & Service Info */}
                  <div className="flex items-center justify-between gap-2 bg-secondary/30 p-2.5 rounded-xl border border-border/50">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3.5 h-3.5 ${
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
                      <Calendar className="w-3 h-3 text-primary/70" />
                      {review.serviceName}
                    </span>
                  </div>

                  {/* Comment Text Box */}
                  <div className="p-3 bg-secondary/20 rounded-xl border border-border/40 min-h-[56px] flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 text-primary/60 shrink-0 mt-0.5" />
                    {review.comment ? (
                      <p className="text-xs text-foreground italic leading-relaxed">
                        "{review.comment}"
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/60 italic">
                        Nenhum comentário em texto deixado pelo cliente.
                      </p>
                    )}
                  </div>

                  {/* Optional Photo Thumbnail Attachment */}
                  {review.photo_url && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                        <ImageIcon className="w-3 h-3 text-primary" /> Foto do Corte Anexada:
                      </span>
                      <div 
                        onClick={() => setLightboxPhoto({ url: review.photo_url!, customer: review.customerName || 'Cliente' })}
                        className="relative rounded-xl overflow-hidden border border-border/80 bg-black/40 h-36 group/photo cursor-pointer flex items-center justify-center transition-all hover:border-primary"
                      >
                        <Image fill sizes="(max-width: 768px) 100vw, 33vw" 
                          src={review.photo_url} 
                          alt="Foto do corte" 
                          className="w-full h-full object-cover group-hover/photo:scale-105 transition-transform duration-300" 
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white font-medium text-xs">
                          <Eye className="w-4 h-4" />
                          <span>Ampliar Foto</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Date footer */}
                  <div className="text-[10px] text-muted-foreground/70 text-right">
                    Enviada em {formatDate(review.created_at)}
                  </div>
                </div>

                {/* Bottom Action Bar: Aprovar, Reprovar, Excluir */}
                <div className="pt-3 border-t border-border/40 flex items-center justify-between gap-2">

                  {/* Delete Button (Excluir) */}
                  <button
                    onClick={() => setDeleteConfirmId(review.id)}
                    disabled={isPending}
                    className="p-2 bg-destructive/10 hover:bg-destructive/20 border border-destructive/25 text-destructive rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1 text-xs font-semibold"
                    title="Excluir avaliação permanentemente"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Excluir</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {/* Reprovar Button */}
                    {review.status !== 'rejected' && (
                      <button
                        onClick={() => handleUpdateStatus(review.id, 'rejected')}
                        disabled={isPending}
                        className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reprovar
                      </button>
                    )}

                    {/* Aprovar Button */}
                    {review.status !== 'approved' && (
                      <button
                        onClick={() => handleUpdateStatus(review.id, 'approved')}
                        disabled={isPending}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Aprovar
                      </button>
                    )}
                  </div>

                </div>

              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center bg-secondary/20 border border-border/60 rounded-2xl space-y-3">
            <Star className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <h3 className="text-base font-semibold text-foreground">Nenhuma avaliação encontrada</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {searchQuery || barberFilter !== 'all' 
                ? 'Tente alterar os filtros ou termo de busca selecionado.' 
                : 'Não há avaliações nesta categoria no momento.'}
            </p>
          </div>
        )}

      </main>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 animate-in fade-in duration-150">
          <div className="bg-card border border-border/80 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-destructive">
              <div className="p-3 bg-destructive/10 rounded-full">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-serif font-bold text-foreground">Excluir Avaliação?</h3>
                <p className="text-xs text-muted-foreground">Esta ação não poderá ser desfeita.</p>
              </div>
            </div>

            <p className="text-xs text-foreground/80 leading-relaxed bg-secondary/30 p-3 rounded-xl border border-border/40">
              Você está prestes a excluir esta avaliação do sistema. Ela será removida permanentemente do banco de dados.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={isPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteReview(deleteConfirmId)}
                disabled={isPending}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-md flex items-center gap-1.5 transition-all"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Lightbox Modal */}
      {lightboxPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 animate-in fade-in duration-200">
          <div className="relative max-w-3xl w-full max-h-[90vh] flex flex-col items-center justify-center space-y-3">
            <button aria-label="Fechar"
              onClick={() => setLightboxPhoto(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <Image width={1200} height={1200} sizes="90vw" 
              src={lightboxPhoto.url} 
              alt={`Foto do corte de ${lightboxPhoto.customer}`} 
              className="max-h-[80vh] w-auto max-w-full object-contain rounded-2xl border border-white/10 shadow-2xl"
            />
            <p className="text-xs text-white/80 font-medium bg-black/60 px-4 py-1.5 rounded-full border border-white/10">
              Foto do corte enviada por <strong className="text-white">{lightboxPhoto.customer}</strong>
            </p>
          </div>
        </div>
      )}

    </div>
  )
}
