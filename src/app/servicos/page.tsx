import React from 'react'
export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { Scissors, Clock, Award, Star, ChevronRight } from 'lucide-react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getBusinessSettings } from '@/lib/settings'
import { GradientButton } from '@/components/ui/gradient-button'
import { GlowCard } from '@/components/ui/spotlight-card'

const SEED_SERVICES = [
  // Cabelo
  { name: 'Corte', duration: 60, price: 50.00, category: 'Cabelo', description: 'Corte tradicional ou moderno realizado com máquina e tesoura. Finalização premium com lavagem e pomada modeladora.' },
  { name: 'Cabelo + Barba', duration: 90, price: 85.00, category: 'Cabelo & Barba', description: 'O combo supremo: corte detalhado ao seu estilo associado à modelagem de barba completa com vapor e toalhas quentes.' },
  { name: 'Infantil', duration: 40, price: 50.00, category: 'Cabelo', description: 'Corte para crianças de até 10 anos. Atendimento atencioso e descontraído.' },
  { name: 'Plano mensal 4 cortes', duration: 60, price: 150.00, category: 'Planos', description: 'A assinatura perfeita para quem faz o corte semanalmente. Economia e prioridade na agenda.' },
  { name: 'Plano mensal 4 cortes + barba', duration: 90, price: 240.00, category: 'Planos', description: 'Assinatura completa de cabelo e barba semanal para estar sempre impecável.' },
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
  const settings = await getBusinessSettings()
  let services = SEED_SERVICES

  try {
    const supabase = await createServerSupabaseClient()
    const { data: dbServices } = await supabase
      .from('services')
      .select('name, duration, price, description')
      .eq('is_active', true)
    
    if (dbServices && dbServices.length > 0) {
      services = dbServices.map(s => {
        // Categorize dynamic services loosely
        let category = 'Geral'
        const lower = s.name.toLowerCase()
        if (lower.includes('corte') || lower.includes('cabelo') || lower.includes('infantil')) category = 'Cabelo'
        if (lower.includes('barba')) category = 'Barba'
        if (lower.includes('plano')) category = 'Planos'
        if (lower.includes('luzes') || lower.includes('progressiva') || lower.includes('platinado')) category = 'Química'
        if (lower.includes('hidrata') || lower.includes('detox') || lower.includes('camuflagem')) category = 'Tratamentos'
        if (lower.includes('sobrancelha')) category = 'Estética'

        return {
          name: s.name,
          duration: s.duration,
          price: Number(s.price),
          category,
          description: s.description || ''
        }
      })
    }
  } catch (error) {
    console.error('Error loading services in route page:', error)
  }

  // Group services by category
  const categories = ['Cabelo', 'Barba', 'Cabelo & Barba', 'Planos', 'Tratamentos', 'Química', 'Estética', 'Geral']
  const grouped = categories.reduce((acc, cat) => {
    const items = services.filter(s => s.category === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {} as Record<string, typeof services>)

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
              Descubra nossos serviços especializados e viva uma experiência premium. Todos os pacotes podem ser parcelados ou pagos via Pix com desconto.
            </p>
          </div>

          {/* List by categories */}
          <div className="space-y-16">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category} className="space-y-6">
                <h2 className="text-xl font-serif font-bold text-primary border-b border-border pb-2 tracking-wider uppercase">
                  {category}
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {items.map((service, index) => (
                    <GlowCard 
                      key={index}
                      glowColor="gold"
                      customSize={true}
                      className="p-6 gap-4 justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-4">
                          <h3 className="font-serif font-bold text-base sm:text-lg text-foreground">{service.name}</h3>
                          <span className="text-primary font-bold font-serif whitespace-nowrap">
                            R$ {service.price.toFixed(2)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {service.description}
                        </p>
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-muted-foreground border-t border-border/40 pt-3">
                        <span className="flex items-center gap-1 uppercase font-semibold">
                          <Clock className="w-3.5 h-3.5 text-primary" /> {service.duration} min
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
                    </GlowCard>
                  ))}
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
