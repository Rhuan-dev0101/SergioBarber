import React from 'react'
export const dynamic = 'force-dynamic'
import Link from 'next/link'
import Image from 'next/image'
import { Award, Star, Check, Scissors, ChevronRight, Clock } from 'lucide-react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { createServerSupabaseClient } from '@/lib/supabase'
import { GradientButton } from '@/components/ui/gradient-button'
import { getBusinessSettings } from '@/lib/settings'
import { TestimonialsSection } from '@/components/TestimonialsSection'

const SEED_BARBERS = [
  {
    id: 'sergio-uuid',
    name: 'Sergio Sanchez',
    role: 'Fundador & Barbeiro Master',
    bio: 'Mais de 10 anos de experiência lapidando visuais clássicos e modernos. Sergio é especialista em visagismo facial, garantindo que cada corte seja planejado de acordo com o formato e estrutura óssea do rosto do cliente.',
    skills: ['Cortes Clássicos', 'Visagismo Facial', 'Barba Terapia', 'Penteados Sociais'],
    avatar_url: '/barbers/sergio.jpg'
  },
  {
    id: 'enzo-uuid',
    name: 'Enzo',
    role: 'Barbeiro Especialista',
    bio: 'Profissional dedicado da equipe Osanchez, especialista em cortes contemporâneos e design de barba.',
    skills: ['Corte Masculino', 'Degradê / Fade', 'Design de Sobrancelha', 'Barba Terapia'],
    avatar_url: ''
  }
]

