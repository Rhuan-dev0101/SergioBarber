'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, MapPin, DollarSign, User, AlertCircle, CheckCircle2, Loader2, Save, Settings, Video, Monitor, Smartphone } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { DashboardSidebar } from '@/components/DashboardSidebar'
import { updateBusinessSettingsAction } from './actions'

export default function PainelConfiguracoes() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  // Config settings form inputs
  const [whatsapp, setWhatsapp] = useState('')
  const [address, setAddress] = useState('')
  const [instagram, setInstagram] = useState('')
  const [pixType, setPixType] = useState('cnpj')
  const [pixKey, setPixKey] = useState('')
  const [pixName, setPixName] = useState('')

  // Tutorial Video URLs
  const [tutorialVideoDesktop, setTutorialVideoDesktop] = useState('')
  const [tutorialVideoMobile, setTutorialVideoMobile] = useState('')

  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isPending, startTransition] = useTransition()

  const supabase = createClient()

  useEffect(() => {
    async function loadConfig() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          router.push('/entrar')
          return
        }

        // Check admin auth
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()
        
        if (!profile || profile.role !== 'admin') {
          router.push('/painel') // regular barbers redirect to overview
          return
        }

        // Fetch general_settings config
        const { data: config } = await supabase
          .from('business_settings')
          .select('*')
          .eq('key', 'general_settings')
          .single()

        if (config && config.value) {
          const val = config.value as any
          setWhatsapp(val.whatsapp || '')
          setAddress(val.address || '')
          setInstagram(val.instagram || '')
          setPixType(val.pixType || 'cnpj')
          setPixKey(val.pixKey || '')
          setPixName(val.pixName || '')
          setTutorialVideoDesktop(val.tutorial_video_desktop_url || '')
          setTutorialVideoMobile(val.tutorial_video_mobile_url || '')
        }
      } catch (err) {
        console.error('Error loading config settings:', err)
      } finally {
        setLoading(false)
      }
    }

    loadConfig()
  }, [router, supabase])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    startTransition(async () => {
      const configVal = {
        whatsapp,
        address,
        instagram,
        pixType,
        pixKey,
        pixName,
        tutorial_video_desktop_url: tutorialVideoDesktop,
        tutorial_video_mobile_url: tutorialVideoMobile
      }

      const res = await updateBusinessSettingsAction('general_settings', configVal)
      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg(res.message)
      }
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col md:flex-row justify-center items-center gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Carregando configurações...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <DashboardSidebar />

      <main className="flex-grow p-6 sm:p-8 space-y-6 overflow-y-auto">
        
        {/* Title */}
        <div className="border-b border-border/40 pb-6">
          <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-2">
            <Settings className="w-7 h-7 text-primary shrink-0" />
            Configurações do Estabelecimento ⚙️
          </h1>
          <p className="text-xs text-muted-foreground">Gerencie informações públicas de contato, localização, chave Pix e vídeos tutoriais do site</p>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-2 text-xs text-destructive max-w-2xl">
            <AlertCircle className="w-4.5 h-4.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-2 text-xs text-emerald-500 max-w-2xl">
            <CheckCircle2 className="w-4.5 h-4.5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="max-w-2xl glass p-6 sm:p-8 rounded-2xl border border-border/80 space-y-6 shadow-xl">
          
          {/* Section 1: Business profile details */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2 border-b border-border/40 pb-2">
              <Settings className="w-4 h-4 text-primary" /> Informações de Atendimento ao Cliente
            </h3>

            {/* WhatsApp */}
            <div className="space-y-1.5">
              <label htmlFor="cWhatsapp" className="text-xs font-bold text-foreground uppercase tracking-wider">WhatsApp Oficial de Suporte</label>
              <div className="relative flex items-center">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                <input
                  id="cWhatsapp"
                  type="tel"
                  placeholder="5511999999999"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  disabled={isPending}
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border focus:border-primary rounded-xl text-base text-foreground outline-none font-medium"
                  required
                />
              </div>
              <p className="text-[10px] text-muted-foreground italic">Insira apenas números com DDI e DDD (Ex: 5511999999999)</p>
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <label htmlFor="cAddress" className="text-xs font-bold text-foreground uppercase tracking-wider">Endereço Físico</label>
              <div className="relative flex items-center">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                <input
                  id="cAddress"
                  type="text"
                  placeholder="Rua da Barbearia, 123 - Centro, São Paulo - SP"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={isPending}
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border focus:border-primary rounded-xl text-base text-foreground outline-none font-medium"
                  required
                />
              </div>
            </div>

            {/* Instagram */}
            <div className="space-y-1.5">
              <label htmlFor="cInstagram" className="text-xs font-bold text-foreground uppercase tracking-wider">Instagram URL</label>
              <div className="relative flex items-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                <input
                  id="cInstagram"
                  type="url"
                  placeholder="https://instagram.com/osanchezbarbearia"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  disabled={isPending}
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border focus:border-primary rounded-xl text-base text-foreground outline-none font-medium"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Pix credentials */}
          <div className="space-y-4 pt-4 border-t border-border/40">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2 border-b border-border/40 pb-2">
              <DollarSign className="w-4 h-4 text-primary" /> Configuração do Pix (Sinal 50%)
            </h3>

            {/* Pix key type */}
            <div className="space-y-1.5">
              <label htmlFor="cPixType" className="text-xs font-bold text-foreground uppercase tracking-wider">Tipo de Chave Pix</label>
              <select
                id="cPixType"
                value={pixType}
                onChange={(e) => setPixType(e.target.value)}
                disabled={isPending}
                className="w-full px-4 py-2.5 bg-background border border-border focus:border-primary rounded-xl text-base text-foreground outline-none cursor-pointer font-medium"
              >
                <option value="cnpj">CNPJ</option>
                <option value="email">E-mail</option>
                <option value="phone">Celular</option>
                <option value="evp">Chave Aleatória (EVP)</option>
              </select>
            </div>

            {/* Pix key value */}
            <div className="space-y-1.5">
              <label htmlFor="cPixKey" className="text-xs font-bold text-foreground uppercase tracking-wider">Chave Pix de Recebimento</label>
              <input
                id="cPixKey"
                type="text"
                placeholder="Insira a sua chave Pix para depósito"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                disabled={isPending}
                className="w-full px-4 py-2.5 bg-background border border-border focus:border-primary rounded-xl text-base text-foreground outline-none font-mono font-bold"
                required
              />
            </div>

            {/* Pix beneficiary name */}
            <div className="space-y-1.5">
              <label htmlFor="cPixName" className="text-xs font-bold text-foreground uppercase tracking-wider">Nome do Beneficiário (Titular)</label>
              <div className="relative flex items-center">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                <input
                  id="cPixName"
                  type="text"
                  placeholder="Osanchez Barbearia LTDA"
                  value={pixName}
                  onChange={(e) => setPixName(e.target.value)}
                  disabled={isPending}
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border focus:border-primary rounded-xl text-base text-foreground outline-none font-medium"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 3: Tutorial Video URLs */}
          <div className="space-y-4 pt-4 border-t border-border/40">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2 border-b border-border/40 pb-2">
              <Video className="w-4 h-4 text-primary" /> Vídeos de Tutorial do Site 🎬
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Cole abaixo os links dos vídeos do YouTube (funciona com vídeos normais <code className="text-primary font-mono font-bold">watch?v=...</code>, vídeos curtos <code className="text-primary font-mono font-bold">shorts/...</code> ou links <code className="text-primary font-mono font-bold">youtu.be/...</code>).
            </p>

            {/* Desktop Video URL */}
            <div className="space-y-1.5">
              <label htmlFor="cTutorialDesktop" className="text-xs font-bold text-foreground uppercase tracking-wider">
                Link do Vídeo Tutorial (Computador / Desktop)
              </label>
              <div className="relative flex items-center">
                <Monitor className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                <input
                  id="cTutorialDesktop"
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=... ou https://youtu.be/..."
                  value={tutorialVideoDesktop}
                  onChange={(e) => setTutorialVideoDesktop(e.target.value)}
                  disabled={isPending}
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border focus:border-primary rounded-xl text-base text-foreground outline-none font-mono"
                />
              </div>
            </div>

            {/* Mobile Video URL */}
            <div className="space-y-1.5">
              <label htmlFor="cTutorialMobile" className="text-xs font-bold text-foreground uppercase tracking-wider">
                Link do Vídeo Tutorial (Celular / Smartphone)
              </label>
              <div className="relative flex items-center">
                <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                <input
                  id="cTutorialMobile"
                  type="url"
                  placeholder="https://youtube.com/shorts/... ou https://youtu.be/..."
                  value={tutorialVideoMobile}
                  onChange={(e) => setTutorialVideoMobile(e.target.value)}
                  disabled={isPending}
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border focus:border-primary rounded-xl text-base text-foreground outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-primary-foreground" />
                Salvando Configurações...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 text-primary-foreground" />
                <span>Salvar Configurações</span>
              </>
            )}
          </button>

        </form>

      </main>
    </div>
  )
}
