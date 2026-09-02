'use client'

import React from 'react'
import Link from 'next/link'
import { Calendar, ChevronRight, Phone } from 'lucide-react'
import { GradientButton } from '@/components/ui/gradient-button'

interface HeroActionsProps {
  whatsappUrl: string
}

export function HeroActions({ whatsappUrl }: HeroActionsProps) {
  return (
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
    </div>
  )
}
