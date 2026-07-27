'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Calendar, ChevronRight, Phone, Play } from 'lucide-react'
import { GradientButton } from '@/components/ui/gradient-button'
import { TutorialModal } from '@/components/TutorialModal'

interface HeroActionsProps {
  whatsappUrl: string
  initialDesktopUrl?: string | null
  initialMobileUrl?: string | null
  rawWhatsapp?: string | null
}

export function HeroActions({
  whatsappUrl,
  initialDesktopUrl,
  initialMobileUrl,
  rawWhatsapp
}: HeroActionsProps) {
  const [showTutorial, setShowTutorial] = useState(false)

  return (
    <>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-3">
        {/* 1. Primary CTA: Agendar Meu Horário */}
        <GradientButton asChild className="w-full sm:w-auto">
          <Link href="/entrar" className="flex items-center justify-center gap-2 group px-6 py-3">
            <Calendar className="w-5 h-5" />
            <span>Agendar Meu Horário</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </GradientButton>

        {/* 2. Secondary CTA: Falar no WhatsApp */}
        <GradientButton variant="variant" asChild className="w-full sm:w-auto">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-5 py-3"
          >
            <Phone className="w-5 h-5" />
            <span>Falar no WhatsApp</span>
          </a>
        </GradientButton>

        {/* 3. Tertiary CTA: Ver Tutorial */}
        <button
          type="button"
          onClick={() => setShowTutorial(true)}
          className="w-full sm:w-auto px-5 py-3 rounded-xl bg-secondary/80 hover:bg-secondary text-foreground border border-primary/40 hover:border-primary font-bold text-xs flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer shadow-md hover:shadow-lg hover:shadow-primary/10 group"
        >
          <div className="w-6 h-6 rounded-full bg-primary/15 text-primary flex items-center justify-center transition-transform group-hover:scale-110">
            <Play className="w-3 h-3 fill-primary ml-0.5" />
          </div>
          <span>Ver Tutorial</span>
        </button>
      </div>

      {/* Tutorial Modal */}
      <TutorialModal
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
        initialDesktopUrl={initialDesktopUrl}
        initialMobileUrl={initialMobileUrl}
        initialWhatsapp={rawWhatsapp}
      />
    </>
  )
}
