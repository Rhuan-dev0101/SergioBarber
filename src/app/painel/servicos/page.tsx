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
  createServiceAction, 
  updateServiceAction, 
  toggleServiceStatusAction 
} from './actions'

export default function PainelServicos() {
  const router = useRouter()
  const [services, setServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Modal / Form states
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState('60')
  const [price, setPrice] = useState('50.00')

  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isPending, startTransition] = useTransition()

  const supabase = createClient()

  const loadServices = async () => {
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

      const { data: dbServices } = await supabase
        .from('services')
        .select('*')
        .order('name', { ascending: true })

      if (dbServices) {
        setServices(dbServices)
      }
    } catch (err) {
      console.error('Error fetching services catalog:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadServices()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!name || !duration || !price) {
      setErrorMsg('Nome, duração e preço são obrigatórios.')
      return
    }

    startTransition(async () => {
      let res
      if (editingId) {
        res = await updateServiceAction(
          editingId,
          name,
          description,
          parseInt(duration, 10),
          parseFloat(price)
        )
      } else {
        res = await createServiceAction(
          name,
          description,
          parseInt(duration, 10),
          parseFloat(price)
        )
      }

      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg(res.message)
        setShowModal(false)
        
        // Reset states
        setEditingId(null)
        setName('')
        setDescription('')
        setDuration('60')
        setPrice('50.00')

        loadServices()
      }
    })
  }

  const handleEdit = (service: any) => {
    setEditingId(service.id)
    setName(service.name)
    setDescription(service.description || '')
    setDuration(String(service.duration))
    setPrice(Number(service.price).toFixed(2))
    setErrorMsg('')
    setSuccessMsg('')
    setShowModal(true)
  }

  const handleToggleStatus = (service: any) => {
    setErrorMsg('')
    setSuccessMsg('')

    startTransition(async () => {
      const res = await toggleServiceStatusAction(service.id, !service.is_active)
      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg(res.message)
        setServices(prev => prev.map(s => 
          s.id === service.id 
            ? { ...s, is_active: !s.is_active } 
            : s
        ))
      }
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col md:flex-row justify-center items-center gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Carregando catálogo de serviços...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <DashboardSidebar />

      <main className="flex-grow p-6 sm:p-8 space-y-6 overflow-y-auto">
        
        {/* Title */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/40 pb-4">
          <div>
            <h1 className="text-2xl font-serif font-bold text-foreground">Catálogo de Serviços</h1>
            <p className="text-xs text-muted-foreground">Crie, edite e ative os serviços oferecidos na barbearia</p>
          </div>
          <button
            onClick={() => {
              setEditingId(null)
              setName('')
              setDescription('')
              setDuration('60')
              setPrice('50.00')
              setShowModal(true)
            }}
            className="w-full sm:w-auto px-4 py-2.5 bg-primary hover:bg-primary-hover text-primary-foreground font-bold rounded text-xs flex items-center justify-center gap-1.5 shadow"
          >
            <Plus className="w-4 h-4 text-primary-foreground" />
            Adicionar Novo Serviço
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

        {/* Table representation */}
        <div className="glass rounded-lg border border-border overflow-x-auto shadow">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-secondary/40 border-b border-border/60 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                <th className="p-4">Serviço</th>
                <th className="p-4">Descrição</th>
                <th className="p-4">Duração</th>
                <th className="p-4">Preço</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-xs">
              {services.length > 0 ? (
                services.map((s) => (
                  <tr key={s.id} className="hover:bg-secondary/15 transition-colors">
                    <td className="p-4 font-semibold text-foreground whitespace-nowrap">
                      {s.name}
                    </td>
                    <td className="p-4 text-muted-foreground max-w-xs truncate">
                      {s.description || 'Nenhuma descrição informada.'}
                    </td>
                    <td className="p-4 whitespace-nowrap font-medium text-foreground">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        {s.duration} min
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap font-mono text-primary font-bold">
                      R$ {Number(s.price).toFixed(2)}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStatus(s)}
                        disabled={isPending}
                        className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase transition-all cursor-pointer ${
                          s.is_active 
                            ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' 
                            : 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                        }`}
                      >
                        {s.is_active ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleEdit(s)}
                        className="px-2.5 py-1 bg-secondary hover:bg-muted text-foreground border border-border rounded text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1 ml-auto"
                      >
                        <Edit2 className="w-3 h-3 text-primary" />
                        Editar
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground italic">
                    Nenhum serviço registrado no catálogo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="glass p-6 sm:p-8 rounded-lg border border-border max-w-md w-full shadow-2xl space-y-5 relative animate-in zoom-in-95 duration-200">
              
              <div className="flex justify-between items-center pb-2 border-b border-border/40">
                <h3 className="font-serif font-bold text-lg text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-5 h-5 text-primary" />
                  {editingId ? 'Editar Serviço' : 'Novo Serviço'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-muted-foreground hover:text-foreground p-1 hover:bg-secondary rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div className="space-y-1.5">
                  <label htmlFor="sName" className="text-xs font-semibold text-muted-foreground uppercase">Nome do Serviço</label>
                  <input
                    id="sName"
                    type="text"
                    placeholder="Ex: Corte Degradê Social"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isPending}
                    className="w-full px-3 py-2 bg-secondary border border-border focus:border-primary rounded text-xs text-foreground outline-none"
                    required
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label htmlFor="sDesc" className="text-xs font-semibold text-muted-foreground uppercase">Descrição</label>
                  <textarea
                    id="sDesc"
                    placeholder="Resumo do corte e técnicas inclusas..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isPending}
                    rows={3}
                    className="w-full p-3 bg-secondary border border-border focus:border-primary rounded text-xs text-foreground outline-none resize-none"
                  />
                </div>

                {/* Duration & Price */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="sDuration" className="text-xs font-semibold text-muted-foreground uppercase">Duração (Minutos)</label>
                    <input
                      id="sDuration"
                      type="number"
                      placeholder="60"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      disabled={isPending}
                      min="1"
                      className="w-full px-3 py-2 bg-secondary border border-border focus:border-primary rounded text-xs text-foreground outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="sPrice" className="text-xs font-semibold text-muted-foreground uppercase">Preço (R$)</label>
                    <input
                      id="sPrice"
                      type="number"
                      step="0.01"
                      placeholder="50.00"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      disabled={isPending}
                      min="0"
                      className="w-full px-3 py-2 bg-secondary border border-border focus:border-primary rounded text-xs text-foreground outline-none"
                      required
                    />
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-3 bg-primary hover:bg-primary-hover text-primary-foreground font-bold rounded text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-primary-foreground" />
                      Salvando dados...
                    </>
                  ) : (
                    <>
                      Salvar Serviço
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </>
                  )}
                </button>
              </form>

            </div>
          </div>
        )}

      </main>
    </div>
  )
}
