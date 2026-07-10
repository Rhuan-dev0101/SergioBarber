import React from 'react'
export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { Scissors, Calendar, MapPin, Phone, MessageSquare, Star, Award, Sparkles, Check, ChevronRight } from 'lucide-react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { createServerSupabaseClient } from '@/lib/supabase'
import { GradientButton } from '@/components/ui/gradient-button'
import { BarbersSection } from '@/components/BarbersSection'

// Static fallback seed data in case database is empty or unreachable during build
const FALLBACK_SERVICES = [
  { name: 'Corte', duration: 60, price: 50.00, description: 'Corte clássico ou moderno com acabamento na navalha.' },
  { name: 'Cabelo + Barba', duration: 90, price: 85.00, description: 'Serviço completo de corte e barba com toalha quente.' },
  { name: 'Infantil', duration: 40, price: 50.00, description: 'Corte infantil com paciência e estilo para os pequenos.' },
  { name: 'Barba', duration: 30, price: 45.00, description: 'Alinhamento de barba com terapia de toalha quente.' },
  { name: 'Plano Mensal (4 cortes)', duration: 60, price: 150.00, description: 'Assinatura mensal para manter seu estilo sempre alinhado.' },
  { name: 'Sobrancelha', duration: 15, price: 20.00, description: 'Design de sobrancelha com pinça ou navalha.' },
]

