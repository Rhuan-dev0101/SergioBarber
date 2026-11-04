'use client'

import React, { useState } from 'react'
import { Star, Quote, ChevronLeft, ChevronRight, Scissors, Sparkles } from 'lucide-react'

export interface Testimonial {
  id: string
  customerName: string
  barberName: string
  rating: number
  comment: string
  createdAt?: string
}

interface TestimonialsSectionProps {
  testimonials: Testimonial[]
}

export function TestimonialsSection({ testimonials }: TestimonialsSectionProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  // Filter out empty comments if desired, or keep all approved reviews with comments
  const validTestimonials = testimonials.filter(t => t.comment && t.comment.trim().length > 0)

  if (validTestimonials.length === 0) {
    return null
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % validTestimonials.length)
  }

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + validTestimonials.length) % validTestimonials.length)
  }

  // Get customer first name or initial
  const getFirstName = (fullName: string) => {
    if (!fullName) return 'Cliente'
    const parts = fullName.trim().split(' ')
    if (parts.length > 1) {
      return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`
    }
    return parts[0]
  }

  return (
    <section className="py-20 relative overflow-hidden bg-gradient-to-b from-background via-secondary/20 to-background border-t border-border/40">
      {/* Subtle background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-12">
        
        {/* Section Header */}
        <div className="text-center space-y-4 max-w-xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Depoimentos Reais
          </div>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-foreground">
            O Que Nossos Clientes Dizem
          </h2>
          <div className="h-0.5 w-16 bg-primary mx-auto" />
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Avaliações verificadas de clientes que vivenciaram o atendimento premium na Osanchez.
          </p>
        </div>

        {/* Carousel / Grid Container */}
        <div className="max-w-4xl mx-auto relative">
          
          {/* Main active testimonial card */}
          <div className="shimmer-border-card p-8 sm:p-10 rounded-2xl relative flex flex-col justify-between gap-6 shadow-2xl transition-all duration-300">
            
            <Quote className="w-12 h-12 text-primary/20 absolute top-6 right-6 pointer-events-none" />

            {/* Rating Stars */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-5 h-5 ${
                      validTestimonials[currentIndex].rating >= star
                        ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]'
                        : 'text-muted-foreground/30'
                    }`}
                  />
                ))}
                <span className="text-xs font-bold text-amber-400 ml-1">
                  {validTestimonials[currentIndex].rating}.0
                </span>
              </div>

              {/* Comment text */}
              <p className="font-serif italic text-base sm:text-lg text-foreground leading-relaxed">
                &quot;{validTestimonials[currentIndex].comment}&quot;
              </p>
            </div>

            {/* Author info */}
            <div className="pt-4 border-t border-border/40 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary/30 to-primary/10 border border-primary/40 flex items-center justify-center font-serif font-bold text-primary text-sm shadow-inner">
                  {getFirstName(validTestimonials[currentIndex].customerName).charAt(0)}
                </div>
                <div>
                  <h4 className="font-serif font-bold text-sm text-foreground">
                    {getFirstName(validTestimonials[currentIndex].customerName)}
                  </h4>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Scissors className="w-3 h-3 text-primary" />
                    Atendido por <span className="text-foreground font-semibold">{validTestimonials[currentIndex].barberName}</span>
                  </p>
                </div>
              </div>

              {/* Pagination controls if more than 1 */}
              {validTestimonials.length > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrev}
                    aria-label="Depoimento anterior"
                    className="p-2 rounded-full bg-secondary hover:bg-muted border border-border text-foreground transition-all hover:scale-105 active:scale-95"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-muted-foreground font-mono">
                    {currentIndex + 1} / {validTestimonials.length}
                  </span>
                  <button
                    onClick={handleNext}
                    aria-label="Próximo depoimento"
                    className="p-2 rounded-full bg-secondary hover:bg-muted border border-border text-foreground transition-all hover:scale-105 active:scale-95"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* Dots Indicator */}
          {validTestimonials.length > 1 && (
            <div className="flex items-center justify-center gap-2 pt-6">
              {validTestimonials.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    currentIndex === idx
                      ? 'w-6 bg-primary'
                      : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/60'
                  }`}
                  aria-label={`Ir para depoimento ${idx + 1}`}
                />
              ))}
            </div>
          )}

        </div>

      </div>
    </section>
  )
}
