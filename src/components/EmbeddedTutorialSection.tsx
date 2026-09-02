'use client'

import React, { useState } from 'react'
import { Smartphone, Play, Sparkles, PlusSquare, Share2, CheckCircle2 } from 'lucide-react'

interface EmbeddedTutorialSectionProps {
  initialDesktopUrl?: string | null
  initialMobileUrl?: string | null
}

export function getYouTubeEmbedUrl(url: string | null | undefined): string | null {
  if (!url || !url.trim()) return null
  const trimmed = url.trim()

  if (trimmed.includes('youtube.com/embed/')) {
    return trimmed.includes('?') ? trimmed : `${trimmed}?rel=0`
  }

  // Match 11-character video ID from watch, shorts, embed, youtu.be, or direct ID
  const match = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (match && match[1]) {
    return `https://www.youtube.com/embed/${match[1]}?rel=0`
  }

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return `https://www.youtube.com/embed/${trimmed}?rel=0`
  }

  return null
}

export function EmbeddedTutorialSection({
  initialDesktopUrl,
  initialMobileUrl
}: EmbeddedTutorialSectionProps) {
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile')

  const activeRawUrl = device === 'mobile' ? initialMobileUrl : initialDesktopUrl
  const embedUrl = getYouTubeEmbedUrl(activeRawUrl)

  return (
    <div id="tutorial-section" className="mt-14 max-w-4xl mx-auto px-2 sm:px-4">
      <div className="glass p-6 sm:p-8 rounded-3xl border border-primary/30 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        {/* Section Title & Subtitle */}
        <div className="text-center space-y-2 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 text-primary text-[11px] font-extrabold uppercase tracking-wider border border-primary/25">
            <Sparkles className="w-3.5 h-3.5" />
            Tutorial Prático
          </div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-foreground">
            Como Fixar o Site na Tela Inicial do Seu Celular 📱
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Assista ao vídeo e veja como colocar o atalho da <strong className="text-foreground">Osanchez Barbearia</strong> direto na sua tela inicial para agendar com apenas 1 clique.
          </p>
        </div>

        {/* Device selector toggle */}
        <div className="flex justify-center relative z-10">
          <div className="inline-flex p-1 bg-secondary/60 border border-border/80 rounded-xl gap-1 shadow-inner">
            <button
              type="button"
              onClick={() => setDevice('mobile')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                device === 'mobile'
                  ? 'bg-primary text-primary-foreground shadow-md scale-[1.02]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>No Android</span>
            </button>

            <button
              type="button"
              onClick={() => setDevice('desktop')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                device === 'desktop'
                  ? 'bg-primary text-primary-foreground shadow-md scale-[1.02]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>No iPhone</span>
            </button>
          </div>
        </div>

        {/* Video Player or Placeholder */}
        <div className="relative z-10">
          {embedUrl ? (
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-primary/30 shadow-2xl bg-black">
              <iframe
                src={embedUrl}
                title={`Tutorial Osanchez - ${device === 'mobile' ? 'Android' : 'iPhone'}`}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="relative w-full aspect-video rounded-2xl border border-primary/30 bg-gradient-to-b from-secondary/50 to-background/90 p-6 sm:p-10 flex flex-col items-center justify-center text-center space-y-4 shadow-xl">
              <div className="w-14 h-14 rounded-full bg-primary/20 border border-primary/40 text-primary flex items-center justify-center shadow-lg">
                <Play className="w-7 h-7 fill-primary ml-0.5" />
              </div>
              <div className="space-y-1 max-w-md">
                <h3 className="font-serif font-bold text-base sm:text-lg text-foreground">
                  Vídeo do Tutorial em Breve! 🎬
                </h3>
                <p className="text-xs text-muted-foreground">
                  O vídeo demonstrando como adicionar o site na tela inicial será exibido aqui assim que o link for adicionado.
                </p>
              </div>

              {/* Quick Guide Step-by-Step Box */}
              <div className="w-full max-w-lg bg-secondary/40 border border-border/60 rounded-xl p-4 text-left text-xs space-y-2 mt-2">
                <span className="font-bold text-primary block text-[11px] uppercase tracking-wider">
                  Passo a passo rápido:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground text-[11px]">
                  <div className="flex items-start gap-1.5">
                    <Share2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <span><strong>iPhone (Safari):</strong> Toque em Compartilhar &gt; &quot;Adicionar à Tela de Início&quot;.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <PlusSquare className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <span><strong>Android (Chrome):</strong> Toque nos 3 pontos &gt; &quot;Adicionar à Tela inicial&quot;.</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