const FALLBACK_BARBERS = [
  { id: 'sergio-uuid', full_name: 'Sergio Sanchez', bio: 'Fundador e barbeiro master com mais de 10 anos de experiência em cortes clássicos e visagismo.', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80' },
  { id: 'kauan-uuid', full_name: 'Kauan Soares', bio: 'Especialista em cortes modernos, freestyle e barba terapia de alta precisão.', avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80' }
]

export default async function Home() {
  let services = FALLBACK_SERVICES
  let barbers = FALLBACK_BARBERS

  try {
    const supabase = await createServerSupabaseClient()
    const { data: dbServices } = await supabase
      .from('services')
      .select('name, duration, price, description')
      .eq('is_active', true)
      .limit(6)
    
    if (dbServices && dbServices.length > 0) {
      services = dbServices.map(s => ({
        name: s.name,
        duration: s.duration,
        price: Number(s.price),
        description: s.description || ''
      }))
    }

    const { data: dbBarbers } = await supabase
      .from('profiles')
      .select('id, full_name, role, barbers(bio, avatar_url, is_active)')
      .eq('role', 'barber')

    if (dbBarbers && dbBarbers.length > 0) {
      const activeBarbers = dbBarbers
        .filter(b => b.barbers && (b.barbers as any).is_active)
        .map(b => ({
          id: b.id,
          full_name: b.full_name,
          bio: (b.barbers as any).bio || '',
          avatar_url: (b.barbers as any).avatar_url || ''
        }))
      if (activeBarbers.length > 0) {
        barbers = activeBarbers
      }
    }
  } catch (error) {
    console.error('Error fetching data from Supabase, using fallback seeds:', error)
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-24 sm:py-32 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-secondary/50 via-background to-background">
          <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px]" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="text-center space-y-8 max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                Experiência Premium & Visagismo
              </div>
              <h1 className="text-4xl sm:text-6xl font-serif font-bold tracking-tight text-foreground leading-[1.15]">
                Estilo & Tradição Com Toque <span className="text-primary italic">Premium</span>
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                Na Osanchez, tradição encontra simplicidade. Cada corte é feito com humildade e o capricho de quem trata cada cliente como único — sem excessos, só o essencial bem-feito.
              </p>
              
              <div className="flex items-center justify-center gap-4 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-primary select-none pt-1">
                <span>Humildade</span>
                <span className="text-border/60 font-light">•</span>
                <span>Simplicidade</span>
                <span className="text-border/60 font-light">•</span>
                <span>Capricho</span>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-3">
                <GradientButton asChild>
                  <Link href="/entrar" className="flex items-center gap-2 group">
                    <Calendar className="w-5 h-5" />
                    Agendar Meu Horário
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </GradientButton>
                <GradientButton variant="variant" asChild>
                  <a
                    href="https://wa.me/5511999999999"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <Phone className="w-5 h-5" />
                    Falar no WhatsApp
                  </a>
                </GradientButton>
              </div>
            </div>
          </div>
        </section>


        {/* Barbers Section */}
        <section className="py-20 section-dark-alt border-y border-border/40 transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-4 mb-16">
              <h2 className="text-3xl font-serif font-bold text-foreground">Mestres Barbeiros</h2>
              <div className="h-0.5 w-16 bg-primary mx-auto" />
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Profissionais qualificados prontos para esculpir o seu melhor visual com precisão cirúrgica.
              </p>
            </div>

            <BarbersSection initialBarbers={barbers} />
          </div>
        </section>

        {/* Gallery Preview */}
        <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl font-serif font-bold text-foreground">Nosso Trabalho</h2>
            <div className="h-0.5 w-16 bg-primary mx-auto" />
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Inspire-se com alguns dos cortes e barbas executados no nosso espaço.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { title: 'Degradê Navalhado', category: 'Corte', img: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80' },
              { title: 'Barba Alinhada', category: 'Barba', img: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=600&q=80' },
              { title: 'Corte Social Clássico', category: 'Corte', img: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=600&q=80' },
              { title: 'Corte Moderno Textured', category: 'Corte', img: 'https://images.unsplash.com/photo-1599351431247-f50940f3f89a?auto=format&fit=crop&w=600&q=80' },
            ].map((item, idx) => (
              <div
                key={idx}
                className="relative aspect-square rounded-xl border border-border/85 overflow-hidden group hover:border-primary/50 transition-all duration-500 shadow-xl flex flex-col justify-end p-4"
              >
                <div className="absolute inset-0 z-0">
                  <img 
                    src={item.img} 
                    alt={item.title} 
                    className="w-full h-full object-cover group-hover:scale-110 duration-700 ease-out filter grayscale group-hover:grayscale-0" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
                </div>
                <div className="relative z-10 space-y-1.5 transform translate-y-1.5 group-hover:translate-y-0 transition-transform duration-300">
                  <span className="text-[9px] uppercase bg-primary text-primary-foreground px-2 py-0.5 rounded font-bold w-max block">
                    {item.category}
                  </span>
                  <h4 className="font-serif font-bold text-sm text-white">{item.title}</h4>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              href="/galeria"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              Ver galeria de fotos completa <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* Location Preview / Contact CTA */}
        <section className="py-20 bg-secondary/10 border-t border-border transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-xs uppercase font-semibold text-primary tracking-wider">Visite Nosso Espaço</span>
                <h2 className="text-3xl font-serif font-bold text-foreground">Ambiente Climatizado & Premium</h2>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Localizada no coração de São Paulo, a Osanchez Barbearia oferece vagas de estacionamento exclusivas, 
                café expresso, cerveja artesanal e um espaço aconchegante com mesa de sinuca para você relaxar enquanto aguarda seu horário.
              </p>
              
              <div className="space-y-4 pt-2">
                <div className="flex gap-3">
                  <div className="p-2 rounded bg-primary/10 text-primary h-max shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-foreground">Endereço</h4>
                    <p className="text-xs text-muted-foreground">Rua da Barbearia, 123 - Centro, São Paulo - SP</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="p-2 rounded bg-primary/10 text-primary h-max shrink-0">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-foreground">Contato Direto</h4>
                    <p className="text-xs text-muted-foreground">+55 (11) 99999-9999</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="aspect-video w-full bg-secondary/50 rounded-lg border border-border flex flex-col items-center justify-center p-8 text-center text-muted-foreground relative overflow-hidden">
              <MapPin className="w-12 h-12 text-primary/30 mb-3" />
              <h4 className="font-semibold text-sm text-foreground mb-1">Mapa de Localização</h4>
              <p className="text-xs max-w-xs leading-normal mb-4">Clique no botão abaixo para traçar sua rota no Google Maps.</p>
              <Link 
                href="/localizacao"
                className="px-4 py-2 bg-secondary border border-border text-foreground hover:bg-muted text-xs font-semibold rounded-md transition-all"
              >
                Como Chegar
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
