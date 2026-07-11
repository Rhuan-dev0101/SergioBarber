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

      // 2. If admin, fetch all active barbers for select dropdown
      if (profile.role === 'admin') {
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
        .select('id, price, duration, is_active, service_id, services(id, name, description)')
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
        editIsActive
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/40 pb-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-serif font-bold text-foreground">Meus Serviços</h1>
            <p className="text-xs text-muted-foreground">Gerencie seus serviços, preços e durações oferecidos aos clientes</p>
          </div>
          <button
            onClick={() => {
              setErrorMsg('')
              setSuccessMsg('')
              setShowAddModal(true)
            }}
            className="w-full sm:w-auto px-4 py-2.5 bg-primary hover:bg-primary-hover text-primary-foreground font-bold rounded text-xs flex items-center justify-center gap-1.5 shadow transition-all"
          >
            <Plus className="w-4 h-4 text-primary-foreground" />
            Adicionar Serviço
          </button>
        </div>

        {/* Admin Barber Selector */}
        {currentUser?.role === 'admin' && barbers.length > 0 && (
          <div className="glass p-4 rounded-lg border border-border flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Gerenciar serviços de:</span>
            <select
              value={selectedBarberId}
              onChange={(e) => setSelectedBarberId(e.target.value)}
              className="bg-secondary border border-border text-foreground px-3 py-1.5 rounded text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-none"
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

        {/* Services List Table */}
        <div className="glass rounded-lg border border-border overflow-x-auto shadow">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Buscando seus serviços...</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[600px]">
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
                    <tr key={bs.id} className="hover:bg-secondary/15 transition-colors">
                      <td className="p-4 font-semibold text-foreground whitespace-nowrap">
                        {bs.services?.name}
                      </td>
                      <td className="p-4 text-muted-foreground max-w-xs truncate">
                        {bs.services?.description || 'Nenhuma descrição no catálogo.'}
                      </td>
                      <td className="p-4 whitespace-nowrap font-medium text-foreground">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-primary" />
                          {bs.duration} min
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap font-mono text-primary font-bold">
                        R$ {Number(bs.price).toFixed(2)}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          bs.is_active 
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                            : 'bg-muted text-muted-foreground border border-border'
                        }`}>
                          {bs.is_active ? 'Ativo' : 'Oculto'}
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap text-right space-x-2">
                        <button
                          onClick={() => triggerEdit(bs)}
                          disabled={actionLoading}
                          className="p-1.5 bg-secondary hover:bg-muted text-foreground border border-border hover:text-primary rounded cursor-pointer inline-flex items-center justify-center transition-all disabled:opacity-50"
                          title="Editar Serviço"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(bs.id)}
                          disabled={actionLoading}
                          className="p-1.5 bg-secondary hover:bg-destructive/10 text-foreground border border-border hover:text-destructive rounded cursor-pointer inline-flex items-center justify-center transition-all disabled:opacity-50"
                          title="Remover Serviço"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      Você ainda não possui nenhum serviço cadastrado em seu perfil de atendimento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* ADD SERVICE MODAL */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass max-w-md w-full rounded-lg border border-border shadow-2xl p-6 relative flex flex-col space-y-6">
              
              <button
                onClick={() => setShowAddModal(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-1">
                <h3 className="text-lg font-serif font-bold text-foreground">Adicionar Serviço</h3>
                <p className="text-xs text-muted-foreground">Configure um serviço para o seu perfil profissional</p>
              </div>

              {/* Tabs selector */}
              <div className="grid grid-cols-2 bg-secondary/40 p-1 rounded-md border border-border">
                <button
                  type="button"
                  onClick={() => { setAddTab('existing'); setErrorMsg('') }}
                  className={`py-1.5 text-xs font-semibold rounded transition-all cursor-pointer ${
                    addTab === 'existing' 
                      ? 'bg-primary text-primary-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Selecionar do Catálogo
                </button>
                <button
                  type="button"
                  onClick={() => { setAddTab('new'); setErrorMsg('') }}
                  className={`py-1.5 text-xs font-semibold rounded transition-all cursor-pointer ${
                    addTab === 'new' 
                      ? 'bg-primary text-primary-foreground shadow-sm' 
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
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Escolha o Serviço</label>
                      {availableCatalogServices.length > 0 ? (
                        <select
                          value={selectedCatalogServiceId}
                          onChange={handleCatalogServiceChange}
                          className="w-full bg-secondary border border-border text-foreground px-3 py-2 rounded text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-none"
                          required
                        >
                          <option value="">Selecione um serviço...</option>
                          {availableCatalogServices.map((cs) => (
                            <option key={cs.id} value={cs.id}>
                              {cs.name} (Padrão: R$ {Number(cs.price).toFixed(2)})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-xs text-amber-500 bg-amber-500/10 p-3 rounded border border-amber-500/20">
                          Todos os serviços do catálogo da barbearia já estão vinculados ao seu perfil. Se quiser adicionar outro, use a aba "Cadastrar Novo".
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome do Serviço</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: Alinhamento Especial de Cabelo"
                        className="w-full bg-secondary border border-border text-foreground px-3 py-2 rounded text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                        required={addTab === 'new'}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Descrição</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Explique o serviço e o capricho envolvido..."
                        className="w-full bg-secondary border border-border text-foreground px-3 py-2 rounded text-xs focus:ring-1 focus:ring-primary focus:outline-none h-16 resize-none"
                      />
                    </div>
                  </div>
                )}

                {/* Custom price/duration inputs (always visible and mandatory) */}
                {(addTab === 'new' || (addTab === 'existing' && availableCatalogServices.length > 0)) && (
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Seu Preço (R$)</label>
                      <div className="relative flex items-center">
                        <DollarSign className="w-3.5 h-3.5 text-muted-foreground absolute left-3" />
                        <input
                          type="number"
                          step="0.01"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          className="w-full bg-secondary border border-border text-foreground pl-8 pr-3 py-2 rounded text-xs focus:ring-1 focus:ring-primary focus:outline-none font-mono"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Duração (Min)</label>
                      <div className="relative flex items-center">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground absolute left-3" />
                        <input
                          type="number"
                          value={duration}
                          onChange={(e) => setDuration(e.target.value)}
                          className="w-full bg-secondary border border-border text-foreground pl-8 pr-3 py-2 rounded text-xs focus:ring-1 focus:ring-primary focus:outline-none font-mono"
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
                    className="px-4 py-2 bg-secondary hover:bg-muted text-foreground border border-border font-bold rounded text-xs transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending || actionLoading || (addTab === 'existing' && availableCatalogServices.length === 0)}
                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground font-bold rounded text-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {(isPending || actionLoading) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Confirmar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* EDIT SERVICE MODAL */}
        {showEditModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass max-w-md w-full rounded-lg border border-border shadow-2xl p-6 relative flex flex-col space-y-6">
              
              <button
                onClick={() => setShowEditModal(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-1">
                <h3 className="text-lg font-serif font-bold text-foreground">Editar Configurações</h3>
                <p className="text-xs text-muted-foreground">Modifique preço, tempo e visibilidade deste serviço</p>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Seu Preço (R$)</label>
                    <div className="relative flex items-center">
                      <DollarSign className="w-3.5 h-3.5 text-muted-foreground absolute left-3" />
                      <input
                        type="number"
                        step="0.01"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="w-full bg-secondary border border-border text-foreground pl-8 pr-3 py-2 rounded text-xs focus:ring-1 focus:ring-primary focus:outline-none font-mono"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Duração (Min)</label>
                    <div className="relative flex items-center">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground absolute left-3" />
                      <input
                        type="number"
                        value={editDuration}
                        onChange={(e) => setEditDuration(e.target.value)}
                        className="w-full bg-secondary border border-border text-foreground pl-8 pr-3 py-2 rounded text-xs focus:ring-1 focus:ring-primary focus:outline-none font-mono"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Visibilidade para Clientes</label>
                  <div className="flex items-center gap-3 bg-secondary/35 p-3 rounded border border-border">
                    <input
                      type="checkbox"
                      id="editIsActive"
                      checked={editIsActive}
                      onChange={(e) => setEditIsActive(e.target.checked)}
                      className="accent-primary w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="editIsActive" className="text-xs font-semibold text-foreground cursor-pointer select-none">
                      Serviço Ativo e Agendável
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t border-border/40">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 bg-secondary hover:bg-muted text-foreground border border-border font-bold rounded text-xs transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending || actionLoading}
                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground font-bold rounded text-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
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
