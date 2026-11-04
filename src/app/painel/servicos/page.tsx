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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/40 pb-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-2">
              <Scissors className="w-7 h-7 text-primary shrink-0" />
              Catálogo Geral de Serviços 💈
            </h1>
            <p className="text-xs text-muted-foreground">Cadastre e gerencie a lista oficial de cortes, barbas e tratamentos da barbearia</p>
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
            className="w-full sm:w-auto px-5 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200 cursor-pointer group"
          >
            <Plus className="w-4 h-4 text-primary-foreground transition-transform group-hover:scale-110" />
            <span>Adicionar Novo Serviço</span>
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

        {/* Table representation */}
        <div className="glass rounded-xl border border-border/80 overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse min-w-[650px]">
            <thead>
              <tr className="bg-secondary/40 border-b border-border/60 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                <th className="p-4">Serviço</th>
                <th className="p-4">Descrição</th>
                <th className="p-4">Duração</th>
                <th className="p-4">Preço Padrão</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-xs">
              {services.length > 0 ? (
                services.map((s) => (
                  <tr key={s.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="p-4 font-serif font-bold text-sm text-foreground whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Scissors className="w-4 h-4 text-primary shrink-0" />
                        <span>{s.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-muted-foreground max-w-xs truncate">
                      {s.description || 'Nenhuma descrição informada.'}
                    </td>
                    <td className="p-4 whitespace-nowrap font-semibold text-foreground">
                      <span className="flex items-center gap-1.5 bg-secondary/50 px-2.5 py-1 rounded-md border border-border/60 w-fit">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        {s.duration} min
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap font-mono text-primary font-bold text-sm">
                      R$&nbsp;{Number(s.price).toFixed(2)}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStatus(s)}
                        disabled={isPending}
                        className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                          s.is_active 
                            ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/25 hover:bg-emerald-500/25' 
                            : 'bg-destructive/15 text-destructive border-destructive/25 hover:bg-destructive/25'
                        }`}
                      >
                        {s.is_active ? 'Ativo ✓' : 'Inativo ✕'}
                      </button>
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleEdit(s)}
                        className="px-3 py-1.5 bg-secondary hover:bg-muted text-foreground border border-border rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ml-auto"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-primary" />
                        <span>Editar</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-muted-foreground italic">
                    Nenhum serviço registrado no catálogo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="glass max-w-lg w-full rounded-2xl border border-primary/40 shadow-2xl p-6 sm:p-8 relative space-y-6">
              
              <div className="flex justify-between items-center pb-3 border-b border-border/40">
                <h3 className="font-serif font-bold text-xl text-foreground flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  {editingId ? 'Editar Serviço do Catálogo' : 'Novo Serviço no Catálogo'}
                </h3>
                <button aria-label="Fechar"
                  onClick={() => setShowModal(false)}
                  className="text-muted-foreground hover:text-foreground p-1.5 hover:bg-secondary rounded-lg cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div className="space-y-1.5">
                  <label htmlFor="sName" className="text-xs font-bold text-foreground uppercase tracking-wider">Nome do Serviço</label>
                  <input
                    id="sName"
                    type="text"
                    placeholder="Ex: Corte Degradê Social com Navalha"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isPending}
                    className="w-full px-4 py-2.5 bg-background border border-border focus:border-primary rounded-lg text-base text-foreground outline-none font-medium"
                    required
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label htmlFor="sDesc" className="text-xs font-bold text-foreground uppercase tracking-wider">Descrição</label>
                  <textarea
                    id="sDesc"
                    placeholder="Resumo do serviço, acabamentos e produtos inclusos..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isPending}
                    rows={3}
                    className="w-full p-3 bg-background border border-border focus:border-primary rounded-lg text-base text-foreground outline-none resize-none"
                  />
                </div>

                {/* Duration & Price */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="sDuration" className="text-xs font-bold text-foreground uppercase tracking-wider">Duração (Minutos)</label>
                    <div className="relative flex items-center">
                      <Clock className="w-4 h-4 text-primary absolute left-3" />
                      <input
                        id="sDuration"
                        type="number"
                        placeholder="60"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        disabled={isPending}
                        min="1"
                        className="w-full bg-background border border-border text-foreground pl-9 pr-3 py-2.5 rounded-lg text-base focus:ring-1 focus:ring-primary focus:outline-none font-mono font-bold"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="sPrice" className="text-xs font-bold text-foreground uppercase tracking-wider">Preço Padrão (R$)</label>
                    <div className="relative flex items-center">
                      <DollarSign className="w-4 h-4 text-primary absolute left-3" />
                      <input
                        id="sPrice"
                        type="number"
                        step="0.01"
                        placeholder="50.00"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        disabled={isPending}
                        min="0"
                        className="w-full bg-background border border-border text-foreground pl-9 pr-3 py-2.5 rounded-lg text-base focus:ring-1 focus:ring-primary focus:outline-none font-mono font-bold"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Submit */}
                <div className="flex gap-3 justify-end pt-4 border-t border-border/40">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2.5 bg-secondary hover:bg-muted text-foreground border border-border font-semibold rounded-lg text-xs transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-md disabled:opacity-50"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-foreground" />
                        Salvando dados...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 text-primary-foreground" />
                        <span>Salvar Serviço</span>
                      </>
                    )}
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
