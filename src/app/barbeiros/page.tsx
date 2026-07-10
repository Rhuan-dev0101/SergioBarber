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

const SEED_BARBERS = [
  {
    id: 'sergio-uuid',
    name: 'Sergio Sanchez',
    role: 'Fundador & Barbeiro Master',
    bio: 'Mais de 10 anos de experiência lapidando visuais clássicos e modernos. Sergio é especialista em visagismo facial, garantindo que cada corte seja planejado de acordo com o formato e estrutura óssea do rosto do cliente.',
    skills: ['Cortes Clássicos', 'Visagismo Facial', 'Barba Terapia', 'Penteados Sociais'],
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 'kauan-uuid',
    name: 'Kauan Soares',
    role: 'Barbeiro Especialista & Designer',
    bio: 'Kauan é focado em tendências urbanas contemporâneas. Especialista em técnicas de degradê (Fade), pigmentação, freestyle (riscos personalizados) e platinados, ele traz inovação e detalhes marcantes para o seu corte.',
    skills: ['Low/Mid/High Fade', 'Freestyle / Desenhos', 'Platinados e Mechas', 'Alinhamento de Barba'],
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80'
  }
]

export default async function Barbeiros() {
  const settings = await getBusinessSettings()
  let barbers = SEED_BARBERS

  try {
    const supabase = await createServerSupabaseClient()
    const { data: dbBarbers } = await supabase
      .from('profiles')
      .select('id, full_name, role, barbers(bio, avatar_url, is_active, about_quote, experience_years, specialties, photo_url)')
      .eq('role', 'barber')

    if (dbBarbers && dbBarbers.length > 0) {
      const activeBarbers = dbBarbers
        .filter(b => b.barbers && (b.barbers as any).is_active)
        .map(b => ({
          id: b.id,
          name: b.full_name,
          role: b.role === 'admin' ? 'Fundador & Barbeiro Master' : 'Barbeiro Especialista',
          bio: (b.barbers as any).bio || 'Barbeiro professional da equipe Osanchez.',
          skills: (b.barbers as any).specialties && (b.barbers as any).specialties.length > 0
            ? (b.barbers as any).specialties
            : (b.full_name.includes('Sergio') ? ['Cortes Clássicos', 'Visagismo Facial', 'Barba Terapia'] : ['Fade / Degradê', 'Química e Selante', 'Desenhos Freestyle']),
          avatar_url: (b.barbers as any).photo_url || (b.barbers as any).avatar_url || (b.full_name.includes('Sergio') ? '/barbers/sergio.jpg' : b.full_name.includes('Kauan') ? '/barbers/kauan.jpg' : '')
        }))
      if (activeBarbers.length > 0) {
        barbers = activeBarbers
      }
    }
  } catch (error) {
    console.error('Error fetching barbers page details, using fallbacks:', error)
  }

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
                      <h2 className="text-2xl font-serif font-bold text-foreground">{barber.name}</h2>
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
      </main>

      <Footer initialSettings={settings || undefined} />
    </div>
  )
}
