import Image from 'next/image'
import React from 'react'
export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { Scissors, Camera, ChevronRight } from 'lucide-react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { createServerSupabaseClient } from '@/lib/supabase'
import { GradientButton } from '@/components/ui/gradient-button'
import { getBusinessSettings } from '@/lib/settings'

const SEED_GALLERY = [
  { 
    title: 'Degradê Navalhado High Fade', 
    category: 'Corte', 
    description: 'Transição limpa da pele ao cabelo, perfeita para rostos quadrados.',
    url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80'
  },
  { 
    title: 'Barba Alinhada e Hidratada', 
    category: 'Barba', 
    description: 'Modelagem completa com acabamento a laser e toalha quente.',
    url: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=600&q=80'
  },
  { 
    title: 'Corte Social Clássico', 
    category: 'Corte', 
    description: 'Estilo clássico formal finalizado com pomada matte.',
    url: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=600&q=80'
  },
  { 
    title: 'Corte Moderno Textured Crop', 
    category: 'Corte', 
    description: 'Corte texturizado e moderno para um visual despojado no dia a dia.',
    url: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=600&q=80'
  },
  { 
    title: 'Luzes e Reflexo Platinado', 
    category: 'Química', 
    description: 'Clareamento capilar uniforme em tom loiro platinado.',
    url: 'https://images.unsplash.com/photo-1620331311520-246422fd82f9?auto=format&fit=crop&w=600&q=80'
  },
  { 
    title: 'Cabelo Infantil Estilizado', 
    category: 'Cabelo', 
    description: 'Corte infantil com franja leve e lateral limpa.',
    url: 'https://images.unsplash.com/photo-1512864084360-7c0c4d0a0845?auto=format&fit=crop&w=600&q=80'
  },
]

export default async function Galeria() {
  // Inicia em paralelo com as demais consultas da pagina.
  const settingsPromise = getBusinessSettings()
  let images = SEED_GALLERY

  try {
    const supabase = await createServerSupabaseClient()
    const { data: dbImages } = await supabase
      .from('gallery_images')
      .select('url, description, title, category')
      .order('created_at', { ascending: false })

    if (dbImages && dbImages.length > 0) {
      // Map database images and augment with fields
      images = dbImages.map((img, idx) => ({
        title: img.title || img.description || `Corte Premium ${idx + 1}`,
        category: img.category || (img.description?.includes('Barba') ? 'Barba' : 'Corte'),
        description: img.description || 'Executado com precisão por nossos barbeiros.',
        url: img.url
      }))
    }
  } catch (error) {
    console.error('Error loading gallery details from db:', error)
  }

  const settings = await settingsPromise

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-grow py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center space-y-4 mb-16">
            <h1 className="text-4xl font-serif font-bold text-foreground">Galeria de Estilos</h1>
            <div className="h-0.5 w-16 bg-primary mx-auto" />
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Veja alguns dos cortes, barbas e transformações químicas de nossos clientes. Agende seu horário e descobra o seu próximo estilo.
            </p>
          </div>

          {/* Grid Layout — Matching Homepage Square Overlay Aspect Ratio */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {images.map((item, index) => (
              <div 
                key={index}
                className="relative aspect-square rounded-2xl border border-border/80 overflow-hidden group hover:border-primary/60 transition-all duration-500 shadow-xl flex flex-col justify-end p-4 sm:p-5 bg-card/60"
              >
                {/* Background Image & Dark Gradient Overlay */}
                <div className="absolute inset-0 z-0 bg-secondary/30">
                  {item.url ? (
                    <Image fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" 
                      src={item.url} 
                      alt={item.title} 
                      className="w-full h-full object-cover group-hover:scale-110 duration-700 ease-out filter grayscale group-hover:grayscale-0" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-primary/10">
                      <Scissors className="w-16 h-16 rotate-45 group-hover:scale-110 transition-transform duration-300" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
                </div>

                {/* Content Overlay inside Image */}
                <div className="relative z-10 space-y-1.5 transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
                  <span className="text-[9px] uppercase font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded w-max block tracking-wider shadow-sm">
                    {item.category}
                  </span>
                  <h3 className="font-serif font-bold text-sm sm:text-base text-white leading-tight drop-shadow-sm group-hover:text-primary transition-colors">
                    {item.title}
                  </h3>
                  {item.description && (
                    <p className="text-[11px] text-zinc-300/90 leading-snug line-clamp-2 opacity-90 group-hover:opacity-100 transition-opacity">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Call to Action */}
          <div className="mt-16 text-center premium-card max-w-xl mx-auto p-8 rounded-lg space-y-4">
            <Camera className="w-8 h-8 text-primary mx-auto" />
            <h3 className="font-serif font-bold text-lg text-foreground">Quer Ver Seu Visual Aqui?</h3>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
              Nossos profissionais registram os melhores cortes para inspirar nossa comunidade. Agende seu horário com quem entende do assunto.
            </p>
            <GradientButton asChild>
              <Link 
                href="/entrar"
                className="inline-flex items-center gap-1.5 px-6 py-2.5 text-xs font-semibold"
              >
                Fazer Meu Agendamento <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </GradientButton>
          </div>

        </div>
      </main>

      <Footer initialSettings={settings || undefined} />
    </div>
  )
}
