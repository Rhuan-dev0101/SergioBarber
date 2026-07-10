"use client"

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Check, ChevronDown, ChevronUp, User, Clock, Star, Calendar } from 'lucide-react'
import { GradientButton } from '@/components/ui/gradient-button'

interface Barber {
  id?: string
  full_name: string
  bio: string
  avatar_url: string
}

interface BarbersSectionProps {
  initialBarbers: Barber[]
}

const BARBER_RICH_DETAILS: Record<string, {
  history: string
  experience: string
  specialties: string
  beforeImg: string
  afterImg: string
}> = {
  'Sergio Sanchez': {
    history: 'Iniciou sua trajetória nas barbearias clássicas de Londres, trazendo para o Brasil o refinamento do visagismo italiano de alta performance.',
    experience: '12 anos esculpindo detalhes',
    specialties: 'Visagismo Facial sob medida, Cortes Clássicos Executivos, Barba Terapia Premium.',
    beforeImg: 'https://images.unsplash.com/photo-1590086782957-93c06ef217b4?auto=format&fit=crop&w=300&q=80',
    afterImg: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80'
  },
  'Kauan Soares': {
    history: 'Mestre em tendências contemporâneas urbanas. Especializou-se em técnicas americanas de degradê de alta definição e pigmentações capilares.',
    experience: '6 anos inovando no estilo',
    specialties: 'High Fade (Degradê Americano), Freestyle Artístico, Platinados e Química Capilar.',
    beforeImg: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
    afterImg: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=300&q=80'
  }
}

export function BarbersSection({ initialBarbers }: BarbersSectionProps) {
  const [activeBarberId, setActiveBarberId] = useState<string | null>(null)

  // Listen to escape key to collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveBarberId(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleToggleExpand = (id: string) => {
    setActiveBarberId(activeBarberId === id ? null : id)
  }

  const handleKeyDownCard = (e: React.KeyboardEvent, id: string) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      handleToggleExpand(id)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
      {initialBarbers.map((barber) => {
        const id = barber.id || barber.full_name
        const isActive = activeBarberId === id
        
        // Grab rich details or fall back to default Sergio data format
        const rich = BARBER_RICH_DETAILS[barber.full_name] || BARBER_RICH_DETAILS['Sergio Sanchez']

        return (
          <div
            key={id}
            role="button"
            tabIndex={0}
            onClick={() => handleToggleExpand(id)}
            onKeyDown={(e) => handleKeyDownCard(e, id)}
            aria-expanded={isActive}
            aria-label={`Perfil de ${barber.full_name}. Pressione Enter para ver história.`}
            className={`shimmer-border-card p-8 rounded-lg flex flex-col items-center md:items-start text-left focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer select-none transition-all duration-300 group ${
              isActive ? 'active' : ''
            }`}
          >
            {/* Header Area */}
            <div className="flex flex-col md:flex-row items-center gap-6 w-full">
              <div className="w-24 h-24 rounded-full border-2 border-primary/45 p-0.5 shrink-0 overflow-hidden relative transition-all duration-300">
                {barber.avatar_url ? (
                  <Image 
                    src={barber.avatar_url} 
                    alt={barber.full_name} 
                    width={96}
                    height={96}
                    className="w-full h-full object-cover rounded-full transition-transform duration-500 ease-out group-hover:scale-105" 
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-gradient-to-tr from-secondary to-muted flex items-center justify-center text-primary text-2xl font-serif font-bold">
                    {barber.full_name.charAt(0)}
                  </div>
                )}
              </div>
              
              <div className="space-y-3 text-center md:text-left flex-grow">
                <div>
                  <h3 className="font-serif font-bold text-xl text-foreground">{barber.full_name}</h3>
                  <span className="text-[10px] uppercase font-semibold text-primary tracking-wider">
                    {barber.full_name.includes('Sergio') ? 'Fundador & Master' : 'Barbeiro Especialista'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{barber.bio}</p>
                
                <div className="flex flex-wrap justify-center md:justify-start gap-2 pt-1 text-[10px] text-muted-foreground">
                  <span className="bg-background/80 px-2.5 py-1 rounded border border-border flex items-center gap-1">
                    <Check className="w-3 h-3 text-primary" /> Navalha Afiada
                  </span>
                  <span className="bg-background/80 px-2.5 py-1 rounded border border-border flex items-center gap-1">
                    <Check className="w-3 h-3 text-primary" /> Visagismo
                  </span>
                </div>
              </div>
            </div>

            {/* Toggle Affordance */}
            <div className="w-full mt-4 pt-3 border-t border-border/20 flex items-center justify-between text-[11px] text-primary/80 hover:text-primary font-bold transition-all">
              <span>{isActive ? 'Recolher Perfil' : 'Ver História & Detalhes'}</span>
              {isActive ? <ChevronUp className="w-4 h-4 animate-bounce" /> : <ChevronDown className="w-4 h-4" />}
            </div>

            {/* Expandable History Detail Panel */}
            <div 
              className={`w-full grid transition-all duration-500 ease-in-out ${
                isActive ? 'grid-rows-[1fr] opacity-100 mt-6 pt-6 border-t border-border/40' : 'grid-rows-[0fr] opacity-0 h-0 overflow-hidden'
              }`}
            >
              <div className="overflow-hidden space-y-5">
                <div className="space-y-2">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-primary">Sobre o Mestre</span>
                  <p className="font-serif italic text-muted-foreground text-xs leading-relaxed">
                    "{rich.history}"
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-muted-foreground">
                  <div className="space-y-1">
                    <strong className="text-foreground font-semibold">Experiência:</strong>
                    <p className="text-[11px]">{rich.experience}</p>
                  </div>
                  <div className="space-y-1">
                    <strong className="text-foreground font-semibold">Especialidades:</strong>
                    <p className="text-[11px]">{rich.specialties}</p>
                  </div>
                </div>

                {/* Before/After Highlights */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-primary">Destaque de Transformação</span>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-muted-foreground block mb-1">Antes</span>
                      <div className="relative h-24 w-full rounded border border-border overflow-hidden">
                        <img src={rich.beforeImg} alt="Antes do corte" className="w-full h-full object-cover filter grayscale" />
                      </div>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-primary block mb-1">Resultado</span>
                      <div className="relative h-24 w-full rounded border border-primary/30 overflow-hidden">
                        <img src={rich.afterImg} alt="Depois do corte" className="w-full h-full object-cover" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Direct CTA */}
                <div className="pt-4 flex justify-end">
                  <GradientButton asChild className="text-xs px-5 py-2.5 h-9 min-w-[120px]">
                    <Link href={`/cliente/agendar?barberId=${barber.id}`}>
                      Agendar com {barber.full_name.split(' ')[0]}
                    </Link>
                  </GradientButton>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