export default async function Barbeiros() {
  const settingsPromise = getBusinessSettings()
  let barbers = SEED_BARBERS
  let approvedTestimonials: any[] = []
  const ratingsMap: Record<string, { avg: number; count: number }> = {}

  try {
    const supabase = await createServerSupabaseClient()

    // Reviews aprovadas (depoimentos + media por barbeiro) e barbeiros ativos em paralelo.
    const [{ data: dbReviews }, { data: dbBarbers }] = await Promise.all([
      supabase
        .from('reviews')
        .select('id, barber_id, customer_id, rating, comment, created_at')
        .eq('status', 'approved')
        .order('created_at', { ascending: false }),
      supabase
        .from('barbers')
        .select('id, bio, avatar_url, is_active, about_quote, experience_years, specialties, photo_url, profiles(full_name, role)')
        .eq('is_active', true),
    ])

    if (dbReviews && dbReviews.length > 0) {
      const barberStats: Record<string, { total: number; count: number }> = {}
      dbReviews.forEach(r => {
        if (!barberStats[r.barber_id]) {
          barberStats[r.barber_id] = { total: 0, count: 0 }
        }
        barberStats[r.barber_id].total += r.rating
        barberStats[r.barber_id].count += 1
      })

      Object.keys(barberStats).forEach(bId => {
        ratingsMap[bId] = {
          avg: barberStats[bId].total / barberStats[bId].count,
          count: barberStats[bId].count
        }
      })

      const profileIds = Array.from(new Set(dbReviews.flatMap(r => [r.customer_id, r.barber_id])))
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', profileIds)

      const nameMap = (profiles || []).reduce((acc: Record<string, string>, p: any) => {
        acc[p.id] = p.full_name
        return acc
      }, {})

      approvedTestimonials = dbReviews.map(r => ({
        id: r.id,
        customerName: nameMap[r.customer_id] || 'Cliente',
        barberName: nameMap[r.barber_id] || 'Barbeiro',
        rating: r.rating,
        comment: r.comment || '',
        createdAt: r.created_at
      }))
    }

    if (dbBarbers && dbBarbers.length > 0) {
      const activeBarbers = dbBarbers
        .filter(b => b.profiles)
        .map(b => ({
          id: b.id,
          name: (b.profiles as any).full_name,
          role: (b.profiles as any).role === 'admin' ? 'Fundador & Barbeiro Master' : 'Barbeiro Especialista',
          bio: b.bio || 'Barbeiro profissional da equipe Osanchez.',
          skills: b.specialties && b.specialties.length > 0
            ? b.specialties
            : ((b.profiles as any).full_name.includes('Sergio') ? ['Cortes Clássicos', 'Visagismo Facial', 'Barba Terapia'] : ['Fade / Degradê', 'Design de Barba', 'Corte Moderno']),
          avatar_url: b.photo_url || b.avatar_url || ((b.profiles as any).full_name.includes('Sergio') ? '/barbers/sergio.jpg' : '')
        }))
      if (activeBarbers.length > 0) {
        barbers = activeBarbers
      }
    }
  } catch (error) {
    console.error('Error fetching barbers page details, using fallbacks:', error)
  }

  const settings = await settingsPromise

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-grow py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center space-y-4 mb-16">
            <h1 className="text-4xl font-serif font-bold text-foreground">Mestres do Estilo</h1>
            <div className="h-0.5 w-16 bg-primary mx-auto" />
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Nossos profissionais passam por treinamentos recorrentes e utilizam apenas produtos de linha premium para assegurar a sua satisfação.
            </p>
          </div>

          {/* Barbers Grid */}
          <div className="space-y-12 max-w-4xl mx-auto">
            {barbers.map((barber, index) => (
              <div 
                key={index}
                className="shimmer-border-card p-8 flex flex-col md:flex-row items-center md:items-start gap-8 shadow-lg transition-all duration-300 group"
              >
                {/* Avatar Placeholder / Image */}
                <div className="w-32 h-32 rounded-full border-2 border-primary/40 p-0.5 shrink-0 overflow-hidden relative group-hover:border-primary transition-all duration-300 shadow-lg">
                  {barber.avatar_url ? (
                    <Image 
                      src={barber.avatar_url} 
                      alt={barber.name} 
                      width={128}
                      height={128}
                      className="w-full h-full object-cover rounded-full transition-transform duration-500 ease-out group-hover:scale-105" 
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gradient-to-tr from-secondary to-muted flex items-center justify-center text-primary text-4xl font-serif font-bold">
                      {barber.name.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Profile Details */}
                <div className="flex-grow space-y-6 text-center md:text-left">
                  <div className="space-y-2">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                        <h2 className="text-2xl font-serif font-bold text-foreground">{barber.name}</h2>
                        
                        {/* Star Rating Badge: Display real rating or 0.0 for initial state */}
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-bold">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>{ratingsMap[barber.id] && ratingsMap[barber.id].count > 0 ? ratingsMap[barber.id].avg.toFixed(1) : '0.0'}</span>
                          <span className="text-[10px] text-muted-foreground font-normal">
                            ({ratingsMap[barber.id]?.count || 0} {ratingsMap[barber.id]?.count === 1 ? 'avaliação' : 'avaliações'})
                          </span>
                        </span>
                      </div>

                      <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded text-xs font-semibold self-center md:self-start">
                        <Award className="w-3.5 h-3.5" />
                        {barber.role}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                      {barber.bio}
                    </p>
                  </div>

                  {/* Skills tags */}
                  <div className="space-y-3">
                    <h4 className="text-xs uppercase tracking-wider font-semibold text-foreground">Especialidades:</h4>
                    <div className="flex flex-wrap justify-center md:justify-start gap-2">
                      {barber.skills.map((skill, idx) => (
                        <span 
                          key={idx}
                          className="bg-secondary text-foreground text-[10px] font-medium px-3 py-1.5 rounded border border-border flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5 text-primary" />
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-primary" />
                      Disponível de Terça a Sábado
                    </div>
                    <GradientButton asChild>
                      <Link 
                        href={`/entrar?redirectTo=${encodeURIComponent(`/cliente/agendar?barberId=${barber.id}`)}`} 
                        className="flex items-center gap-1.5 text-xs font-bold px-5 py-2.5"
                      >
                        <Scissors className="w-3.5 h-3.5" />
                        Agendar com {barber.name.split(' ')[0]}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </GradientButton>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Approved Testimonials Carousel / Grid */}
        <TestimonialsSection testimonials={approvedTestimonials} />
      </main>

      <Footer initialSettings={settings || undefined} />
    </div>
  )
}
