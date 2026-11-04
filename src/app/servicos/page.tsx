import React from 'react'
export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { Scissors, Clock, ChevronRight, Crown, MessageCircle, Check, Sparkles, CreditCard } from 'lucide-react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getBusinessSettings, formatWhatsAppLink } from '@/lib/settings'
import { GradientButton } from '@/components/ui/gradient-button'

const SEED_SERVICES = [
  // Cabelo
  { name: 'Corte', duration: 60, price: 50.00, category: 'Cabelo', description: 'Corte tradicional ou moderno realizado com máquina e tesoura. Finalização premium com lavagem e pomada modeladora.' },
  { name: 'Cabelo + Barba', duration: 90, price: 85.00, category: 'Cabelo & Barba', description: 'O combo supremo: corte detalhado ao seu estilo associado à modelagem de barba completa com vapor e toalhas quentes.' },
  { name: 'Infantil', duration: 40, price: 50.00, category: 'Cabelo', description: 'Corte para crianças de até 10 anos. Atendimento atencioso e descontraído.' },
  // Tratamentos & Química
  { name: 'Progressiva', duration: 120, price: 80.00, category: 'Química', description: 'Redução de volume e alinhamento dos fios capilares com ativos selantes seguros.' },
  { name: 'Luzes', duration: 150, price: 200.00, category: 'Química', description: 'Técnica de clareamento sutil ou mechas intensas de acordo com a tonalidade desejada.' },
  { name: 'Platinado', duration: 180, price: 300.00, category: 'Química', description: 'Descoloração global premium com proteção de couro cabeludo para o tom branco perfeito.' },
  { name: 'Relaxamento', duration: 90, price: 50.00, category: 'Química', description: 'Abertura de cachos ou redução de frizz em cabelos crespos ou ondulados.' },
  // Barba & Outros
  { name: 'Barba', duration: 30, price: 45.00, category: 'Barba', description: 'Desenho e alinhamento de barba com navalha e técnicas clássicas de toalha quente.' },
  { name: 'Sobrancelha', duration: 15, price: 20.00, category: 'Estética', description: 'Design e limpeza de sobrancelhas com pinça ou navalete respeitando as linhas do rosto.' },
  { name: 'Camuflagem', duration: 40, price: 70.00, category: 'Tratamentos', description: 'Coloração discreta de fios brancos do cabelo ou barba para um aspecto mais jovem e natural.' },
  { name: 'Detox', duration: 40, price: 60.00, category: 'Tratamentos', description: 'Esfoliação e limpeza profunda do couro cabeludo contra oleosidade e resíduos.' },
  { name: 'Hidratação', duration: 30, price: 50.00, category: 'Tratamentos', description: 'Reposição hídrica com máscara profissional para cabelos macios e com brilho.' }
]

