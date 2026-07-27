import React from 'react'
export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { Scissors, Calendar, MapPin, Phone, MessageSquare, Star, Award, Sparkles, Check, ChevronRight, CreditCard, Wifi, Heart, Crown } from 'lucide-react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { createServerSupabaseClient } from '@/lib/supabase'
import { GradientButton } from '@/components/ui/gradient-button'
import { BarbersSection } from '@/components/BarbersSection'
import { HeroActions } from '@/components/HeroActions'
import { getBusinessSettings, formatPhoneNumber, formatWhatsAppLink } from '@/lib/settings'

// Static fallback seed data in case database is empty or unreachable during build
const FALLBACK_SERVICES = [
  { name: 'Corte', duration: 60, price: 50.00, description: 'Corte clássico ou moderno com acabamento na navalha.' },
  { name: 'Cabelo + Barba', duration: 90, price: 85.00, description: 'Serviço completo de corte e barba com toalha quente.' },
  { name: 'Infantil', duration: 40, price: 50.00, description: 'Corte infantil com paciência e estilo para os pequenos.' },
  { name: 'Barba', duration: 30, price: 45.00, description: 'Alinhamento de barba com terapia de toalha quente.' },
  { name: 'Sobrancelha', duration: 15, price: 20.00, description: 'Design de sobrancelha com pinça ou navalha.' },
]

const FALLBACK_BARBERS = [
  { id: 'sergio-uuid', full_name: 'Sergio Sanchez', bio: 'Fundador e barbeiro master com mais de 10 anos de experiência em cortes clássicos e visagismo.', avatar_url: '/barbers/sergio.jpg' },
  { id: 'enzo-uuid', full_name: 'Enzo', bio: 'Profissional dedicado da equipe Osanchez, especialista em cortes contemporâneos e design de barba.', avatar_url: '' }
]

