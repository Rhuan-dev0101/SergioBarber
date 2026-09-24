'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Scissors, Plus, Edit2, Trash2, Clock, DollarSign, AlertCircle,
  CheckCircle2, Loader2, Save, X, Sparkles, Check, AlertTriangle
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { DashboardSidebar } from '@/components/DashboardSidebar'
import { AddServiceModal } from '@/components/meus-servicos/AddServiceModal'
import { EditServiceModal } from '@/components/meus-servicos/EditServiceModal'
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
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
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
    setDeleteTarget(null)
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
                          onClick={() => setDeleteTarget(bs)}
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

        {/* ADD SERVICE MODAL */}
        <AddServiceModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={(msg) => {
            setSuccessMsg(msg)
            if (selectedBarberId) loadData(selectedBarberId)
          }}
          barberId={selectedBarberId}
          allCatalogServices={allCatalogServices}
        />

        {/* EDIT SERVICE MODAL */}
        <EditServiceModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false)
            setEditingId(null)
          }}
          onSuccess={(msg) => {
            setSuccessMsg(msg)
            if (selectedBarberId) loadData(selectedBarberId)
          }}
          barberId={selectedBarberId}
          editingService={barberServices.find(bs => bs.id === editingId)}
        />

        {/* DELETE CONFIRM MODAL */}
        {deleteTarget && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass p-6 sm:p-8 rounded-xl border border-red-800/50 max-w-md w-full shadow-2xl space-y-5 relative">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-red-900/30 border border-red-800/40 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-foreground">Remover Serviço?</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Esta ação não remove o serviço do catálogo da barbearia, apenas do seu perfil.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 bg-secondary hover:bg-muted border border-border text-foreground rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(deleteTarget.id)}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Removendo...</>
                  ) : (
                    <><Trash2 className="w-3.5 h-3.5" /> Sim, remover</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