export default async function Servicos() {
  // Inicia em paralelo com as demais consultas da pagina.
  const settingsPromise = getBusinessSettings()
  let services = SEED_SERVICES.map(s => ({
    id: s.name,
    name: s.name,
    description: s.description,
    category: s.category,
    minPrice: s.price,
    maxPrice: s.price,
    minDuration: s.duration,
    maxDuration: s.duration,
    barberOfferings: [
      { barberName: 'Sergio Sanchez', price: s.price, duration: s.duration }
    ]
  })) as any[]

  try {
    const supabase = await createServerSupabaseClient()
    const { data: dbBarberServices } = await supabase
      .from('barber_services')
      .select('price, duration, is_active, service_id, description, services(id, name, description), barbers(id, profiles(full_name))')
      .eq('is_active', true)
    
    if (dbBarberServices && dbBarberServices.length > 0) {
      const serviceGroups: Record<string, {
        id: string
        name: string
        description: string
        category: string
        barberOfferings: Array<{
          barberName: string
          price: number
          duration: number
          customDescription?: string | null
        }>
      }> = {}

      dbBarberServices.forEach((bs: any) => {
        const s = bs.services
        if (!s) return
        const sNameLower = (s.name || '').toLowerCase()
        // Exclude any package variations from general services list
        if (sNameLower.includes('plano') || sNameLower.includes('pacote')) return

        const barberName = bs.barbers?.profiles?.full_name || 'Profissional'
        const priceNum = Number(bs.price)
        const durationNum = Number(bs.duration)
        const customDesc = (bs.description && bs.description.trim() !== '') ? bs.description.trim() : null
        const effectiveDesc = customDesc || s.description || ''

        if (!serviceGroups[s.name]) {
          let category = 'Geral'
          if (sNameLower.includes('corte') || sNameLower.includes('cabelo') || sNameLower.includes('infantil')) category = 'Cabelo'
          if (sNameLower.includes('barba')) category = 'Barba'
          if (sNameLower.includes('luzes') || sNameLower.includes('progressiva') || sNameLower.includes('platinado')) category = 'Química'
          if (sNameLower.includes('hidrata') || sNameLower.includes('detox') || sNameLower.includes('camuflagem')) category = 'Tratamentos'
          if (sNameLower.includes('sobrancelha')) category = 'Estética'

          serviceGroups[s.name] = {
            id: bs.service_id,
            name: s.name,
            description: effectiveDesc,
            category,
            barberOfferings: []
          }
        } else if (customDesc && !serviceGroups[s.name].description) {
          serviceGroups[s.name].description = customDesc
        }

        serviceGroups[s.name].barberOfferings.push({
          barberName,
          price: priceNum,
          duration: durationNum,
          customDescription: customDesc
        })
      })

      const loadedServices = Object.values(serviceGroups).map((g) => {
        const prices = g.barberOfferings.map(o => o.price)
        const durations = g.barberOfferings.map(o => o.duration)
        const minPrice = Math.min(...prices)
        const maxPrice = Math.max(...prices)
        const minDuration = Math.min(...durations)
        const maxDuration = Math.max(...durations)

        return {
          id: g.id,
          name: g.name,
          description: g.description,
          category: g.category,
          minPrice,
          maxPrice,
          minDuration,
          maxDuration,
          barberOfferings: g.barberOfferings
        }
      })

      if (loadedServices.length > 0) {
        services = loadedServices
      }
    }
  } catch (error) {
    console.error('Error loading services in route page:', error)
  }

  // Filter out any plans/packages from the regular category grid
  services = services.filter(s => {
    const lower = (s.name || '').toLowerCase()
    return !lower.includes('plano') && !lower.includes('pacote') && s.category !== 'Planos'
  })

  // Group services by category
  const categories = ['Cabelo', 'Barba', 'Cabelo & Barba', 'Tratamentos', 'Química', 'Estética', 'Geral']
  const grouped = categories.reduce((acc, cat) => {
    const items = services.filter(s => s.category === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {} as Record<string, any[]>)

  const settings = await settingsPromise

  const waCorteMessage = "Olá! Tenho interesse no Pacote Mensal de Corte (4 cortes por R$150/mês). Gostaria de agendar meu horário fixo!"
  const waCorteUrl = formatWhatsAppLink(settings?.whatsapp, waCorteMessage)

  const waComboMessage = "Olá! Tenho interesse no Pacote Mensal Cabelo + Barba (4 atendimentos completos por R$250/mês). Gostaria de agendar meu horário fixo!"
  const waComboUrl = formatWhatsAppLink(settings?.whatsapp, waComboMessage)

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-grow py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center space-y-4 mb-16">
            <h1 className="text-4xl font-serif font-bold text-foreground">Menu de Serviços</h1>
            <div className="h-0.5 w-16 bg-primary mx-auto" />
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Descubra nossos serviços especializados e viva uma experiência premium.
            </p>
          </div>

          {/* ── Planos Mensais VIP — 2 Promotional Package Cards ────────────────── */}
          <div className="mb-20">
            <div className="text-center space-y-3 mb-10">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-xs font-bold text-primary uppercase tracking-widest">
                <Crown className="w-3.5 h-3.5" />
                Planos Mensais Promocionais
              </div>
              <h2 className="text-3xl font-serif font-bold text-foreground">Pacotes Mensais VIP</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Garanta seu dia e horário fixo toda semana — sem precisar agendar toda vez, com máxima economia!
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {/* Package 1: Corte de Cabelo (R$ 150/mês) */}
              <div className="animated-gradient-card p-8 space-y-6 relative overflow-hidden shadow-2xl rounded-2xl border border-primary/30 flex flex-col justify-between">
                <div className="relative space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                        <Scissors className="w-6 h-6 text-primary rotate-45" />
                      </div>
                      <div>
                        <h3 className="font-serif font-bold text-xl text-foreground leading-tight">Pacote Mensal Corte</h3>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mt-0.5">4 Cortes por Mês ✂️</p>
                      </div>
                    </div>
                    <span className="shrink-0 text-[9px] font-bold text-primary-foreground bg-primary px-3 py-1.5 rounded-full uppercase tracking-widest shadow-md">
                      Economize R$ 50
                    </span>
                  </div>

                  <div className="bg-background/50 border border-primary/25 rounded-xl p-5 space-y-2">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Economia Garantida</p>
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <span className="text-4xl font-serif font-bold text-primary">R$ 150<span className="text-xs font-normal text-muted-foreground">/mês</span></span>
                      <span className="text-lg text-muted-foreground line-through decoration-2">R$ 200</span>
                      <span className="text-[11px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full uppercase tracking-wide">
                        R$ 37,50 por corte
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                      4 cortes avulsos custariam <span className="font-semibold text-foreground">R$ 200</span> (4 × R$ 50) — no pacote, apenas <span className="font-semibold text-primary">R$ 150</span>.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 bg-primary/15 border border-primary/30 p-2.5 rounded-xl text-primary text-[11px] font-extrabold uppercase tracking-wider">
                    <CreditCard className="w-4 h-4 shrink-0 text-primary" />
                    <span>Pagamento efetuado SOMENTE no 1º corte</span>
                  </div>

                  <ul className="space-y-2.5">
                    <li className="flex items-start gap-2.5 text-xs sm:text-sm font-semibold text-foreground">
                      <CreditCard className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>Pagamento realizado integralmente no 1º atendimento</span>
                    </li>
                    {[
                      '1 corte de cabelo por semana',
                      'Horário fixo garantido pelas 4 semanas',
                      'Sem precisar agendar toda semana',
                      'Economia de R$ 50 todo mês',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <a
                  href={waCorteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-primary/20 hover:scale-[1.01] active:scale-[0.99]"
                >
                  <MessageCircle className="w-4 h-4" />
                  Garantir Pacote Corte (R$ 150)
                </a>
              </div>

              {/* Package 2: Cabelo + Barba (R$ 250/mês) */}
              <div className="animated-gradient-card p-8 space-y-6 relative overflow-hidden shadow-2xl rounded-2xl border border-primary/40 flex flex-col justify-between">
                <div className="relative space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                        <Sparkles className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-serif font-bold text-xl text-foreground leading-tight">Pacote Cabelo + Barba</h3>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mt-0.5">4 Atendimentos Completos 🪒</p>
                      </div>
                    </div>
                    <span className="shrink-0 text-[9px] font-bold text-primary-foreground bg-primary px-3 py-1.5 rounded-full uppercase tracking-widest shadow-md">
                      Economize R$ 90
                    </span>
                  </div>

                  <div className="bg-background/50 border border-primary/25 rounded-xl p-5 space-y-2">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Economia Garantida</p>
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <span className="text-4xl font-serif font-bold text-primary">R$ 250<span className="text-xs font-normal text-muted-foreground">/mês</span></span>
                      <span className="text-lg text-muted-foreground line-through decoration-2">R$ 340</span>
                      <span className="text-[11px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full uppercase tracking-wide">
                        R$ 62,50 por combo
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                      4 combos avulsos custariam <span className="font-semibold text-foreground">R$ 340</span> (4 × R$ 85) — no pacote, apenas <span className="font-semibold text-primary">R$ 250</span>.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 bg-primary/15 border border-primary/30 p-2.5 rounded-xl text-primary text-[11px] font-extrabold uppercase tracking-wider">
                    <CreditCard className="w-4 h-4 shrink-0 text-primary" />
                    <span>Pagamento efetuado SOMENTE no 1º atendimento</span>
                  </div>

                  <ul className="space-y-2.5">
                    <li className="flex items-start gap-2.5 text-xs sm:text-sm font-semibold text-foreground">
                      <CreditCard className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>Pagamento realizado integralmente no 1º atendimento</span>
                    </li>
                    {[
                      '1 Cabelo + Barba completo por semana',
                      'Toalha quente e barba alinhada inclusas',
                      'Dia e horário VIP reservado pelas 4 semanas',
                      'Economia gigante de R$ 90 todo mês',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <a
                  href={waComboUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-primary/20 hover:scale-[1.01] active:scale-[0.99]"
                >
                  <MessageCircle className="w-4 h-4" />
                  Garantir Cabelo + Barba (R$ 250)
                </a>
              </div>
            </div>
          </div>

          {/* List by categories */}
          <div className="space-y-16">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category} className="space-y-6">
                <h2 className="text-xl font-serif font-bold text-primary border-b border-border pb-2 tracking-wider uppercase">
                  {category}
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {items.map((service, index) => {
                    const priceText = service.barberOfferings 
                      ? (service.minPrice === service.maxPrice 
                        ? `R$ ${service.minPrice.toFixed(2)}` 
                        : `R$ ${service.minPrice.toFixed(2)} - R$ ${service.maxPrice.toFixed(2)}`)
                      : `R$ ${service.price.toFixed(2)}`

                    const durationText = service.barberOfferings
                      ? (service.minDuration === service.maxDuration
                        ? `${service.minDuration} min`
                        : `${service.minDuration} - ${service.maxDuration} min`)
                      : `${service.duration} min`

                    return (
                      <div 
                        key={index}
                        className="p-6 gap-4 justify-between flex flex-col glass rounded-xl border border-border/80 hover:border-primary/50 transition-all duration-300 hover:shadow-lg bg-card/60 relative"
                      >
                        <div className="space-y-2">
                          <div className="flex justify-between items-start gap-4">
                            <h3 className="font-serif font-bold text-base sm:text-lg text-foreground">{service.name}</h3>
                            <span className="text-primary font-bold font-serif whitespace-nowrap">
                              {priceText}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {service.description}
                          </p>
                        </div>

                        {/* Barbers offering badges */}
                        {service.barberOfferings && service.barberOfferings.length > 0 && (
                          <div className="space-y-1.5 pt-2 border-t border-border/20">
                            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">Profissionais:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {service.barberOfferings.map((offering: any, idx: number) => (
                                <div key={idx} className="flex flex-col gap-0.5">
                                  <span 
                                    className="inline-flex items-center bg-secondary/60 border border-border px-2 py-0.5 rounded text-[10px] text-foreground font-medium"
                                  >
                                    {offering.barberName} <span className="text-primary font-bold font-mono ml-1">R$ {offering.price.toFixed(2)}</span>
                                  </span>
                                  {offering.customDescription && (
                                    <span className="text-[10px] text-primary/90 font-medium italic pl-0.5">
                                      "{offering.customDescription}"
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between items-center text-[10px] text-muted-foreground border-t border-border/40 pt-3">
                          <span className="flex items-center gap-1 uppercase font-semibold">
                            <Clock className="w-3.5 h-3.5 text-primary" /> {durationText}
                          </span>
                          <GradientButton asChild>
                            <Link 
                              href="/entrar"
                              className="px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1"
                            >
                              Agendar <ChevronRight className="w-3 h-3" />
                            </Link>
                          </GradientButton>
                        </div>
                      </div>
                    )
                  })}
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
