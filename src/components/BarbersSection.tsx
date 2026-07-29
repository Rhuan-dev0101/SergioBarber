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
  about_quote?: string | null
  experience_years?: number | null
  specialties?: string[] | null
  photo_url?: string | null
  ratingStats?: { avg: number; count: number }
}

interface BarbersSectionProps {
  initialBarbers: Barber[]
  ratingsMap?: Record<string, { avg: number; count: number }>
}

const BARBER_RICH_DETAILS: Record<string, {
  history: string
  experience: string
  specialties: string
}> = {
  'Sergio Sanchez': {
    history: 'Iniciou sua trajetória nas barbearias clássicas de Londres, trazendo para o Brasil o refinamento do visagismo italiano de alta performance.',
    experience: '12 anos esculpindo detalhes',
    specialties: 'Visagismo Facial sob medida, Cortes Clássicos Executivos, Barba Terapia Premium.'
  }
}

export function BarbersSection({ initialBarbers, ratingsMap }: BarbersSectionProps) {
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
        
        // Grab rating stats from prop or barber object
        const rating = barber.ratingStats || (barber.id && ratingsMap ? ratingsMap[barber.id] : undefined)

        // Grab rich details or fall back to generic data
        const rich = BARBER_RICH_DETAILS[barber.full_name] || {
          history: 'Profissional dedicado da equipe Osanchez, focado em oferecer a melhor experiência e estilo para cada cliente.',
          experience: 'Profissional da equipe',
          specialties: 'Corte Clássico, Degradê, Barba'
        }

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
                {(barber.photo_url || barber.avatar_url) ? (
                  <Image 
                    src={barber.photo_url || barber.avatar_url} 
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
              
              <div className="space-y-2 text-center md:text-left flex-grow">
                <div>
                  <h3 className="font-serif font-bold text-xl text-foreground flex flex-wrap items-center justify-center md:justify-start gap-2">
                    <span>{barber.full_name}</span>
                    
                    {/* Star Rating Badge: Shows real average or 0.0 if no approved reviews yet */}
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{rating && rating.count > 0 ? rating.avg.toFixed(1) : '0.0'}</span>
                      <span className="text-[10px] text-muted-foreground font-normal">
                        ({rating?.count || 0} {rating?.count === 1 ? 'avaliação' : 'avaliações'})
                      </span>
                    </span>
                  </h3>
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
                    "{barber.about_quote || rich.history}"
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-muted-foreground">
                  <div className="space-y-1">
                    <strong className="text-foreground font-semibold">Experiência:</strong>
                    <p className="text-[11px]">
                      {barber.experience_years !== undefined && barber.experience_years !== null
                        ? `${barber.experience_years} anos no estilo`
                        : rich.experience}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <strong className="text-foreground font-semibold">Especialidades:</strong>
                    <p className="text-[11px]">
                      {barber.specialties && barber.specialties.length > 0
                        ? barber.specialties.join(', ')
                        : rich.specialties}
                    </p>
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