const FALLBACK_GALLERY = [
  { title: 'Degradê Navalhado', category: 'Corte', img: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80' },
  { title: 'Barba Alinhada', category: 'Barba', img: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=600&q=80' },
  { title: 'Corte Social Clássico', category: 'Corte', img: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=600&q=80' },
  { title: 'Corte Moderno Textured', category: 'Corte', img: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=600&q=80' },
]

export default async function Home() {
  const settings = await getBusinessSettings()
  const rawWhatsapp = settings?.whatsapp || ''
  const address = settings?.address || 'Rua da Barbearia, 123 - Centro, São Paulo - SP'
  const whatsappUrl = formatWhatsAppLink(rawWhatsapp)
  const formattedPhone = formatPhoneNumber(rawWhatsapp)
  const telUrl = rawWhatsapp ? `tel:+${rawWhatsapp.replace(/\D/g, '')}` : '#'

  const packageWaMessage = "Olá! Tenho interesse no Pacote Mensal (4 cortes por R$150). Gostaria de saber mais e agendar meu horário fixo!"
  const packageWaUrl = formatWhatsAppLink(rawWhatsapp, packageWaMessage)

  let services = FALLBACK_SERVICES
  let barbers = FALLBACK_BARBERS
  let gallery = FALLBACK_GALLERY

  try {
    const supabase = await createServerSupabaseClient()
    const { data: dbServices } = await supabase
      .from('services')
      .select('name, duration, price, description')
      .eq('is_active', true)
      .limit(6)
    
    if (dbServices && dbServices.length > 0) {
      const filteredDbServices = dbServices
        .filter(s => {
          const lower = (s.name || '').toLowerCase()
          return !lower.includes('plano') && !lower.includes('pacote')
        })
        .map(s => ({
          name: s.name,
          duration: s.duration,
          price: Number(s.price),
          description: s.description || ''
        }))

      if (filteredDbServices.length > 0) {
        services = filteredDbServices
      }
    }

    const { data: dbBarbers } = await supabase
      .from('barbers')
      .select('id, bio, avatar_url, is_active, about_quote, experience_years, specialties, photo_url, profiles(full_name, role)')
      .eq('is_active', true)

    if (dbBarbers && dbBarbers.length > 0) {
      const activeBarbers = dbBarbers
        .filter(b => b.profiles)
        .map(b => ({
          id: b.id,
          full_name: (b.profiles as any).full_name,
          bio: b.bio || '',
          avatar_url: b.avatar_url || ((b.profiles as any).full_name.includes('Sergio') ? '/barbers/sergio.jpg' : ''),
          about_quote: b.about_quote || null,
          experience_years: b.experience_years || null,
          specialties: b.specialties || null,
          photo_url: b.photo_url || null
        }))
      if (activeBarbers.length > 0) {
        barbers = activeBarbers
      }
    }

    const { data: dbGallery } = await supabase
      .from('gallery_images')
      .select('title, category, url')
      .order('created_at', { ascending: false })
      .limit(4)

    if (dbGallery && dbGallery.length > 0) {
      gallery = dbGallery.map(g => ({
        title: g.title || '',
        category: g.category || 'Corte',
        img: g.url
      }))
    }
  } catch (error) {
    console.error('Error fetching data from Supabase, using fallback seeds:', error)
  }

  return (
    <div className="flex flex-col min-h-screen relative">
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
              
              <HeroActions 
                whatsappUrl={whatsappUrl}
                initialDesktopUrl={(settings as any)?.tutorial_video_desktop_url}
                initialMobileUrl={(settings as any)?.tutorial_video_mobile_url}
                rawWhatsapp={rawWhatsapp}
              />
            </div>
          </div>
        </section>

        {/* ── Dedicated Pacote Mensal Banner Section ────────────────── */}
        <section className="py-14 bg-gradient-to-r from-primary/10 via-background to-primary/5 border-y border-primary/25 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="animated-gradient-card p-8 sm:p-10 rounded-2xl border border-primary/30 max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl">
              <div className="space-y-4 flex-1 text-center md:text-left">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
                  <Crown className="w-3.5 h-3.5" />
                  Destaque da Barbearia
                </div>
                <h2 className="text-2xl sm:text-3xl font-serif font-bold text-foreground">
                  Pacote Mensal — 4 Cortes por Mês
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-xl">
                  Corte toda semana no mesmo dia e horário garantido. Sem precisar agendar toda vez — economize R$ 50 todo mês.
                </p>

                {/* Price anchoring */}
                <div className="flex items-baseline justify-center md:justify-start gap-3 flex-wrap pt-1">
                  <span className="text-3xl sm:text-4xl font-serif font-bold text-primary">R$ 150<span className="text-xs font-normal text-muted-foreground">/mês</span></span>
                  <span className="text-base text-muted-foreground line-through decoration-2">R$ 200</span>
                  <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full uppercase">
                    Economize R$ 50 todo mês
                  </span>
                </div>
              </div>

              <div className="shrink-0 flex flex-col items-center gap-3 w-full md:w-auto">
                <a
                  href={packageWaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full md:w-auto px-6 py-4 bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
                >
                  <MessageSquare className="w-4 h-4" />
                  Garantir Horário no WhatsApp
                </a>
                <span className="text-[10px] text-muted-foreground">Sem necessidade de cadastro prévio</span>
              </div>
            </div>
          </div>
        </section>

        {/* Barbers Section */}
        <section className="py-20 section-dark-alt border-b border-border/40 transition-colors">
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
            {gallery.map((item, idx) => (
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
                Localizada no coração de São Paulo, a Osanchez Barbearia oferece um espaço aconchegante e climatizado para você relaxar enquanto aguarda seu horário.
              </p>

              {/* Amenity Badges */}
              <div className="flex flex-wrap gap-2 pt-1">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/60 border border-border text-xs font-medium text-foreground shadow-sm">
                  <CreditCard className="w-4 h-4 text-primary shrink-0" />
                  <span>Pagamento com Cartão de Crédito</span>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/60 border border-border text-xs font-medium text-foreground shadow-sm">
                  <Wifi className="w-4 h-4 text-primary shrink-0" />
                  <span>Wi-Fi Grátis</span>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/60 border border-border text-xs font-medium text-foreground shadow-sm">
                  <Heart className="w-4 h-4 text-primary shrink-0" />
                  <span>Programa de Fidelidade</span>
                </div>
              </div>
              
              <div className="space-y-4 pt-2">
                <div className="flex gap-3">
                  <div className="p-2 rounded bg-primary/10 text-primary h-max shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-foreground">Endereço</h4>
                    <p className="text-xs text-muted-foreground">{address}</p>
                  </div>
                </div>
                {formattedPhone && (
                  <div className="flex gap-3">
                    <div className="p-2 rounded bg-primary/10 text-primary h-max shrink-0">
                      <Phone className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-foreground">Contato Direto</h4>
                      <a href={telUrl} className="text-xs text-muted-foreground hover:text-primary transition-colors">{formattedPhone}</a>
                    </div>
                  </div>
                )}
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

      {/* ── Persistent Floating Pacote Mensal Bubble (Bottom Right) ── */}
      <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-500">
        <a
          href={packageWaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 bg-card/95 hover:bg-card border border-primary/40 p-3 pr-4 rounded-full shadow-2xl backdrop-blur-md transition-all hover:scale-105 active:scale-95 hover:border-primary cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary relative shrink-0">
            <Scissors className="w-5 h-5 rotate-45" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full" />
          </div>
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold text-primary uppercase tracking-wider">Pacote Mensal</span>
              <span className="text-[8px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.2 rounded font-bold uppercase">-R$50</span>
            </div>
            <span className="text-xs font-serif font-bold text-foreground group-hover:text-primary transition-colors">
              4 cortes por R$ 150/mês
            </span>
          </div>
        </a>
      </div>

      <Footer initialSettings={settings || undefined} />
    </div>
  )
}
