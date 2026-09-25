'use client'

import React, { useState } from 'react'
import { Scissors, Plus, X, Loader2 } from 'lucide-react'
import { CustomServiceSelect } from '@/components/CustomSelect'
import { addBarberServiceAction, createAndAddBarberServiceAction } from '@/app/painel/meus-servicos/actions'

interface AddServiceModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (msg: string) => void
  barberId: string
  allCatalogServices: any[]
}

export function AddServiceModal({
  isOpen,
  onClose,
  onSuccess,
  barberId,
  allCatalogServices,
}: AddServiceModalProps) {
  const [addTab, setAddTab] = useState<'existing' | 'new'>('existing')
  const [selectedCatalogServiceId, setSelectedCatalogServiceId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState('60')
  const [price, setPrice] = useState('50.00')
  const [errorMsg, setErrorMsg] = useState('')
  const [pending, setPending] = useState(false)

  const handleClose = () => {
    setSelectedCatalogServiceId('')
    setName('')
    setDescription('')
    setDuration('60')
    setPrice('50.00')
    setErrorMsg('')
    setAddTab('existing')
    onClose()
  }

  const handleAddExistingService = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!selectedCatalogServiceId || !price || !duration) {
      setErrorMsg('Selecione um serviço do catálogo e preencha preço e duração.')
      return
    }

    setPending(true)
    try {
      const res = await addBarberServiceAction(
        barberId,
        selectedCatalogServiceId,
        parseFloat(price),
        parseInt(duration, 10)
      )

      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        onSuccess(res.message)
        handleClose()
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro inesperado ao adicionar serviço.')
    } finally {
      setPending(false)
    }
  }

  const handleCreateNewService = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!name || !price || !duration) {
      setErrorMsg('Preencha nome, preço e duração do novo serviço.')
      return
    }

    setPending(true)
    try {
      const res = await createAndAddBarberServiceAction(
        barberId,
        name,
        description,
        parseFloat(price),
        parseInt(duration, 10)
      )

      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        onSuccess(res.message)
        handleClose()
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro inesperado ao criar serviço.')
    } finally {
      setPending(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-card border border-border/80 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
        <div className="flex justify-between items-center pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-foreground">Adicionar Serviço</h3>
              <p className="text-[11px] text-muted-foreground">Inclua um novo serviço no seu catálogo de atendimento</p>
            </div>
          </div>
          <button onClick={handleClose} aria-label="Fechar" className="p-1 text-muted-foreground hover:text-foreground rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 bg-secondary/60 p-1 rounded-xl border border-border/60">
          <button
            type="button"
            onClick={() => setAddTab('existing')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              addTab === 'existing' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Do Catálogo Geral
          </button>
          <button
            type="button"
            onClick={() => setAddTab('new')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              addTab === 'new' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Criar Novo Serviço
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive font-semibold">
            {errorMsg}
          </div>
        )}

        {addTab === 'existing' ? (
          <form onSubmit={handleAddExistingService} className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Serviço do Catálogo *</label>
              <CustomServiceSelect
                services={allCatalogServices}
                selectedId={selectedCatalogServiceId}
                onSelect={(id) => {
                  setSelectedCatalogServiceId(id)
                  const svc = allCatalogServices.find(s => s.id === id)
                  if (svc) {
                    setPrice(String(svc.price))
                    setDuration(String(svc.duration))
                    setDescription(svc.description || '')
                  }
                }}
                disabled={pending}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Preço (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary/50 border border-border focus:border-primary rounded-xl text-xs text-foreground outline-none font-bold"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Duração (min) *</label>
                <input
                  type="number"
                  step="5"
                  min="5"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary/50 border border-border focus:border-primary rounded-xl text-xs text-foreground outline-none font-bold"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Descrição Personalizada (opcional)</label>
              <textarea
                placeholder="Ex: Inclui lavagem e finalização..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full p-2.5 bg-secondary/50 border border-border focus:border-primary rounded-xl text-xs text-foreground outline-none resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={pending}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending}
                className="px-5 py-2 bg-primary text-primary-foreground font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
              >
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Adicionar ao Meu Perfil'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleCreateNewService} className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Nome do Serviço *</label>
              <input
                type="text"
                placeholder="Ex: Nevou / Descoloração"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-secondary/50 border border-border focus:border-primary rounded-xl text-xs text-foreground outline-none font-bold"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Preço (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary/50 border border-border focus:border-primary rounded-xl text-xs text-foreground outline-none font-bold"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Duração (min) *</label>
                <input
                  type="number"
                  step="5"
                  min="5"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary/50 border border-border focus:border-primary rounded-xl text-xs text-foreground outline-none font-bold"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Descrição *</label>
              <textarea
                placeholder="Descrição do novo serviço..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full p-2.5 bg-secondary/50 border border-border focus:border-primary rounded-xl text-xs text-foreground outline-none resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={pending}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending}
                className="px-5 py-2 bg-primary text-primary-foreground font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
              >
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar e Adicionar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
