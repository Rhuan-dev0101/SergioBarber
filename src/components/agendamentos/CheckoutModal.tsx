'use client'

import React, { useState, useEffect } from 'react'
import {
  DollarSign, X, CheckCircle2, AlertCircle, Scissors, Zap, Wallet, Loader2, FileText, Pencil, Check
} from 'lucide-react'
import { bulkCheckoutAction } from '@/app/painel/agendamentos/actions'

export type CheckoutItem = {
  apptId: string
  customerName: string
  serviceName: string
  barberName?: string
  price: number
  originalPrice: number
  time: string
  originalMethod: string
  selectedMethod: string
  selected: boolean
  isPackage: boolean
  isExtra: boolean
  status: 'idle' | 'success' | 'error'
  errorMsg?: string
}

interface CheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (message: string) => void
  onError: (message: string) => void
  onRefreshData: () => void
  unpaidAppointments: any[]
  selectedAgendaDate: string
  formatAgendaHeaderDate: (dateStr: string) => string
  getAppointmentPrice: (appt: any) => number
  formatTime: (dateStr: string) => string
  onSelectReceiptAppt: (apptId: string) => void
}

export function CheckoutModal({
  isOpen,
  onClose,
  onSuccess,
  onError,
  onRefreshData,
  unpaidAppointments,
  selectedAgendaDate,
  formatAgendaHeaderDate,
  getAppointmentPrice,
  formatTime,
  onSelectReceiptAppt,
}: CheckoutModalProps) {
  const [checkoutItems, setCheckoutItems] = useState<CheckoutItem[]>([])
  const [checkoutProcessing, setCheckoutProcessing] = useState(false)
  const [checkoutDone, setCheckoutDone] = useState(false)
  const [editingPriceIdx, setEditingPriceIdx] = useState<number | null>(null)
  const [priceInputValue, setPriceInputValue] = useState('')

  useEffect(() => {
    if (isOpen) {
      const items: CheckoutItem[] = unpaidAppointments.map(a => {
        const payMethod = Array.isArray(a.payments) ? a.payments[0]?.method : a.payments?.method
        const price = getAppointmentPrice(a)
        return {
          apptId: a.id,
          customerName: a.customerName || 'Cliente',
          serviceName: a.services?.name || 'Serviço',
          barberName: a.barberName || 'Barbeiro',
          price,
          originalPrice: price,
          time: formatTime(a.start_time),
          originalMethod: payMethod || 'cash',
          selectedMethod: payMethod || 'cash',
          selected: true,
          isPackage: !!a.package_subscription_id,
          isExtra: !!a.is_extra,
          status: 'idle'
        }
      })
      setCheckoutItems(items)
      setCheckoutDone(false)
      setCheckoutProcessing(false)
      setEditingPriceIdx(null)
    }
  }, [isOpen, unpaidAppointments, getAppointmentPrice, formatTime])

  const confirmPriceEdit = (idx: number) => {
    const parsed = parseFloat(priceInputValue.replace(',', '.'))
    if (!Number.isFinite(parsed) || parsed < 0) return
    setCheckoutItems(prev => prev.map((ci, i) => (i === idx ? { ...ci, price: parsed } : ci)))
    setEditingPriceIdx(null)
  }

  const handleClose = () => {
    setCheckoutItems([])
    setCheckoutDone(false)
    setCheckoutProcessing(false)
    setEditingPriceIdx(null)
    onClose()
  }

  const handleConfirmCheckout = async () => {
    setCheckoutProcessing(true)
    const selectedItems = checkoutItems
      .filter(i => i.selected)
      .map(i => ({
        appointmentId: i.apptId,
        paymentMethod: i.selectedMethod,
        ...(i.price !== i.originalPrice ? { finalAmount: i.price } : {})
      }))

    try {
      const res = await bulkCheckoutAction(selectedItems)

      setCheckoutItems(prev => prev.map(ci => {
        if (!ci.selected) return ci
        const result = res.results.find(r => r.appointmentId === ci.apptId)
        if (!result) return ci
        return {
          ...ci,
          status: result.success ? 'success' as const : 'error' as const,
          errorMsg: result.success ? undefined : result.message
        }
      }))

      setCheckoutDone(true)

      if (res.success) {
        onSuccess(res.message)
      } else {
        onError(res.message)
      }

      onRefreshData()
    } catch (err) {
      console.error('Bulk checkout error:', err)
      onError('Erro inesperado ao processar checkout.')
    } finally {
      setCheckoutProcessing(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 animate-in fade-in duration-150">
      <div className="bg-card border border-border/80 rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-border/60 bg-gradient-to-r from-[#1a150a] to-[#0e0e10] shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base sm:text-lg text-foreground">Checkout do Dia</h3>
                <p className="text-[11px] text-muted-foreground">
                  {formatAgendaHeaderDate(selectedAgendaDate)} • {checkoutItems.filter(i => i.selected).length} selecionado(s)
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              aria-label="Fechar"
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body — Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {checkoutItems.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-semibold">Nenhum agendamento pendente para checkout.</p>
            </div>
          ) : (
            checkoutItems.map((item, idx) => (
              <div
                key={item.apptId}
                className={`rounded-xl border p-3.5 sm:p-4 transition-all space-y-3 ${
                  item.status === 'success'
                    ? 'bg-emerald-500/5 border-emerald-500/30'
                    : item.status === 'error'
                    ? 'bg-destructive/5 border-destructive/30'
                    : item.selected
                    ? 'bg-secondary/30 border-border/60 hover:border-amber-500/30'
                    : 'bg-secondary/10 border-border/30 opacity-50'
                }`}
              >
                {/* Row top: checkbox, time, customer, price */}
                <div className="flex items-center gap-3">
                  <label className="flex items-center shrink-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      disabled={checkoutProcessing || checkoutDone}
                      onChange={() => {
                        setCheckoutItems(prev => prev.map((ci, i) =>
                          i === idx ? { ...ci, selected: !ci.selected } : ci
                        ))
                      }}
                      className="w-4.5 h-4.5 rounded border-border accent-amber-500 cursor-pointer"
                    />
                  </label>

                  <span className="text-lg font-bold font-mono text-foreground w-14 shrink-0">
                    {item.time}
                  </span>

                  <div className="flex-1 min-w-0">
                    <h5 className="font-bold text-sm text-foreground truncate flex items-center gap-1.5 flex-wrap">
                      {item.customerName}
                      {item.isPackage && (
                        <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                          Pacote
                        </span>
                      )}
                      {item.isExtra && (
                        <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-dashed border-amber-500/40 shrink-0 flex items-center gap-0.5">
                          <Zap className="w-2.5 h-2.5 text-amber-400" />
                          Extra
                        </span>
                      )}
                      <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-secondary/80 text-foreground border border-border/60 shrink-0 flex items-center gap-1">
                        <Scissors className="w-2.5 h-2.5 text-primary" />
                        {item.barberName?.split(' ')[0]}
                      </span>
                    </h5>
                    <p className="text-xs text-muted-foreground truncate">{item.serviceName}</p>
                  </div>

                  {editingPriceIdx === idx ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-muted-foreground">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        autoFocus
                        value={priceInputValue}
                        onChange={(e) => setPriceInputValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') confirmPriceEdit(idx)
                          if (e.key === 'Escape') setEditingPriceIdx(null)
                        }}
                        className="w-20 px-2 py-1 bg-background border border-amber-500/50 rounded-lg text-xs font-bold text-foreground outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => confirmPriceEdit(idx)}
                        title="Confirmar valor"
                        className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingPriceIdx(null)}
                        title="Cancelar"
                        className="p-1 text-muted-foreground hover:bg-secondary rounded cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="font-serif font-bold text-amber-400 text-sm">
                        R$ {item.price.toFixed(2)}
                      </span>
                      {!checkoutProcessing && !checkoutDone && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPriceIdx(idx)
                            setPriceInputValue(item.price.toFixed(2))
                          }}
                          title="Editar valor (ex: aplicar desconto)"
                          className="p-1 text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10 rounded cursor-pointer transition-all"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Row bottom: payment method selector + status */}
                <div className="flex items-center gap-2 pl-7.5">
                  <Wallet className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <select
                    value={item.selectedMethod}
                    disabled={checkoutProcessing || checkoutDone || !item.selected}
                    onChange={(e) => {
                      setCheckoutItems(prev => prev.map((ci, i) =>
                        i === idx ? { ...ci, selectedMethod: e.target.value } : ci
                      ))
                    }}
                    className="flex-1 px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs font-semibold text-foreground outline-none cursor-pointer focus:border-amber-500/50"
                  >
                    <option value="cash">💵 Dinheiro</option>
                    <option value="pix">📱 Pix</option>
                    <option value="card">💳 Cartão</option>
                    <option value="other">📝 Outro</option>
                  </select>

                  {item.selectedMethod !== item.originalMethod && item.selected && item.status === 'idle' && (
                    <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 whitespace-nowrap shrink-0">
                      Alterado
                    </span>
                  )}

                  {item.price !== item.originalPrice && item.selected && item.status === 'idle' && (
                    <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 whitespace-nowrap shrink-0">
                      Valor Alterado
                    </span>
                  )}

                  {item.status === 'success' && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Pago
                    </span>
                  )}
                  {item.status === 'error' && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-destructive shrink-0" title={item.errorMsg}>
                      <AlertCircle className="w-3.5 h-3.5" /> Erro
                    </span>
                  )}
                </div>

                {item.status === 'error' && item.errorMsg && (
                  <div className="ml-7.5 p-2 bg-destructive/10 border border-destructive/20 rounded-lg text-[11px] text-destructive">
                    {item.errorMsg}
                  </div>
                )}

                {item.status === 'success' && (
                  <div className="ml-7.5">
                    <button
                      type="button"
                      onClick={() => onSelectReceiptAppt(item.apptId)}
                      className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary font-bold text-[11px] rounded-lg flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                    >
                      <FileText className="w-3.5 h-3.5" /> Emitir Recibo
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-border/60 bg-secondary/20 shrink-0 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {checkoutItems.filter(i => i.selected).length} de {checkoutItems.length} selecionado(s)
            </span>
            <span className="font-serif font-bold text-amber-400 text-sm">
              Total: R$ {checkoutItems.filter(i => i.selected).reduce((sum, i) => sum + i.price, 0).toFixed(2)}
            </span>
          </div>

          {!checkoutDone ? (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleClose}
                disabled={checkoutProcessing}
                className="flex-1 py-3 px-4 bg-secondary hover:bg-muted border border-border text-foreground font-semibold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={checkoutProcessing || checkoutItems.filter(i => i.selected).length === 0}
                onClick={handleConfirmCheckout}
                className="flex-[2] py-3 px-4 bg-gradient-to-r from-[#6b4f1d] via-[#947629] to-[#6b4f1d] hover:from-[#7a5b22] hover:via-[#a8862f] hover:to-[#7a5b22] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checkoutProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-amber-300" />
                    Confirmar Todos ({checkoutItems.filter(i => i.selected).length})
                  </>
                )}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-md"
            >
              <CheckCircle2 className="w-4 h-4" />
              Checkout Concluído — Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
