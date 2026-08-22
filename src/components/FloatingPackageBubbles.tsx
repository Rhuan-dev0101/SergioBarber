'use client'

import React, { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Scissors, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { formatWhatsAppLink } from '@/lib/settings'

export function FloatingPackageBubbles() {
  const pathname = usePathname()
  const [whatsapp, setWhatsapp] = useState<string>('11979739903')

  useEffect(() => {
    async function fetchSettings() {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('business_settings')
          .select('value')
          .eq('key', 'general_settings')
          .single()

        if (data?.value && (data.value as any).whatsapp) {
          setWhatsapp((data.value as any).whatsapp)
        }
      } catch (err) {
        console.error('Error fetching settings for floating bubbles:', err)
      }
    }

    fetchSettings()
  }, [])

  // Hide floating bubbles in admin panel (/painel) to prevent overlapping admin UI
  if (pathname?.startsWith('/painel')) {
    return null
  }

  const corteWaMessage = "Olá! Tenho interesse no Pacote Mensal de Corte (4 cortes por R$150/mês). Gostaria de agendar meu horário fixo!"
  const corteWaUrl = formatWhatsAppLink(whatsapp, corteWaMessage)

  const comboWaMessage = "Olá! Tenho interesse no Pacote Mensal Cabelo + Barba (4 atendimentos por R$250/mês). Gostaria de agendar meu horário fixo!"
  const comboWaUrl = formatWhatsAppLink(whatsapp, comboWaMessage)

  return (
    <>
      {/* ── Left Floating Bubble: Pacote Cabelo + Barba (R$ 250/mês) ── */}
      <div className="fixed bottom-4 left-3 sm:bottom-6 sm:left-6 z-40 animate-in fade-in slide-in-from-bottom-5 duration-500">
        <a
          href={comboWaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-2 sm:gap-3 bg-card/95 hover:bg-card border border-primary/40 p-2 sm:p-3 pr-3 sm:pr-4 rounded-full shadow-2xl backdrop-blur-md transition-all hover:scale-105 active:scale-95 hover:border-primary cursor-pointer max-w-[170px] sm:max-w-none"
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary relative shrink-0">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-emerald-500 rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-emerald-500 rounded-full" />
          </div>
          <div className="flex flex-col text-left overflow-hidden">
            <div className="flex items-center gap-1">
              <span className="text-[8px] sm:text-[9px] font-bold text-primary uppercase tracking-wider truncate">Cabelo + Barba</span>
              <span className="text-[7px] sm:text-[8px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1 py-0.2 rounded font-bold uppercase shrink-0">-R$90</span>
            </div>
            <span className="text-[10px] sm:text-xs font-serif font-bold text-foreground group-hover:text-primary transition-colors truncate">
              4 combos R$ 250/mês
            </span>
          </div>
        </a>
      </div>

      {/* ── Right Floating Bubble: Pacote Corte (R$ 150/mês) ── */}
      <div className="fixed bottom-4 right-3 sm:bottom-6 sm:right-6 z-40 animate-in fade-in slide-in-from-bottom-5 duration-500">
        <a
          href={corteWaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-2 sm:gap-3 bg-card/95 hover:bg-card border border-primary/40 p-2 sm:p-3 pr-3 sm:pr-4 rounded-full shadow-2xl backdrop-blur-md transition-all hover:scale-105 active:scale-95 hover:border-primary cursor-pointer max-w-[170px] sm:max-w-none"
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary relative shrink-0">
            <Scissors className="w-4 h-4 sm:w-5 sm:h-5 rotate-45" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-emerald-500 rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-emerald-500 rounded-full" />
          </div>
          <div className="flex flex-col text-left overflow-hidden">
            <div className="flex items-center gap-1">
              <span className="text-[8px] sm:text-[9px] font-bold text-primary uppercase tracking-wider truncate">Pacote Corte</span>
              <span className="text-[7px] sm:text-[8px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1 py-0.2 rounded font-bold uppercase shrink-0">-R$50</span>
            </div>
            <span className="text-[10px] sm:text-xs font-serif font-bold text-foreground group-hover:text-primary transition-colors truncate">
              4 cortes R$ 150/mês
            </span>
          </div>
        </a>
      </div>
    </>
  )
}
