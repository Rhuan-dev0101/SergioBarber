'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Shield, Settings, X, Check, ShieldOff } from 'lucide-react'
import { saveCookieConsentAction } from '@/app/cookie-consent/actions'

const CONSENT_KEY = 'osanchez_cookie_consent'
const VISITOR_ID_KEY = 'osanchez_visitor_id'

export const OPEN_COOKIE_PREFERENCES_EVENT = 'osanchez:open-cookie-preferences'

type ConsentSettings = { essential: boolean; analytics: boolean; marketing: boolean }

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [marketing, setMarketing] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY)

    if (!stored) {
      // Delay showing the banner slightly for premium UX feel
      const timer = setTimeout(() => setIsVisible(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    // Permite reabrir o painel a qualquer momento (ex.: link "Preferências
    // de Cookies" no rodapé), pré-carregando a escolha já salva.
    const handleReopen = () => {
      const stored = localStorage.getItem(CONSENT_KEY)
      if (stored) {
        try {
          const parsed: ConsentSettings = JSON.parse(stored)
          setAnalytics(!!parsed.analytics)
          setMarketing(!!parsed.marketing)
        } catch {
          // ignora JSON inválido e mantém os padrões
        }
      }
      setShowSettings(true)
      setIsVisible(true)
    }

    window.addEventListener(OPEN_COOKIE_PREFERENCES_EVENT, handleReopen)
    return () => window.removeEventListener(OPEN_COOKIE_PREFERENCES_EVENT, handleReopen)
  }, [])

  const saveConsent = async (consentSettings: ConsentSettings) => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consentSettings))
    setIsVisible(false)
    setShowSettings(false)

    // O identificador de visitante só é criado no momento em que uma
    // decisão de fato é salva — não no primeiro carregamento da página,
    // que aconteceria antes de qualquer consentimento.
    let visitorId = localStorage.getItem(VISITOR_ID_KEY)
    if (!visitorId) {
      visitorId = crypto.randomUUID()
      localStorage.setItem(VISITOR_ID_KEY, visitorId)
    }

    try {
      await saveCookieConsentAction({ visitorId, ...consentSettings })
    } catch (error) {
      console.error('Error saving cookie consent:', error)
    }
  }

  const handleAcceptAll = () => {
    saveConsent({ essential: true, analytics: true, marketing: true })
  }

  const handleRejectNonEssential = () => {
    saveConsent({ essential: true, analytics: false, marketing: false })
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
            onClick={handleRejectNonEssential}
            aria-label="Fechar e rejeitar cookies não essenciais"
            title="Fechar e rejeitar cookies não essenciais"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!showSettings ? (
          <>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Nós usamos cookies estritamente necessários para o funcionamento da plataforma.
              Com sua permissão, também usamos cookies de estatísticas e marketing — veja os
              detalhes na nossa{' '}
              <Link href="/politica-de-cookies" className="text-primary hover:underline font-medium">
                Política de Cookies
              </Link>.
            </p>
            <div className="flex flex-col gap-2 mt-2">
              <div className="flex gap-2">
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
              <button
                onClick={handleRejectNonEssential}
                className="w-full px-3 py-2 rounded text-xs font-semibold bg-transparent hover:bg-secondary text-muted-foreground hover:text-foreground border border-transparent flex items-center justify-center gap-1.5 transition-all"
              >
                <ShieldOff className="w-3.5 h-3.5" />
                Rejeitar não essenciais
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
