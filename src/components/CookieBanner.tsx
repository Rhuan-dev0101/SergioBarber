'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Shield, Settings, X, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase'

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [analytics, setAnalytics] = useState(true)
  const [marketing, setMarketing] = useState(false)
  const [visitorId, setVisitorId] = useState('')

  useEffect(() => {
    // Check if consent already exists
    const consent = localStorage.getItem('osanchez_cookie_consent')
    let storedVisitorId = localStorage.getItem('osanchez_visitor_id')

    if (!storedVisitorId) {
      storedVisitorId = crypto.randomUUID()
      localStorage.setItem('osanchez_visitor_id', storedVisitorId)
    }
    setVisitorId(storedVisitorId)

    if (!consent) {
      // Delay showing the banner slightly for premium UX feel
      const timer = setTimeout(() => setIsVisible(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [])

  const saveConsent = async (consentSettings: { essential: boolean; analytics: boolean; marketing: boolean }) => {
    localStorage.setItem('osanchez_cookie_consent', JSON.stringify(consentSettings))
    setIsVisible(false)

    // Save to Supabase (anonymous insert)
    try {
      const supabase = createClient()
      await supabase.from('cookie_consents').insert({
        visitor_id: visitorId,
        consented_categories: consentSettings,
        ip_address: 'client-side' // actual IP can be captured server-side via SQL default or request
      })
    } catch (error) {
      console.error('Error saving cookie consent to db:', error)
    }
  }

  const handleAcceptAll = () => {
    saveConsent({ essential: true, analytics: true, marketing: true })
  }

  const handleSavePreferences = () => {
    saveConsent({ essential: true, analytics, marketing })
  }

  if (!isVisible) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 animate-in slide-in-from-bottom duration-300">
      <div className="glass p-6 rounded-lg shadow-2xl border border-border flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-primary">
            <Shield className="w-5 h-5" />
            <h3 className="font-semibold text-base">Controle de Cookies</h3>
          </div>
          <button 
            onClick={() => setIsVisible(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!showSettings ? (
          <>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Nós usamos cookies para melhorar sua experiência, analisar tráfego e personalizar conteúdo. 
              Ao continuar, você aceita o uso de cookies de acordo com nossa{' '}
              <Link href="/politica-de-cookies" className="text-primary hover:underline font-medium">
                Política de Cookies
              </Link>.
            </p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setShowSettings(true)}
                className="flex-1 px-3 py-2 rounded text-xs font-semibold bg-secondary hover:bg-muted text-foreground border border-border flex items-center justify-center gap-1.5 transition-all"
              >
                <Settings className="w-3.5 h-3.5" />
                Preferências
              </button>
              <button
                onClick={handleAcceptAll}
                className="flex-1 px-3 py-2 rounded text-xs font-semibold bg-primary hover:bg-primary-hover text-primary-foreground flex items-center justify-center gap-1.5 transition-all shadow-md"
              >
                <Check className="w-3.5 h-3.5" />
                Aceitar Todos
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              <div className="flex items-center justify-between p-2 rounded bg-secondary/50 border border-border/40">
                <div>
                  <div className="text-xs font-semibold flex items-center gap-1">
                    Essenciais
                    <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.2 rounded font-normal">Obrigatório</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Necessários para o funcionamento básico e segurança da plataforma.</p>
                </div>
                <input type="checkbox" checked disabled className="rounded accent-primary w-4 h-4 cursor-not-allowed" />
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-secondary/50 border border-border/40">
                <div>
                  <div className="text-xs font-semibold">Estatísticas (Analytics)</div>
                  <p className="text-[10px] text-muted-foreground">Nos ajudam a entender como a plataforma é utilizada para melhorias.</p>
                </div>
                <input
                  type="checkbox"
                  checked={analytics}
                  onChange={(e) => setAnalytics(e.target.checked)}
                  className="rounded accent-primary w-4 h-4 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-secondary/50 border border-border/40">
                <div>
                  <div className="text-xs font-semibold">Marketing</div>
                  <p className="text-[10px] text-muted-foreground">Usados para personalizar campanhas e anúncios de acordo com seu interesse.</p>
                </div>
                <input
                  type="checkbox"
                  checked={marketing}
                  onChange={(e) => setMarketing(e.target.checked)}
                  className="rounded accent-primary w-4 h-4 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setShowSettings(false)}
                className="px-3 py-2 rounded text-xs font-semibold bg-secondary hover:bg-muted text-foreground border border-border transition-all"
              >
                Voltar
              </button>
              <button
                onClick={handleSavePreferences}
                className="flex-1 px-3 py-2 rounded text-xs font-semibold bg-primary hover:bg-primary-hover text-primary-foreground flex items-center justify-center gap-1.5 transition-all shadow-md"
              >
                Salvar Preferências
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
