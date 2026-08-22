'use client'

import React, { useState, useEffect } from 'react'
import { Monitor, Smartphone, X, ArrowLeft, Play, Sparkles, MessageSquare, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { formatWhatsAppLink } from '@/lib/settings'

interface TutorialModalProps {
  isOpen: boolean
  onClose: () => void
  initialDesktopUrl?: string | null
  initialMobileUrl?: string | null
  initialWhatsapp?: string | null
}

export function getYouTubeEmbedUrl(url: string | null | undefined): string | null {
  if (!url || !url.trim()) return null
  const trimmed = url.trim()

  if (trimmed.includes('youtube.com/embed/')) {
    return trimmed.includes('?') ? `${trimmed}&autoplay=1` : `${trimmed}?autoplay=1`
  }

  const match = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (match && match[1]) {
    return `https://www.youtube.com/embed/${match[1]}?autoplay=1&rel=0`
  }

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return `https://www.youtube.com/embed/${trimmed}?autoplay=1&rel=0`
  }

  return null
}

export function TutorialModal({
  isOpen,
  onClose,
  initialDesktopUrl,
  initialMobileUrl,
  initialWhatsapp
}: TutorialModalProps) {
  const [selectedDevice, setSelectedDevice] = useState<'desktop' | 'mobile' | null>(null)
  const [desktopVideoUrl, setDesktopVideoUrl] = useState<string | null>(initialDesktopUrl || null)
  const [mobileVideoUrl, setMobileVideoUrl] = useState<string | null>(initialMobileUrl || null)
  const [whatsapp, setWhatsapp] = useState<string>(initialWhatsapp || '')
  const [loadingConfig, setLoadingConfig] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setSelectedDevice(null)
      return
    }

    // Fetch latest URLs from Supabase if not provided as initial props
    async function fetchConfig() {
      setLoadingConfig(true)
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('business_settings')
          .select('value')
          .eq('key', 'general_settings')
          .single()

        if (data?.value) {
          const val = data.value as any
          if (val.tutorial_video_desktop_url !== undefined) setDesktopVideoUrl(val.tutorial_video_desktop_url)
          if (val.tutorial_video_mobile_url !== undefined) setMobileVideoUrl(val.tutorial_video_mobile_url)
          if (val.whatsapp) setWhatsapp(val.whatsapp)
        }
      } catch (err) {
        console.error('Error fetching tutorial config:', err)
      } finally {
        setLoadingConfig(false)
      }
    }

    fetchConfig()
  }, [isOpen])

  if (!isOpen) return null

  const activeRawUrl = selectedDevice === 'desktop' ? desktopVideoUrl : mobileVideoUrl
  const embedUrl = getYouTubeEmbedUrl(activeRawUrl)

  const whatsappMessage = "Olá! Gostaria de ajuda e orientações sobre agendamentos na Osanchez Barbearia."
  const whatsappUrl = formatWhatsAppLink(whatsapp, whatsappMessage)

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="glass max-w-2xl w-full rounded-2xl border border-primary/40 shadow-2xl p-6 sm:p-8 relative flex flex-col space-y-6">
        
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-border/40 pb-4">
          <div className="flex items-center gap-2">
            {selectedDevice ? (
              <button
                type="button"
                onClick={() => setSelectedDevice(null)}
                className="p-1.5 rounded-lg bg-secondary hover:bg-muted text-foreground border border-border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer mr-1"
              >
                <ArrowLeft className="w-4 h-4 text-primary" />
                <span>Voltar</span>
              </button>
            ) : null}
            <div>
              <h2 className="text-xl font-serif font-bold text-foreground flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Tutorial da Barbearia 🎬
              </h2>
              <p className="text-xs text-muted-foreground">
                {selectedDevice === 'desktop'
                  ? 'Vídeo demonstrativo para navegadores no Computador'
                  : selectedDevice === 'mobile'
                  ? 'Vídeo demonstrativo para navegação pelo Celular'
                  : 'Escolha seu dispositivo para assistir ao vídeo passo a passo'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
            aria-label="Fechar Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Loading Spinner */}
        {loadingConfig && !selectedDevice ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground font-semibold">Carregando tutorial...</p>
          </div>
        ) : null}

        {/* Device Selection View */}
        {!selectedDevice && !loadingConfig && (
          <div className="space-y-6 py-2">
            <p className="text-sm font-medium text-foreground text-center">
              Como você está acessando a Osanchez Barbearia agora?
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option 1: Computador */}
              <button
                type="button"
                onClick={() => setSelectedDevice('desktop')}
                className="group glass p-6 rounded-xl border border-border hover:border-primary/60 hover:bg-primary/5 text-left transition-all duration-200 cursor-pointer flex flex-col items-center text-center space-y-3 shadow-md hover:shadow-xl hover:shadow-primary/10"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center transition-transform group-hover:scale-110">
                  <Monitor className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                    Estou no Computador
                  </h3>
                  <p className="text-xs text-muted-foreground pt-1 leading-relaxed">
                    Assista ao tutorial otimizado para telas grandes e navegadores de desktop
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary pt-2 uppercase tracking-wider">
                  Assistir no PC <Play className="w-3 h-3 fill-primary" />
                </span>
              </button>

              {/* Option 2: Celular */}
              <button
                type="button"
                onClick={() => setSelectedDevice('mobile')}
                className="group glass p-6 rounded-xl border border-border hover:border-primary/60 hover:bg-primary/5 text-left transition-all duration-200 cursor-pointer flex flex-col items-center text-center space-y-3 shadow-md hover:shadow-xl hover:shadow-primary/10"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center transition-transform group-hover:scale-110">
                  <Smartphone className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                    Estou no Celular
                  </h3>
                  <p className="text-xs text-muted-foreground pt-1 leading-relaxed">
                    Assista ao tutorial formato mobile com o passo a passo para smartphones
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary pt-2 uppercase tracking-wider">
                  Assistir no Celular <Play className="w-3 h-3 fill-primary" />
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Video Player / Fallback View */}
        {selectedDevice && (
          <div className="space-y-4">
            {embedUrl ? (
              <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-2xl border border-primary/30 bg-black">
                <iframe
                  src={embedUrl}
                  title={`Tutorial Osanchez - ${selectedDevice === 'desktop' ? 'Computador' : 'Celular'}`}
                  className="absolute inset-0 w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ) : (
              /* Friendly Empty State Fallback */
              <div className="p-8 bg-secondary/30 rounded-xl border border-border text-center space-y-4 shadow-inner">
                <div className="w-14 h-14 rounded-full bg-primary/15 text-primary flex items-center justify-center mx-auto border border-primary/25">
                  <Sparkles className="w-7 h-7" />
                </div>
                <div className="space-y-1.5 max-w-md mx-auto">
                  <h3 className="font-serif font-bold text-lg text-foreground">Tutorial em breve! 🎬</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Estamos preparando o vídeo explicativo em alta definição para esta versão. Enquanto isso, nossa equipe está pronta para te atender no WhatsApp!
                  </p>
                </div>

                <div className="pt-2">
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-lg transition-all cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Falar Conosco no WhatsApp</span>
                  </a>
                </div>
              </div>
            )}

            {/* Bottom Footer Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
              <button
                type="button"
                onClick={() => setSelectedDevice(null)}
                className="text-muted-foreground hover:text-foreground font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Trocar Dispositivo
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-secondary hover:bg-muted text-foreground border border-border font-bold rounded-lg text-xs transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
