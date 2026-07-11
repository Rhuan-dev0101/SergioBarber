'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Scissors, Search, User, Mail, Phone, Edit, Calendar, Clock, 
  AlertCircle, CheckCircle2, Loader2, Save, X, ArrowLeft, ChevronRight, Trash2 
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { DashboardSidebar } from '@/components/DashboardSidebar'
import { updateCustomerPrivateNotesAction, deleteCustomerAction } from './actions'

export default function PainelClientes() {
  const router = useRouter()
  const [customers, setCustomers] = useState<any[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([])
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

  // Filter customers by search query
  useEffect(() => {
    let result = customers
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(c => 
        (c.full_name && c.full_name.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q))
      )
    }
    setFilteredCustomers(result)
  }, [customers, searchQuery])

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
        <div className="border-b border-border/40 pb-4">
          <h1 className="text-2xl font-serif font-bold text-foreground">Base de Clientes</h1>
          <p className="text-xs text-muted-foreground">Consulte o cadastro, histórico de agendamentos e mantenha anotações privadas de atendimento</p>
        </div>

        {/* Master-Detail Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left panel: Customer list */}
          <div className="lg:col-span-5 space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nome, email ou WhatsApp..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-secondary border border-border focus:border-primary rounded text-xs outline-none text-foreground"
              />
            </div>

            {/* List */}
            <div className="glass border border-border rounded-lg overflow-hidden divide-y divide-border/40 max-h-[500px] overflow-y-auto pr-1">
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectCustomer(c)}
                    className={`w-full p-4 text-left flex items-center justify-between transition-colors hover:bg-secondary/20 cursor-pointer ${
                      selectedCustomer?.id === c.id ? 'bg-primary/5 border-l-2 border-primary' : ''
                    }`}
                  >
                    <div className="space-y-1">
                      <h4 className="font-serif font-bold text-sm text-foreground">{c.full_name}</h4>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-primary" /> {c.phone || 'Sem telefone'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-muted-foreground italic">
                  Nenhum cliente cadastrado com este critério.
                </div>
              )}
            </div>
          </div>

          {/* Right panel: Details & History */}
          <div className="lg:col-span-7">
            {selectedCustomer ? (
              <div className="glass p-6 sm:p-8 rounded-lg border border-border space-y-6 shadow-xl">
                {/* Header Profile */}
                <div className="flex justify-between items-start border-b border-border/40 pb-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-serif font-bold text-foreground">{selectedCustomer.full_name}</h2>
                      {role === 'admin' && (
                        <button
                          onClick={() => {
                            setErrorMsg('')
                            setSuccessMsg('')
                            setShowConfirmDelete(true)
                          }}
                          className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 hover:text-rose-400 font-bold border border-rose-500/20 rounded text-[9px] uppercase transition-all cursor-pointer flex items-center gap-1"
                        >
                          Excluir Cliente
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-primary" /> {selectedCustomer.email}</p>
                      <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-primary" /> {selectedCustomer.phone || 'Telefone não informado'}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedCustomer(null)}
                    className="p-1 rounded hover:bg-secondary text-muted-foreground"
                  >
                    <X className="w-5 h-5" />
                  </button>
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

                {/* Customer Notes */}
                <div className="space-y-2">
                  <label htmlFor="cNotes" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex justify-between items-center">
                    <span>Ficha de Cliente / Observações Privadas</span>
                    {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
                  </label>
                  <textarea
                    id="cNotes"
                    placeholder="Escreva notas de corte, visagismo ou preferências de atendimento..."
                    value={privateNotes}
                    onChange={(e) => setPrivateNotes(e.target.value)}
                    disabled={isPending}
                    rows={4}
                    className="w-full p-3 bg-secondary border border-border focus:border-primary rounded text-xs text-foreground placeholder:text-muted-foreground outline-none resize-none"
                  />
                  <button
                    onClick={handleSaveNotes}
                    disabled={isPending}
                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground font-bold rounded text-xs transition-all shadow flex items-center justify-center gap-1.5 ml-auto cursor-pointer"
                  >
                    <Save className="w-4 h-4 text-primary-foreground" />
                    Salvar Ficha do Cliente
                  </button>
                </div>

                {/* Appointments History */}
                <div className="space-y-4 pt-4 border-t border-border/40">
                  <h3 className="font-serif font-bold text-sm text-foreground uppercase tracking-wider">Histórico de Atendimentos</h3>
                  
                  {loadingHistory ? (
                    <div className="py-6 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span>Carregando histórico...</span>
                    </div>
                  ) : apptHistory.length > 0 ? (
                    <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                      {apptHistory.map((appt) => (
                        <div 
                          key={appt.id} 
                          className="flex justify-between items-center p-3 rounded bg-secondary/35 border border-border/50 text-xs"
                        >
                          <div className="space-y-1">
                            <p className="font-semibold text-foreground">{appt.services?.name}</p>
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-primary" /> {formatDate(appt.start_time)} às {formatTime(appt.start_time)}
                              <span className="mx-1">•</span>
                              Profissional: {appt.barberName}
                            </p>
                          </div>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                            appt.status === 'completed' 
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                              : appt.status === 'cancelled'
                              ? 'bg-destructive/10 text-destructive border border-destructive/20'
                              : 'bg-primary/10 text-primary border border-primary/20'
                          }`}>
                            {appt.status === 'completed' ? 'Concluído' : appt.status === 'cancelled' ? 'Cancelado' : appt.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Nenhum atendimento realizado anteriormente.</p>
                  )}
                </div>

              </div>
            ) : (
              <div className="glass p-12 rounded-lg border border-border text-center text-muted-foreground italic flex flex-col items-center justify-center space-y-3 min-h-[300px]">
                <User className="w-12 h-12 text-primary/20" />
                <p className="text-xs">Selecione um cliente na lista lateral para visualizar suas informações, histórico de agendamentos e anotações.</p>
              </div>
            )}
          </div>

        </div>

        {/* CONFIRM DELETE MODAL */}
        {showConfirmDelete && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass max-w-sm w-full rounded-lg border border-border shadow-2xl p-6 relative flex flex-col space-y-6">
              <button
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

      </main>
    </div>
  )
}
