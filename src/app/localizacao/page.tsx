import React from 'react'
import { MapPin, Phone, Clock, Compass, Car, Coffee } from 'lucide-react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

export default function Localizacao() {
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
                    Rua da Barbearia, 123 - Centro<br />
                    São Paulo - SP, CEP: 01001-000
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="p-2.5 rounded bg-primary/10 text-primary h-max shrink-0">
                      <Compass className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider">Ponto de Referência</h4>
                      <p className="text-[11px] text-muted-foreground">A duas quadras da estação de Metrô Central, ao lado do Café Premium.</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="p-2.5 rounded bg-primary/10 text-primary h-max shrink-0">
                      <Car className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider">Estacionamento</h4>
                      <p className="text-[11px] text-muted-foreground">Estacionamento conveniado gratuito por 2 horas com carimbo no local.</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="p-2.5 rounded bg-primary/10 text-primary h-max shrink-0">
                      <Coffee className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider">Comodidades</h4>
                      <p className="text-[11px] text-muted-foreground">Café expresso de cortesia, cervejas artesanais geladas e rede Wi-Fi de alta velocidade.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-border/40">
                <a
                  href="https://maps.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full text-center py-3 bg-primary hover:bg-primary-hover text-primary-foreground font-bold rounded text-xs transition-all shadow-md block"
                >
                  Abrir no Google Maps
                </a>
              </div>
            </div>

            {/* Map Area */}
            <div className="lg:col-span-7 aspect-video lg:aspect-auto bg-secondary/30 rounded-lg border border-border min-h-[300px] flex flex-col items-center justify-center p-8 text-center text-muted-foreground relative overflow-hidden">
              <MapPin className="w-16 h-16 text-primary/30 mb-4 animate-bounce" />
              <h4 className="font-serif font-bold text-base text-foreground mb-2">Mapa Interativo (Google Maps)</h4>
              <p className="text-xs max-w-sm leading-relaxed mb-6">
                Para fins deste MVP de produção, integramos coordenadas prontas. Em produção, este container exibe o widget de mapas dinâmico.
              </p>
              <div className="absolute inset-0 bg-grid-white/[0.01] bg-[size:16px_16px] pointer-events-none" />
              
              <div className="text-[10px] text-muted-foreground bg-background px-3 py-1.5 rounded border border-border flex items-center gap-1.5 shadow">
                <Clock className="w-3.5 h-3.5 text-primary" />
                Coord: -23.5505, -46.6333 (Centro, SP)
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
