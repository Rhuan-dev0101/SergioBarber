'use client'

import React, { useEffect, useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Scissors, Search, User, Mail, Phone, Calendar, Clock, AlertCircle, CheckCircle2, Loader2, Save, X, ChevronRight, Trash2 } from 'lucide-react'

import { createClient } from '@/lib/supabase'
import { DashboardSidebar } from '@/components/DashboardSidebar'
import { RegisterCustomerModal } from '@/components/clientes/RegisterCustomerModal'
import { updateCustomerPrivateNotesAction, deleteCustomerAction } from './actions'
function getAppointmentPrice(appt: any): number {
  if (!appt) return 0
  const payment = Array.isArray(appt.payments) ? appt.payments[0] : appt.payments
  if (payment && payment.total_amount !== undefined && payment.total_amount !== null && Number(payment.total_amount) > 0) {
    return Number(payment.total_amount)
  }
  return Number(appt.services?.price || 0)
}

export default function PainelClientes() {
  const router = useRouter()
  const [customers, setCustomers] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  // Selected customer details
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [apptHistory, setApptHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [privateNotes, setPrivateNotes] = useState('')
  const [role, setRole] = useState<string | null>(null)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isPending, startTransition] = useTransition()

  // Manual Registration Modal State
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false)

  const supabase = createClient()

  const loadCustomers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/entrar')
        return
      }

      // Authorize
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()
      
      if (!profile || (profile.role !== 'admin' && profile.role !== 'barber')) {
        router.push('/cliente')
        return
      }
      
      setRole(profile.role)

      // Fetch profiles with role customer
      const { data: users, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'customer')
        .order('full_name', { ascending: true })

      if (users) {
        setCustomers(users)
      }
    } catch (err) {
      console.error('Error loading customers list:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCustomers()
  }, [])

  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Filter customers by search query (memoized)
  const filteredCustomers = useMemo(() => {
    let result = customers
    if (debouncedSearchQuery) {
      const q = debouncedSearchQuery.toLowerCase()
      result = result.filter(c => 
        (c.full_name && c.full_name.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q))
      )
    }
    return result
  }, [customers, debouncedSearchQuery])

  // Load customer details and history
  const handleSelectCustomer = async (customer: any) => {
    setSelectedCustomer(customer)
    setPrivateNotes('')
    setLoadingHistory(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      // Fetch the latest private note for this customer
      const { data: noteData } = await supabase
        .from('client_notes')
        .select('note')
        .eq('profile_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (noteData) {
        setPrivateNotes(noteData.note)
      }

      // Query customer appointment history
      const { data: appts } = await supabase
        .from('appointments')
        .select(`
          id,
          start_time,
          status,
          services (name, price),
          payments (total_amount),
          barber_id
        `)
        .eq('customer_id', customer.id)
        .order('start_time', { ascending: false })

      if (appts && appts.length > 0) {
        // Fetch barber names
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
        setApptHistory(enriched)
      } else {
        setApptHistory([])
      }
    } catch (err) {
      console.error('Error loading history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleSaveNotes = () => {
    setErrorMsg('')
    setSuccessMsg('')

    startTransition(async () => {
      const res = await updateCustomerPrivateNotesAction(selectedCustomer.id, privateNotes)
      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg(res.message)
      }
    })
  }

  const handleDeleteCustomer = () => {
    if (!selectedCustomer) return
    setErrorMsg('')
    setSuccessMsg('')
    setActionLoading(true)

    startTransition(async () => {
      const res = await deleteCustomerAction(selectedCustomer.id)
      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg(res.message)
        setShowConfirmDelete(false)
        
        // Remove from list and clear selection
        const deletedId = selectedCustomer.id
        setCustomers(prev => prev.filter(c => c.id !== deletedId))
        setSelectedCustomer(null)
      }
      setActionLoading(false)
    })
  }

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
        <p className="text-xs text-muted-foreground">Carregando painel de clientes...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <DashboardSidebar />

      <main className="flex-grow p-6 sm:p-8 space-y-6 overflow-y-auto">
        
        {/* Title */}
        <div className="border-b border-border/40 pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-serif font-bold text-foreground">Base de Clientes 👥</h1>
            <p className="text-xs text-muted-foreground">Fichas de visagismo, histórico de cortes, contatos diretos e cadastros de clientes</p>
          </div>
          <button
            onClick={() => setIsRegisterModalOpen(true)}
            className="px-5 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs transition-all duration-200 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 flex items-center justify-center gap-2 cursor-pointer sm:self-center group"
          >
            <User className="w-4 h-4 text-primary-foreground transition-transform group-hover:scale-110" />
            <span>Cadastrar Cliente Manualmente</span>
          </button>
        </div>

        {/* Quick Stats Summary Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-secondary/20 px-4 py-3 rounded-xl border border-border/60 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="font-semibold text-foreground">Total de Clientes Cadastrados:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold border border-primary/20">
              {customers.length}
            </span>
          </div>
          {searchQuery && (
            <div className="text-[11px] text-muted-foreground font-medium">
              Exibindo <strong className="text-foreground">{filteredCustomers.length}</strong> resultado{filteredCustomers.length !== 1 ? 's' : ''} para &quot;{searchQuery}&quot;
            </div>
          )}
        </div>

        {/* Master-Detail Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left panel: Customer list */}
          <div className="lg:col-span-5 space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                aria-label="Buscar por nome, e-mail ou WhatsApp" placeholder="Buscar por nome, e-mail ou WhatsApp..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 bg-secondary/40 border border-border focus:border-primary rounded-xl text-base outline-none text-foreground transition-all"
              />
              {searchQuery && (
                <button aria-label="Limpar busca"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Customer List Container */}
            <div className="glass border border-border/80 rounded-xl overflow-hidden divide-y divide-border/40 max-h-[580px] overflow-y-auto shadow-sm">
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((c) => {
                  const initial = c.full_name?.charAt(0)?.toUpperCase() || 'C'
                  const isSelected = selectedCustomer?.id === c.id

                  return (
                    <button
                      key={c.id}
                      onClick={() => handleSelectCustomer(c)}
                      className={`w-full p-4 text-left flex items-center justify-between transition-all duration-200 cursor-pointer ${
                        isSelected 
                          ? 'bg-primary/10 border-l-4 border-primary' 
                          : 'hover:bg-secondary/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl font-serif font-bold text-sm flex items-center justify-center shrink-0 border transition-all ${
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-gradient-to-tr from-primary/20 to-secondary text-primary border-primary/30'
                        }`}>
                          {initial}
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="font-serif font-bold text-sm text-foreground">{c.full_name}</h4>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-primary shrink-0" /> {c.phone || 'Sem telefone'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-primary translate-x-0.5' : 'text-muted-foreground'}`} />
                    </button>
                  )
                })
              ) : (
                <div className="p-10 text-center text-xs text-muted-foreground italic space-y-2">
                  <User className="w-8 h-8 text-muted-foreground/30 mx-auto" />
                  <p>Nenhum cliente encontrado com este critério de busca.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right panel: Details & History */}
          <div className="lg:col-span-7">
            {selectedCustomer ? (
              <div className="glass p-6 sm:p-8 rounded-xl border border-border/80 space-y-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />

                {/* Header Profile */}
                <div className="flex justify-between items-start border-b border-border/40 pb-5">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary/30 to-secondary border-2 border-primary/40 text-primary text-xl font-bold font-serif flex items-center justify-center shadow-md shrink-0">
                      {selectedCustomer.full_name?.charAt(0)?.toUpperCase() || 'C'}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl font-serif font-bold text-foreground">{selectedCustomer.full_name}</h2>
                        {role === 'admin' && (
                          <button
                            onClick={() => {
                              setErrorMsg('')
                              setSuccessMsg('')
                              setShowConfirmDelete(true)
                            }}
                            className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 hover:text-rose-400 font-bold border border-rose-500/25 rounded-lg text-[9px] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1"
                          >
                            Excluir Cliente
                          </button>
                        )}
                      </div>

                      {/* Contact Badges */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="px-3 py-1 rounded-lg bg-secondary/50 border border-border/60 text-muted-foreground flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-primary" /> {selectedCustomer.email}
                        </span>

                        {selectedCustomer.phone && (
                          <a
                            href={`https://wa.me/55${selectedCustomer.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-500 font-semibold flex items-center gap-1.5 transition-all"
                            title="Conversar no WhatsApp"
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-500" />
                            <span>{selectedCustomer.phone}</span>
                            <span className="text-[10px] bg-emerald-500/20 px-1.5 py-0.5 rounded text-emerald-400 font-bold ml-1">WhatsApp</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  <button aria-label="Fechar" 
                    onClick={() => setSelectedCustomer(null)}
                    className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
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

                {/* Customer Notes */}
                <div className="space-y-2.5">
                  <label htmlFor="cNotes" className="text-xs font-bold text-foreground uppercase tracking-wider flex justify-between items-center">
                    <span>Ficha do Cliente / Observações Privadas (Visagismo)</span>
                    {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
                  </label>
                  <textarea
                    id="cNotes"
                    placeholder="Escreva preferências de corte, tipo de barba, formato de rosto ou notas privadas de atendimento..."
                    value={privateNotes}
                    onChange={(e) => setPrivateNotes(e.target.value)}
                    disabled={isPending}
                    rows={4}
                    className="w-full p-4 bg-secondary/40 border border-border/80 focus:border-primary rounded-xl text-base text-foreground placeholder:text-muted-foreground outline-none resize-none transition-all shadow-inner"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveNotes}
                      disabled={isPending}
                      className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-4 h-4 text-primary-foreground" />
                      Salvar Ficha do Cliente
                    </button>
                  </div>
                </div>

                {/* Appointments History */}
                <div className="space-y-4 pt-5 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif font-bold text-sm text-foreground uppercase tracking-wider flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" /> Histórico de Atendimentos
                    </h3>
                    <span className="text-xs text-muted-foreground font-semibold">
                      {apptHistory.length} agendamento{apptHistory.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  
                  {loadingHistory ? (
                    <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span>Carregando histórico do cliente...</span>
                    </div>
                  ) : apptHistory.length > 0 ? (
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                      {apptHistory.map((appt) => (
                        <div 
                          key={appt.id} 
                          className="flex justify-between items-center p-3.5 rounded-xl bg-secondary/35 border border-border/60 text-xs shadow-sm hover:bg-secondary/50 transition-colors"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-foreground text-sm">{appt.services?.name}</p>
                              <span className="text-mono font-bold text-primary text-[11px]">
                                R$&nbsp;{getAppointmentPrice(appt).toFixed(2)}
                              </span>
                              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/30 flex items-center gap-1 shrink-0">
                                <Scissors className="w-3 h-3 text-primary" />
                                {appt.barberName?.split(' ')[0]}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                              <Clock className="w-3 h-3 text-primary" /> {formatDate(appt.start_time)} às {formatTime(appt.start_time)}
                              <span className="mx-1">•</span>
                              Barbeiro: <strong className="text-foreground">{appt.barberName}</strong>
                            </p>
                          </div>

                          <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                            appt.status === 'completed' 
                              ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/25' 
                              : appt.status === 'cancelled'
                              ? 'bg-destructive/15 text-destructive border border-destructive/25'
                              : 'bg-primary/15 text-primary border border-primary/25'
                          }`}>
                            {appt.status === 'completed' ? 'Concluído' : appt.status === 'cancelled' ? 'Cancelado' : 'Confirmado'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 bg-secondary/20 rounded-xl border border-border/60 text-center">
                      <p className="text-xs text-muted-foreground italic">Nenhum atendimento realizado anteriormente por este cliente.</p>
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="glass p-12 rounded-xl border border-border text-center text-muted-foreground italic flex flex-col items-center justify-center space-y-3 min-h-[360px] shadow-sm">
                <User className="w-12 h-12 text-primary/30" />
                <p className="text-xs max-w-xs leading-relaxed">Selecione um cliente na lista lateral para visualizar suas informações de contato, ficha de atendimento e histórico de cortes.</p>
              </div>
            )}
          </div>

        </div>

        {/* CONFIRM DELETE MODAL */}
        {showConfirmDelete && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <div className="glass max-w-sm w-full rounded-lg border border-border shadow-2xl p-6 relative flex flex-col space-y-6">
              <button aria-label="Fechar"
                onClick={() => setShowConfirmDelete(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-2 text-left">
                <h3 className="text-lg font-serif font-bold text-rose-500 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-rose-500" />
                  Confirmar Exclusão
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Tem certeza que deseja excluir permanentemente o cadastro de <strong>{selectedCustomer?.full_name}</strong>?
                </p>
                <p className="text-[11px] text-rose-400/90 bg-rose-500/5 p-3 rounded border border-rose-500/10 leading-normal">
                  <strong>Atenção:</strong> Esta ação é irreversível. A conta de login do usuário será deletada e todas as informações pessoais, ficha de anotações e termos de aceitação legal serão removidos de forma definitiva.
                </p>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(false)}
                  disabled={actionLoading || isPending}
                  className="px-4 py-2 bg-secondary hover:bg-muted text-foreground border border-border font-bold rounded text-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteCustomer}
                  disabled={actionLoading || isPending}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {(actionLoading || isPending) ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <Trash2 className="w-3.5 h-3.5 text-white" />}
                  Excluir Permanentemente
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MANUAL REGISTRATION MODAL */}
        <RegisterCustomerModal
          isOpen={isRegisterModalOpen}
          onClose={() => setIsRegisterModalOpen(false)}
          onSuccess={() => {
            loadCustomers()
          }}
        />

      </main>
    </div>
  )
}
