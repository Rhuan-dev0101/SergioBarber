import Image from 'next/image'
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
import { TestimonialsSection } from '@/components/TestimonialsSection'
import { EmbeddedTutorialSection } from '@/components/EmbeddedTutorialSection'
import { getBusinessSettings, formatPhoneNumber, formatWhatsAppLink, getGoogleMapsEmbedUrl } from '@/lib/settings'

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

  const packageCorteWaMessage = "Olá! Tenho interesse no Pacote Mensal de Corte (4 cortes por R$150/mês). Gostaria de saber mais e agendar meu horário fixo!"
  const packageCorteWaUrl = formatWhatsAppLink(rawWhatsapp, packageCorteWaMessage)

  const packageComboWaMessage = "Olá! Tenho interesse no Pacote Mensal Cabelo + Barba (4 atendimentos completos por R$250/mês). Gostaria de saber mais e agendar meu horário fixo!"
  const packageComboWaUrl = formatWhatsAppLink(rawWhatsapp, packageComboWaMessage)

  let services = FALLBACK_SERVICES
  let barbers = FALLBACK_BARBERS
  let gallery = FALLBACK_GALLERY
  let approvedTestimonials: any[] = []
  const ratingsMap: Record<string, { avg: number; count: number }> = {}

  try {
    const supabase = await createServerSupabaseClient()

    // Fetch approved reviews for public testimonials & barber average rating calculation
    const { data: dbReviews } = await supabase
      .from('reviews')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })

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

      const customerIds = Array.from(new Set(dbReviews.map(r => r.customer_id)))
      const { data: customerProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', customerIds)

      const customerMap = (customerProfiles || []).reduce((acc: any, c: any) => {
        acc[c.id] = c.full_name
        return acc
      }, {})

      const barberIds = Array.from(new Set(dbReviews.map(r => r.barber_id)))
      const { data: barberProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', barberIds)

      const barberMap = (barberProfiles || []).reduce((acc: any, b: any) => {
        acc[b.id] = b.full_name
        return acc
      }, {})

      approvedTestimonials = dbReviews.map(r => ({
        id: r.id,
        customerName: customerMap[r.customer_id] || 'Cliente',
        barberName: barberMap[r.barber_id] || 'Barbeiro',
        rating: r.rating,
        comment: r.comment || '',
        createdAt: r.created_at
      }))
    }

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
        <section className="relative overflow-hidden py-24 sm:py-32">
          <Image fill priority sizes="100vw"
            src="/barbearia-ambiente.jpg"
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-[center_38%]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/75 to-background" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/30 to-background/80" />
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
              
              <HeroActions whatsappUrl={whatsappUrl} />
            </div>

            {/* Embedded Tutorial Section directly on Home Page */}
            <EmbeddedTutorialSection 
              initialDesktopUrl={(settings as any)?.tutorial_video_desktop_url}
              initialMobileUrl={(settings as any)?.tutorial_video_mobile_url}
            />
          </div>
        </section>

        {/* ── Dedicated Pacotes Mensais VIP Section ────────────────── */}
        <section className="py-16 bg-gradient-to-r from-primary/10 via-background to-primary/5 border-y border-primary/25 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative space-y-10">
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
                <Crown className="w-3.5 h-3.5" />
                Planos Mensais VIP — Economia Garantida
              </div>
              <h2 className="text-3xl sm:text-4xl font-serif font-bold text-foreground">
                Pacotes Promocionais Mensais
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Garanta seu dia e horário fixo toda semana. Sem precisar agendar toda vez, com descontos exclusivos todos os meses!
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {/* Package 1: Corte de Cabelo (R$ 150/mês) */}
              <div className="animated-gradient-card p-6 sm:p-8 rounded-2xl border border-primary/30 flex flex-col justify-between space-y-6 shadow-2xl relative overflow-hidden group">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                        <Scissors className="w-5 h-5 text-primary rotate-45" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest block">Plano Mensal ✂️</span>
                        <h3 className="font-serif font-bold text-xl text-foreground leading-tight">4 Cortes de Cabelo</h3>
                      </div>
                    </div>
                    <span className="shrink-0 text-[9px] font-bold text-primary-foreground bg-primary px-3 py-1 rounded-full uppercase tracking-widest shadow-md">
                      Economize R$ 50
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    1 corte por semana no seu dia e horário preferido. Fique com o visual impecável o mês inteiro.
                  </p>

                  <div className="bg-background/60 border border-primary/20 rounded-xl p-4 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Preço Promocional</span>
                    <div className="flex items-baseline gap-2.5 flex-wrap">
                      <span className="text-3xl font-serif font-bold text-primary">R$ 150<span className="text-xs font-normal text-muted-foreground">/mês</span></span>
                      <span className="text-sm text-muted-foreground line-through decoration-2">R$ 200</span>
                      <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase">
                        R$ 37,50 por corte
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-primary/15 border border-primary/30 p-2.5 rounded-xl text-primary text-[11px] font-extrabold uppercase tracking-wider">
                    <CreditCard className="w-4 h-4 shrink-0 text-primary" />
                    <span>Pagamento realizado SOMENTE no 1º corte</span>
                  </div>

                  <ul className="space-y-2 text-xs text-muted-foreground pt-1">
                    <li className="flex items-center gap-2 font-semibold text-foreground">
                      <CreditCard className="w-4 h-4 text-primary shrink-0" />
                      <span>Pagamento integral efetuado no 1º atendimento</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary shrink-0" />
                      <span>Horário fixo garantido pelas 4 semanas</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary shrink-0" />
                      <span>Sem necessidade de agendar toda semana</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary shrink-0" />
                      <span>Prioridade de horário na agenda</span>
                    </li>
                  </ul>
                </div>

                <a
                  href={packageCorteWaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full px-5 py-3.5 bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Garantir Pacote Corte (R$ 150)</span>
                </a>
              </div>

              {/* Package 2: Cabelo + Barba (R$ 250/mês) */}
              <div className="animated-gradient-card p-6 sm:p-8 rounded-2xl border border-primary/40 flex flex-col justify-between space-y-6 shadow-2xl relative overflow-hidden group">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                        <Sparkles className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest block">Plano Mensal VIP 🪒</span>
                        <h3 className="font-serif font-bold text-xl text-foreground leading-tight">4 Cabelo + Barba</h3>
                      </div>
                    </div>
                    <span className="shrink-0 text-[9px] font-bold text-primary-foreground bg-primary px-3 py-1 rounded-full uppercase tracking-widest shadow-md">
                      Economize R$ 90
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    4 atendimentos completos por mês (Cabelo + Barba com toalha quente e acabamento navalhado).
                  </p>

                  <div className="bg-background/60 border border-primary/20 rounded-xl p-4 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Preço Promocional</span>
                    <div className="flex items-baseline gap-2.5 flex-wrap">
                      <span className="text-3xl font-serif font-bold text-primary">R$ 250<span className="text-xs font-normal text-muted-foreground">/mês</span></span>
                      <span className="text-sm text-muted-foreground line-through decoration-2">R$ 340</span>
                      <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase">
                        R$ 62,50 por combo
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-primary/15 border border-primary/30 p-2.5 rounded-xl text-primary text-[11px] font-extrabold uppercase tracking-wider">
                    <CreditCard className="w-4 h-4 shrink-0 text-primary" />
                    <span>Pagamento realizado SOMENTE no 1º atendimento</span>
                  </div>

                  <ul className="space-y-2 text-xs text-muted-foreground pt-1">
                    <li className="flex items-center gap-2 font-semibold text-foreground">
                      <CreditCard className="w-4 h-4 text-primary shrink-0" />
                      <span>Pagamento integral efetuado no 1º atendimento</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary shrink-0" />
                      <span>Cabelo + Barba completo toda semana</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary shrink-0" />
                      <span>Toalha quente e terapias inclusas</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary shrink-0" />
                      <span>Horário VIP fixo sem burocracia</span>
                    </li>
                  </ul>
                </div>

                <a
                  href={packageComboWaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full px-5 py-3.5 bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Garantir Pacote Cabelo + Barba (R$ 250)</span>
                </a>
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

            <BarbersSection initialBarbers={barbers} ratingsMap={ratingsMap} />
          </div>
        </section>

        {/* Testimonials Section */}
        <TestimonialsSection testimonials={approvedTestimonials} />

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
                  <Image fill sizes="(max-width: 768px) 50vw, 25vw" 
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
                Localizada no coração de Guarulhos, a Osanchez Barbearia oferece um espaço aconchegante e climatizado para você relaxar enquanto aguarda seu horário.
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

            <div className="aspect-video w-full bg-secondary/50 rounded-lg border border-border relative overflow-hidden">
              <iframe
                src={getGoogleMapsEmbedUrl()}
                title="Localização da Osanchez Barbearia no Google Maps"
                className="absolute inset-0 w-full h-full border-0 grayscale-[30%] contrast-[1.1]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <Link
                href="/localizacao"
                className="absolute bottom-3 right-3 px-4 py-2 bg-secondary/95 backdrop-blur border border-border text-foreground hover:bg-muted text-xs font-semibold rounded-md transition-all shadow-md"
              >
                Como Chegar
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer initialSettings={settings || undefined} />
    </div>
  )
}
