import React from 'react'
export const dynamic = 'force-dynamic'
import { Phone, Heart } from 'lucide-react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { getBusinessSettings, formatPhoneNumber, getGoogleMapsEmbedUrl } from '@/lib/settings'

export default async function Localizacao() {
  const settings = await getBusinessSettings()
  const rawWhatsapp = settings?.whatsapp || ''
  const address = settings?.address || 'Rua da Barbearia, 123 - Centro, São Paulo - SP'
  const formattedPhone = formatPhoneNumber(rawWhatsapp)
  const telUrl = `tel:+${rawWhatsapp.replace(/\D/g, '')}`
  const encodedAddress = encodeURIComponent(address)
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`
  const wazeUrl = `https://waze.com/ul?q=${encodedAddress}&navigate=yes`
  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-grow py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center space-y-4 mb-16">
            <span className="text-xs uppercase font-semibold text-primary tracking-wider">Como Chegar</span>
            <h1 className="text-4xl font-serif font-bold text-foreground">Localização & Espaço</h1>
            <div className="h-0.5 w-16 bg-primary mx-auto" />
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Estamos situados em uma região nobre e de fácil acesso, com infraestrutura moderna para acolher você.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-5xl mx-auto items-stretch">
            {/* Information Card */}
            <div className="lg:col-span-5 glass p-8 rounded-lg border border-border flex flex-col justify-between space-y-8">
              <div className="space-y-6">
                <div>
                  <h2 className="font-serif font-bold text-xl text-foreground mb-2">Nosso Endereço</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {address}
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="p-2.5 rounded bg-primary/10 text-primary h-max shrink-0">
                      <Phone className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider">Contato Direto</h4>
                      <a href={telUrl} className="text-[11px] text-muted-foreground hover:text-primary transition-colors">{formattedPhone}</a>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="p-2.5 rounded bg-primary/10 text-primary h-max shrink-0">
                      <Heart className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider">Comodidades</h4>
                      <p className="text-[11px] text-muted-foreground">Pagamento no cartão de crédito, Wi-Fi grátis e programa de fidelidade exclusivo.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-border/40 flex flex-col sm:flex-row gap-3">
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center py-3 bg-primary hover:bg-primary-hover text-primary-foreground font-bold rounded text-xs transition-all shadow-md block"
                >
                  Abrir no Google Maps
                </a>
                <a
                  href={wazeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center py-3 bg-secondary hover:bg-muted text-foreground border border-border font-bold rounded text-xs transition-all shadow-md block"
                >
                  Abrir no Waze
                </a>
              </div>
            </div>

            {/* Map Area */}
            <div className="lg:col-span-7 aspect-video lg:aspect-auto bg-secondary/30 rounded-lg border border-border min-h-[300px] relative overflow-hidden">
              <iframe
                src={getGoogleMapsEmbedUrl()}
                title="Localização da Osanchez Barbearia no Google Maps"
                className="absolute inset-0 w-full h-full border-0 grayscale-[30%] contrast-[1.1]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </main>

      <Footer initialSettings={settings || undefined} />
    </div>
  )
}
