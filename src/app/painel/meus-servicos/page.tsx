'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Scissors, Plus, Edit2, Trash2, Clock, DollarSign, AlertCircle, 
  CheckCircle2, Loader2, Save, X, Sparkles, Check 
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { DashboardSidebar } from '@/components/DashboardSidebar'
import { 
  addBarberServiceAction, 
  createAndAddBarberServiceAction, 
  updateBarberServiceAction, 
  deleteBarberServiceAction 
} from './actions'

export default function MeusServicos() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [barbers, setBarbers] = useState<any[]>([])
  const [selectedBarberId, setSelectedBarberId] = useState<string>('')
  
  const [barberServices, setBarberServices] = useState<any[]>([])
  const [allCatalogServices, setAllCatalogServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [addTab, setAddTab] = useState<'existing' | 'new'>('existing')

  // Form states
  const [selectedCatalogServiceId, setSelectedCatalogServiceId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState('60')
  const [price, setPrice] = useState('50.00')
  
  // Edit Form States
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState('50.00')
  const [editDuration, setEditDuration] = useState('60')
  const [editDescription, setEditDescription] = useState('')
  const [editIsActive, setEditIsActive] = useState(true)

  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isPending, startTransition] = useTransition()

  const supabase = createClient()

  const fetchSessionAndInit = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/entrar')
        return
      }

      // 1. Get profile role & info
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', session.user.id)
        .single()
      
      if (!profile || (profile.role !== 'admin' && profile.role !== 'barber')) {
        router.push('/cliente')
        return
      }
      
      setCurrentUser(profile)
      setSelectedBarberId(profile.id)

      // 2. Fetch all active barbers for select dropdown
      const { data: dbBarbers } = await supabase
        .from('barbers')
        .select('id, profiles(full_name)')
        .eq('is_active', true)
      
      if (dbBarbers) {
        const formattedBarbers = dbBarbers.map((b: any) => ({
          id: b.id,
          name: b.profiles?.full_name || 'Profissional'
        }))
        setBarbers(formattedBarbers)
      }
    } catch (error) {
      console.error('Initialization error:', error)
    }
  }

  const loadData = async (barberId: string) => {
    if (!barberId) return
    setLoading(true)
    try {
      // 1. Load this barber's specific services
      const { data: dbBarberServices } = await supabase
        .from('barber_services')
        .select('id, price, duration, is_active, service_id, description, services(id, name, description)')
        .eq('barber_id', barberId)
      
      if (dbBarberServices) {
        setBarberServices(dbBarberServices)
      }

      // 2. Load all catalog services for existing selection
      const { data: dbCatalog } = await supabase
        .from('services')
        .select('id, name, description, duration, price')
        .eq('is_active', true)
      
      if (dbCatalog) {
        setAllCatalogServices(dbCatalog)
      }
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSessionAndInit()
  }, [])

  useEffect(() => {
    if (selectedBarberId) {
      loadData(selectedBarberId)
    }
  }, [selectedBarberId])

  // Get catalog services that the barber does not offer yet
  const availableCatalogServices = allCatalogServices.filter(
    (cs) => !barberServices.some((bs) => bs.service_id === cs.id)
  )

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    setActionLoading(true)

    startTransition(async () => {
      let res
      if (addTab === 'existing') {
        if (!selectedCatalogServiceId) {
          setErrorMsg('Por favor, selecione um serviço do catálogo.')
          setActionLoading(false)
          return
        }
        res = await addBarberServiceAction(
          selectedBarberId,
          selectedCatalogServiceId,
          parseFloat(price),
          parseInt(duration, 10)
        )
      } else {
        if (!name || !duration || !price) {
          setErrorMsg('Nome, duração e preço são obrigatórios.')
          setActionLoading(false)
          return
        }
        res = await createAndAddBarberServiceAction(
          selectedBarberId,
          name,
          description,
          parseFloat(price),
          parseInt(duration, 10)
        )
      }

      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg(res.message)
        setShowAddModal(false)
        
        // Reset states
        setSelectedCatalogServiceId('')
        setName('')
        setDescription('')
        setDuration('60')
        setPrice('50.00')

        await loadData(selectedBarberId)
      }
      setActionLoading(false)
    })
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    if (!editingId) return
    setActionLoading(true)

    startTransition(async () => {
      const res = await updateBarberServiceAction(
        editingId,
        parseFloat(editPrice),
        parseInt(editDuration, 10),
        editIsActive,
        editDescription
      )

      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg(res.message)
        setShowEditModal(false)
        setEditingId(null)
        await loadData(selectedBarberId)
      }
      setActionLoading(false)
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este serviço do seu perfil? Esta ação não remove o serviço do catálogo da barbearia.')) return
    setErrorMsg('')
    setSuccessMsg('')
    
    setActionLoading(true)
    const res = await deleteBarberServiceAction(id)
    if (!res.success) {
      setErrorMsg(res.message)
    } else {
      setSuccessMsg(res.message)
      await loadData(selectedBarberId)
    }
    setActionLoading(false)
  }

  const triggerEdit = (bs: any) => {
    setEditingId(bs.id)
    setEditPrice(Number(bs.price).toFixed(2))
    setEditDuration(String(bs.duration))
    setEditDescription(bs.description || '')
    setEditIsActive(bs.is_active)
    setErrorMsg('')
    setSuccessMsg('')
    setShowEditModal(true)
  }

  const handleCatalogServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sId = e.target.value
    setSelectedCatalogServiceId(sId)
    const selected = allCatalogServices.find(s => s.id === sId)
    if (selected) {
      setPrice(Number(selected.price).toFixed(2))
      setDuration(String(selected.duration))
    }
  }

  if (loading && !currentUser) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center items-center gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground font-semibold">Carregando painel...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <DashboardSidebar />

      <main className="flex-grow p-6 sm:p-8 space-y-6 overflow-y-auto">
        
        {/* Header Title Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/40 pb-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-2">
              <Scissors className="w-7 h-7 text-primary shrink-0" />
              Meus Serviços & Tabela de Preços ✂️
            </h1>
            <p className="text-xs text-muted-foreground">Personalize os serviços, valores e durações exibidos para seus clientes no agendamento</p>
          </div>
          <button
            onClick={() => {
              setErrorMsg('')
              setSuccessMsg('')
              setShowAddModal(true)
            }}
            className="w-full sm:w-auto px-5 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200 cursor-pointer group"
          >
            <Plus className="w-4 h-4 text-primary-foreground transition-transform group-hover:scale-110" />
            <span>Adicionar Serviço</span>
          </button>
        </div>

        {/* Barber Selector */}
        {barbers.length > 0 && (
          <div className="glass p-4 rounded-xl border border-border/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Gerenciar catálogo de atendimento de:
            </span>
            <select
              value={selectedBarberId}
              onChange={(e) => setSelectedBarberId(e.target.value)}
              className="bg-secondary/60 border border-border text-foreground px-4 py-2 rounded-lg text-base font-bold focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
            >
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Feedback alerts */}
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

        {/* Services List Table */}
        <div className="glass rounded-xl border border-border/80 overflow-x-auto shadow-sm">
          {loading ? (
            <div className="py-14 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground font-semibold">Buscando serviços do profissional...</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-secondary/40 border-b border-border/60 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  <th className="p-4">Serviço</th>
                  <th className="p-4">Descrição</th>
                  <th className="p-4">Duração</th>
                  <th className="p-4">Seu Preço</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-xs">
                {barberServices.length > 0 ? (
                  barberServices.map((bs) => (
                    <tr key={bs.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="p-4 font-serif font-bold text-sm text-foreground whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Scissors className="w-4 h-4 text-primary shrink-0" />
                          <span>{bs.services?.name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground max-w-xs truncate">
                        {bs.description ? (
                          <span title={bs.description}>
                            <span className="inline-block bg-primary/15 text-primary border border-primary/25 text-[9px] font-bold px-1.5 py-0.5 rounded-full mr-1.5">
                              Personalizada
                            </span>
                            {bs.description}
                          </span>
                        ) : (
                          bs.services?.description || 'Nenhuma descrição no catálogo.'
                        )}
                      </td>
                      <td className="p-4 whitespace-nowrap font-semibold text-foreground">
                        <span className="flex items-center gap-1.5 bg-secondary/50 px-2.5 py-1 rounded-md border border-border/60 w-fit">
                          <Clock className="w-3.5 h-3.5 text-primary" />
                          {bs.duration} min
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap font-mono text-primary font-bold text-sm">
                        R$&nbsp;{Number(bs.price).toFixed(2)}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          bs.is_active 
                            ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/25' 
                            : 'bg-muted text-muted-foreground border border-border'
                        }`}>
                          {bs.is_active ? 'Ativo' : 'Oculto'}
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap text-right space-x-2">
                        <button
                          onClick={() => triggerEdit(bs)}
                          disabled={actionLoading}
                          className="p-2 bg-secondary hover:bg-muted text-foreground border border-border hover:text-primary rounded-lg cursor-pointer inline-flex items-center justify-center transition-all disabled:opacity-50"
                          title="Editar Serviço"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(bs.id)}
                          disabled={actionLoading}
                          className="p-2 bg-secondary hover:bg-destructive/10 text-foreground border border-border hover:text-destructive rounded-lg cursor-pointer inline-flex items-center justify-center transition-all disabled:opacity-50"
                          title="Remover Serviço"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-muted-foreground italic">
                      Nenhum serviço cadastrado para este perfil de atendimento ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* ADD SERVICE MODAL (TELA DE ADICIONAR SERVIÇO) */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
            <div className="glass max-w-lg w-full rounded-2xl border border-primary/40 shadow-2xl p-6 sm:p-8 relative flex flex-col space-y-6">
              
              <button
                onClick={() => setShowAddModal(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground cursor-pointer p-1.5 hover:bg-secondary rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-1 border-b border-border/40 pb-3">
                <h3 className="text-xl font-serif font-bold text-foreground flex items-center gap-2">
                  <Plus className="w-5 h-5 text-primary" /> Adicionar Serviço de Atendimento
                </h3>
                <p className="text-xs text-muted-foreground">Configure um novo serviço no seu menu de opções para clientes</p>
              </div>

              {/* Tabs selector */}
              <div className="grid grid-cols-2 bg-secondary/50 p-1.5 rounded-xl border border-border">
                <button
                  type="button"
                  onClick={() => { setAddTab('existing'); setErrorMsg('') }}
                  className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    addTab === 'existing' 
                      ? 'bg-primary text-primary-foreground shadow-md' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Selecionar do Catálogo
                </button>
                <button
                  type="button"
                  onClick={() => { setAddTab('new'); setErrorMsg('') }}
                  className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    addTab === 'new' 
                      ? 'bg-primary text-primary-foreground shadow-md' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Cadastrar Novo
                </button>
              </div>

              <form onSubmit={handleAddSubmit} className="space-y-4">
                {addTab === 'existing' ? (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-foreground uppercase tracking-wider">Escolha o Serviço</label>
                      {availableCatalogServices.length > 0 ? (
                        <select
                          value={selectedCatalogServiceId}
                          onChange={handleCatalogServiceChange}
                          className="w-full bg-background border border-border text-foreground px-4 py-2.5 rounded-lg text-base font-medium focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                          required
                        >
                          <option value="">Selecione um serviço...</option>
                          {availableCatalogServices.map((cs) => (
                            <option key={cs.id} value={cs.id}>
                              {cs.name} (Catálogo: R$ {Number(cs.price).toFixed(2)})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-xs text-amber-500 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                          Todos os serviços do catálogo da barbearia já estão vinculados ao seu perfil. Se quiser adicionar outro, use a aba &quot;Cadastrar Novo&quot;.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-foreground uppercase tracking-wider">Nome do Serviço</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: Barba Terapia Imperial com Toalha Quente"
                        className="w-full bg-background border border-border text-foreground px-4 py-2.5 rounded-lg text-base focus:ring-1 focus:ring-primary focus:outline-none font-medium"
                        required={addTab === 'new'}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-foreground uppercase tracking-wider">Descrição do Serviço</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Explique o serviço e o capricho envolvido..."
                        className="w-full bg-background border border-border text-foreground p-3 rounded-lg text-base focus:ring-1 focus:ring-primary focus:outline-none h-20 resize-none"
                      />
                    </div>
                  </div>
                )}

                {/* Custom price/duration inputs */}
                {(addTab === 'new' || (addTab === 'existing' && availableCatalogServices.length > 0)) && (
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-foreground uppercase tracking-wider">Seu Preço (R$)</label>
                      <div className="relative flex items-center">
                        <DollarSign className="w-4 h-4 text-primary absolute left-3" />
                        <input
                          type="number"
                          step="0.01"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          className="w-full bg-background border border-border text-foreground pl-9 pr-3 py-2.5 rounded-lg text-base focus:ring-1 focus:ring-primary focus:outline-none font-mono font-bold"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-foreground uppercase tracking-wider">Duração (Minutos)</label>
                      <div className="relative flex items-center">
                        <Clock className="w-4 h-4 text-primary absolute left-3" />
                        <input
                          type="number"
                          value={duration}
                          onChange={(e) => setDuration(e.target.value)}
                          className="w-full bg-background border border-border text-foreground pl-9 pr-3 py-2.5 rounded-lg text-base focus:ring-1 focus:ring-primary focus:outline-none font-mono font-bold"
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 justify-end pt-4 border-t border-border/40">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2.5 bg-secondary hover:bg-muted text-foreground border border-border font-semibold rounded-lg text-xs transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending || actionLoading || (addTab === 'existing' && availableCatalogServices.length === 0)}
                    className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-md disabled:opacity-50"
                  >
                    {(isPending || actionLoading) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Confirmar Serviço
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* EDIT SERVICE MODAL */}
        {showEditModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
            <div className="glass max-w-lg w-full rounded-2xl border border-primary/40 shadow-2xl p-6 sm:p-8 relative flex flex-col space-y-6">
              
              <button
                onClick={() => setShowEditModal(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground cursor-pointer p-1.5 hover:bg-secondary rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-1 border-b border-border/40 pb-3">
                <h3 className="text-xl font-serif font-bold text-foreground">Editar Configurações do Serviço</h3>
                <p className="text-xs text-muted-foreground">Modifique preço, duração, descrição personalizada e visibilidade</p>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider">Seu Preço (R$)</label>
                    <div className="relative flex items-center">
                      <DollarSign className="w-4 h-4 text-primary absolute left-3" />
                      <input
                        type="number"
                        step="0.01"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="w-full bg-background border border-border text-foreground pl-9 pr-3 py-2.5 rounded-lg text-base focus:ring-1 focus:ring-primary focus:outline-none font-mono font-bold"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider">Duração (Min)</label>
                    <div className="relative flex items-center">
                      <Clock className="w-4 h-4 text-primary absolute left-3" />
                      <input
                        type="number"
                        value={editDuration}
                        onChange={(e) => setEditDuration(e.target.value)}
                        className="w-full bg-background border border-border text-foreground pl-9 pr-3 py-2.5 rounded-lg text-base focus:ring-1 focus:ring-primary focus:outline-none font-mono font-bold"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Descrição Personalizada
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Ex: A partir de R$50 — valor pode variar conforme o tipo de corte ou barba"
                    className="w-full bg-background border border-border text-foreground p-3 rounded-lg text-base focus:ring-1 focus:ring-primary focus:outline-none h-20 resize-none"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Se deixado em branco, será exibida a descrição padrão do catálogo.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">Visibilidade para Clientes</label>
                  <div className="flex items-center gap-3 bg-secondary/40 p-3.5 rounded-xl border border-border">
                    <input
                      type="checkbox"
                      id="editIsActive"
                      checked={editIsActive}
                      onChange={(e) => setEditIsActive(e.target.checked)}
                      className="accent-primary w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="editIsActive" className="text-xs font-bold text-foreground cursor-pointer select-none">
                      Serviço Ativo e Agendável no Perfil
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t border-border/40">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2.5 bg-secondary hover:bg-muted text-foreground border border-border font-semibold rounded-lg text-xs transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending || actionLoading}
                    className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-md disabled:opacity-50"
                  >
                    {(isPending || actionLoading) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
