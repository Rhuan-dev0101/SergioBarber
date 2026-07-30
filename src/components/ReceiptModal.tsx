'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  X, Download, Share2, Loader2, CheckCircle2, 
  Scissors, Phone, MapPin, Calendar, Clock, CreditCard, DollarSign, AlertCircle, Sparkles
} from 'lucide-react'
import { ReceiptData, getReceiptDataAction } from '@/lib/receipt-actions'

interface ReceiptModalProps {
  paymentId?: string
  appointmentId?: string
  onClose: () => void
}

export function ReceiptModal({ paymentId, appointmentId, onClose }: ReceiptModalProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<ReceiptData | null>(null)
  
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [canShare, setCanShare] = useState(false)
  const [shareSuccess, setShareSuccess] = useState(false)

  const receiptRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      const res = await getReceiptDataAction({ paymentId, appointmentId })
      if (!res.success || !res.data) {
        setError(res.message || 'Erro ao carregar os dados do recibo.')
      } else {
        setData(res.data)
      }
      setLoading(false)
    }
    load()
  }, [paymentId, appointmentId])

  // Check Web Share API capability with files support
  useEffect(() => {
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      typeof File !== 'undefined'
    ) {
      try {
        const dummyFile = new File(['test'], 'test.pdf', { type: 'application/pdf' })
        if (navigator.canShare({ files: [dummyFile] })) {
          setCanShare(true)
        } else {
          setCanShare(false)
        }
      } catch (e) {
        setCanShare(false)
      }
    } else {
      setCanShare(false)
    }
  }, [])

  const generatePdfBlob = async (): Promise<{ blob: Blob; fileName: string } | null> => {
    if (!receiptRef.current || !data) return null

    try {
      // Dynamic imports of client-side libraries
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')

      const element = receiptRef.current

      // CRITICAL: allowTaint MUST be false, otherwise canvas.toDataURL() throws a SecurityError ("Tainted canvases may not be exported")
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#09090b'
      })

      const imgData = canvas.toDataURL('image/png')

      // Calculate dynamic PDF dimensions so receipt is 100% visible without clipping
      const cardWidth = 140 // mm
      const cardHeight = (canvas.height * cardWidth) / canvas.width
      const margin = 6 // mm
      const pdfWidth = cardWidth + (margin * 2)
      const pdfHeight = cardHeight + (margin * 2)

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [pdfWidth, pdfHeight]
      })

      // Fill matching dark background
      pdf.setFillColor(9, 9, 11) // #09090b
      pdf.rect(0, 0, pdfWidth, pdfHeight, 'F')

      // Draw receipt image centered with margin
      pdf.addImage(imgData, 'PNG', margin, margin, cardWidth, cardHeight)

      const blob = pdf.output('blob')
      const fileName = `Recibo_${data.receiptNumber}.pdf`

      return { blob, fileName }
    } catch (err: any) {
      console.error('Error generating PDF:', err)
      // Retry once with scale 1 and allowTaint: false
      try {
        const html2canvas = (await import('html2canvas')).default
        const { jsPDF } = await import('jspdf')
        const element = receiptRef.current
        if (!element) return null

        const canvas = await html2canvas(element, { 
          scale: 1, 
          useCORS: true, 
          allowTaint: false, 
          logging: false,
          backgroundColor: '#09090b' 
        })
        const imgData = canvas.toDataURL('image/png')
        const cardWidth = 140
        const cardHeight = (canvas.height * cardWidth) / canvas.width
        const margin = 6
        const pdfWidth = cardWidth + (margin * 2)
        const pdfHeight = cardHeight + (margin * 2)
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pdfWidth, pdfHeight] })
        pdf.setFillColor(9, 9, 11)
        pdf.rect(0, 0, pdfWidth, pdfHeight, 'F')
        pdf.addImage(imgData, 'PNG', margin, margin, cardWidth, cardHeight)
        return { blob: pdf.output('blob'), fileName: `Recibo_${data.receiptNumber}.pdf` }
      } catch (retryErr: any) {
        console.error('Retry PDF generation failed:', retryErr)
        throw new Error(retryErr?.message || err?.message || 'Erro de renderização gráfica')
      }
    }
  }

  const handleDownload = async () => {
    setIsGeneratingPdf(true)
    try {
      const result = await generatePdfBlob()
      if (result) {
        const url = URL.createObjectURL(result.blob)
        const a = document.createElement('a')
        a.href = url
        a.download = result.fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (err: any) {
      alert(`Erro ao gerar PDF: ${err?.message || 'Tente novamente.'}`)
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  const handleShare = async () => {
    if (!canShare) {
      handleDownload()
      return
    }

    setIsGeneratingPdf(true)
    setShareSuccess(false)
    try {
      const result = await generatePdfBlob()
      if (!result) return

      const file = new File([result.blob], result.fileName, { type: 'application/pdf' })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: `Recibo #${data?.receiptNumber} - ${data?.businessName}`,
            text: `Segue o comprovante de pagamento do recibo #${data?.receiptNumber}.`,
            files: [file]
          })
          setShareSuccess(true)
          setTimeout(() => setShareSuccess(false), 3000)
        } catch (shareErr: any) {
          if (shareErr.name === 'AbortError' || shareErr.code === 20) {
            return
          }
          console.error('Share execution error:', shareErr)
        }
      } else {
        handleDownload()
      }
    } catch (err: any) {
      alert(`Erro ao compartilhar: ${err?.message || 'Tente novamente.'}`)
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatTime = (dateStr: string) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  const formatMethod = (method: string) => {
    switch (method?.toLowerCase()) {
      case 'cash':
      case 'dinheiro':
        return 'Dinheiro Presencial'
      case 'pix':
        return 'Pix (Transferência Instantânea)'
      case 'card':
      case 'cartao':
        return 'Cartão de Débito/Crédito'
      default:
        return method || 'Dinheiro'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-card border border-border/80 rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        
        {/* Header bar */}
        <div className="p-4 sm:p-5 border-b border-border/60 flex items-center justify-between bg-secondary/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
              <Scissors className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base sm:text-lg text-foreground">Comprovante de Pagamento</h3>
              <p className="text-[11px] text-muted-foreground">Recibo Eletrônico de Atendimento</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal content body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground font-medium">Carregando dados do recibo...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-2xl flex items-center gap-3 text-xs text-destructive">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : data ? (
            <>
              {/* Visual Printable Receipt Card */}
              <div 
                ref={receiptRef}
                className="bg-[#09090b] text-[#f4f4f5] border border-amber-500/30 rounded-2xl p-6 sm:p-7 space-y-6 shadow-xl relative font-sans overflow-hidden"
              >
                {/* Decorative Gold Accent Bar */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#c59b27] via-[#fef08a] to-[#c59b27]" />

                {/* 1. Header: Logo, Business Info & PROMINENT PAGO BADGE */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#c59b27]/20 border border-[#c59b27]/40 flex items-center justify-center text-[#c59b27]">
                        <Scissors className="w-4 h-4" />
                      </div>
                      <h2 className="text-lg font-serif font-bold text-[#ffffff] tracking-wide">
                        {data.businessName}
                      </h2>
                    </div>
                    <p className="text-[11px] text-zinc-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#c59b27]" /> {data.businessAddress}
                    </p>
                    <p className="text-[11px] text-zinc-400 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-[#c59b27]" /> WhatsApp: {data.businessWhatsapp}
                    </p>
                  </div>

                  {/* Prominent Green PAGO Badge */}
                  <div className="flex flex-col items-start sm:items-end gap-1 shrink-0">
                    <span className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-inner">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> PAGO
                    </span>
                    <span className="text-[11px] font-mono text-[#c59b27] font-bold">
                      Recibo #{data.receiptNumber}
                    </span>
                  </div>
                </div>

                {/* 2. Customer & Date Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-900/80 p-3.5 rounded-xl border border-zinc-800 text-xs">
                  <div>
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Cliente</span>
                    <span className="font-bold text-white text-sm">{data.customerName}</span>
                  </div>
                  <div className="sm:text-right">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Data do Pagamento</span>
                    <span className="font-medium text-zinc-200">
                      {formatDate(data.paymentDate)} às {formatTime(data.paymentDate)}
                    </span>
                  </div>
                </div>

                {/* 3. Items Table */}
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] uppercase font-bold text-[#c59b27] tracking-wider border-b border-zinc-800 pb-1.5">
                    <span>Serviço / Item</span>
                    <span className="text-right">Valor</span>
                  </div>

                  <div className="divide-y divide-zinc-800/60 text-xs space-y-2 pt-1">
                    {data.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-1.5">
                        <div>
                          <p className="font-bold text-white">{item.name}</p>
                          {item.duration && (
                            <p className="text-[10px] text-zinc-400 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[#c59b27]" /> Duração: {item.duration} min • Qtd: {item.quantity}
                            </p>
                          )}
                        </div>
                        <span className="font-mono font-bold text-zinc-200">
                          R$ {item.price.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Financial Summary Breakdown */}
                <div className="border-t border-zinc-800 pt-4 space-y-2 text-xs">
                  <div className="flex justify-between text-zinc-400">
                    <span>Subtotal:</span>
                    <span className="font-mono">R$ {data.subtotal.toFixed(2)}</span>
                  </div>

                  {data.hasNoShowFee && (
                    <div className="flex justify-between text-amber-400">
                      <span>Taxa de Não Compareceu:</span>
                      <span className="font-mono">R$ {data.noShowFeeAmount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm font-bold border-t border-zinc-800 pt-2 text-white">
                    <span className="uppercase text-[#c59b27] font-serif">Total Pago:</span>
                    <span className="font-mono text-base text-[#c59b27]">
                      R$ {data.totalAmount.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between text-[11px] text-zinc-400 pt-1">
                    <span>Forma de Pagamento:</span>
                    <span className="font-semibold text-zinc-200">{formatMethod(data.paymentMethod)}</span>
                  </div>
                </div>

                {/* 5. Footer */}
                <div className="border-t border-zinc-800/80 pt-3 text-center space-y-1">
                  <p className="text-[11px] font-serif font-medium text-zinc-300">Obrigado pela preferência!</p>
                  <p className="text-[9px] text-zinc-500 uppercase tracking-widest">
                    Osanchez Barbearia • Documento Emitido Eletronicamente
                  </p>
                </div>

              </div>

              {/* Desktop vs Mobile Share Note */}
              {!canShare && (
                <div className="p-3 bg-secondary/60 border border-border/70 rounded-xl text-center space-y-1">
                  <p className="text-xs font-semibold text-foreground">
                    💡 Baixe o PDF e envie manualmente pelo WhatsApp.
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    (O compartilhamento direto de arquivos via navegador está disponível prioritariamente em celulares/smartphones).
                  </p>
                </div>
              )}

              {shareSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center text-xs font-bold text-emerald-400 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Recibo compartilhado com sucesso!
                </div>
              )}
            </>
          ) : null}

        </div>

        {/* Modal Action Buttons */}
        <div className="p-4 sm:p-5 border-t border-border/60 bg-secondary/30 flex flex-col sm:flex-row items-center gap-2.5 shrink-0">
          <button
            onClick={handleDownload}
            disabled={isGeneratingPdf || !data}
            className="w-full sm:flex-1 py-3 px-4 bg-secondary hover:bg-muted border border-border text-foreground font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isGeneratingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <Download className="w-4 h-4 text-primary" />
            )}
            <span>Baixar PDF</span>
          </button>

          {canShare && (
            <button
              onClick={handleShare}
              disabled={isGeneratingPdf || !data}
              className="w-full sm:flex-1 py-3 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary-foreground" />
              ) : (
                <Share2 className="w-4 h-4 text-primary-foreground" />
              )}
              <span>Compartilhar</span>
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
