'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Scissors, Phone, MapPin, Mail, Clock, Play } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { formatPhoneNumber, formatWhatsAppLink } from '@/lib/settings'
import { TutorialModal } from '@/components/TutorialModal'

interface BusinessSettings {
  whatsapp?: string
  address?: string
  instagram?: string
  tutorial_video_desktop_url?: string
  tutorial_video_mobile_url?: string
}

export function Footer({ initialSettings }: { initialSettings?: BusinessSettings }) {
  const [settings, setSettings] = useState<BusinessSettings | null>(initialSettings || null)
  const [showTutorial, setShowTutorial] = useState(false)

  useEffect(() => {
    if (initialSettings) {
      setSettings(initialSettings)
      return
    }

    async function loadSettings() {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('business_settings')
          .select('value')
          .eq('key', 'general_settings')
          .single()
        
        if (data?.value) {
          setSettings(data.value as BusinessSettings)
        }
      } catch (err) {
        console.error('Error fetching settings in Footer component:', err)
      }
    }

    loadSettings()
  }, [initialSettings])

  const address = settings?.address || 'Rua da Barbearia, 123 - Centro, São Paulo - SP'
  const rawWhatsapp = settings?.whatsapp || ''
  const instagramUrl = settings?.instagram || 'https://instagram.com/osanchezbarbearia/'
  
  const whatsappUrl = formatWhatsAppLink(rawWhatsapp)
  const formattedPhone = formatPhoneNumber(rawWhatsapp)
  const telUrl = `tel:+${rawWhatsapp.replace(/\D/g, '')}`

  return (
    <footer className="relative bg-background mt-auto transition-colors">
      {/* 6. Gold gradient divider top line */}
      <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-primary/45 to-transparent opacity-80" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 sm:gap-8">
          
          {/* Logo & About */}
          <div className="space-y-5">
            <Link href="/" className="flex items-center group select-none">
              <Image 
                src="/osanchez_logo_transparent.png" 
                alt="Osanchez Barbearia" 
                width={140} 
                height={36} 
                className="premium-logo object-contain"
              />
            </Link>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Uma experiência única de estilo e cuidado para o homem moderno. Cortes clássicos e modernos realizados por especialistas em visagismo facial.
            </p>
            <div className="flex gap-3">
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-secondary hover:bg-primary hover:text-primary-foreground text-muted-foreground transition-all btn-premium shadow-md"
                aria-label="Instagram"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
              </a>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-secondary hover:bg-primary hover:text-primary-foreground text-muted-foreground transition-all btn-premium shadow-md"
                aria-label="WhatsApp"
              >
                <Phone className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-4">
            <h3 className="font-serif font-bold text-xs text-foreground tracking-widest uppercase pb-1.5 border-b border-border/30">
              Contato
            </h3>
            <ul className="space-y-3.5 text-xs text-muted-foreground">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>{address}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-primary shrink-0" />
                <a href={telUrl} className="hover:text-primary transition-colors hover:underline">{formattedPhone}</a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-primary shrink-0" />
                <a href="mailto:contato@osanchez.com.br" className="hover:text-primary transition-colors hover:underline">contato@osanchez.com.br</a>
              </li>
            </ul>
          </div>

          {/* Legal Links */}
          <div className="space-y-4">
            <h3 className="font-serif font-bold text-xs text-foreground tracking-widest uppercase pb-1.5 border-b border-border/30">
              Links Úteis
            </h3>
            <ul className="space-y-3 text-xs text-muted-foreground">
              <li className="transform hover:translate-x-1 transition-all duration-200">
                <Link href="/servicos" className="hover:text-primary transition-colors">Nossos Serviços</Link>
              </li>
              <li className="transform hover:translate-x-1 transition-all duration-200">
                <Link href="/barbeiros" className="hover:text-primary transition-colors">Nossa Equipe</Link>
              </li>
              <li className="transform hover:translate-x-1 transition-all duration-200">
                <button
                  type="button"
                  onClick={() => setShowTutorial(true)}
                  className="hover:text-primary transition-colors text-left font-semibold text-primary/90 flex items-center gap-1 cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-primary" />
                  <span>Ver Tutorial em Vídeo</span>
                </button>
              </li>
              <li className="transform hover:translate-x-1 transition-all duration-200">
                <Link href="/termos-de-uso" className="hover:text-primary transition-colors">Termos de Uso</Link>
              </li>
              <li className="transform hover:translate-x-1 transition-all duration-200">
                <Link href="/politica-de-privacidade" className="hover:text-primary transition-colors">Política de Privacidade</Link>
              </li>
              <li className="transform hover:translate-x-1 transition-all duration-200">
                <Link href="/politica-de-cookies" className="hover:text-primary transition-colors">Política de Cookies</Link>
              </li>
            </ul>
          </div>

        </div>

        <div className="border-t border-border/40 mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-muted-foreground gap-4">
          <span>© 2026 Osanchez Barbearia. Todos os direitos reservados.</span>
          <span className="flex items-center gap-1 text-[10px] tracking-wider uppercase font-semibold text-primary/75">
            Mãos Especialistas • Estilo Premium
          </span>
        </div>
      </div>

      <TutorialModal
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
        initialDesktopUrl={settings?.tutorial_video_desktop_url}
        initialMobileUrl={settings?.tutorial_video_mobile_url}
        initialWhatsapp={rawWhatsapp}
      />
    </footer>
  )
}
