'use client'

import React, { useState, useTransition, useEffect, useRef, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Scissors, User, Mail, Phone, Lock, ArrowRight, AlertCircle, CheckCircle, Loader2, Sun, Moon, Crown, Check, MessageCircle } from 'lucide-react'
import { signUpAction } from '@/app/auth/actions'
import { createClient } from '@/lib/supabase'
import { useTheme } from '@/components/ThemeProvider'
import { formatWhatsAppLink } from '@/lib/settings'

function ParticlesBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { theme } = useTheme()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const setCanvasSize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    setCanvasSize()
    window.addEventListener('resize', setCanvasSize)

    class Particle {
      x: number
      y: number
      size: number
      speedX: number
      speedY: number
      color: string

      constructor() {
        this.x = Math.random() * canvas!.width
        this.y = Math.random() * canvas!.height
        this.size = Math.random() * 2 + 0.5
        this.speedX = (Math.random() - 0.5) * 0.25
        this.speedY = (Math.random() - 0.5) * 0.25
        this.color = theme === 'dark'
          ? `rgba(197, 168, 128, ${Math.random() * 0.15})`
          : `rgba(140, 110, 67, ${Math.random() * 0.12})`
      }

      update() {
        this.x += this.speedX
        this.y += this.speedY

        if (this.x > canvas!.width) this.x = 0
        if (this.x < 0) this.x = canvas!.width
        if (this.y > canvas!.height) this.y = 0
        if (this.y < 0) this.y = canvas!.height
      }

      draw() {
        if (!ctx) return
        ctx.fillStyle = this.color
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const particles: Particle[] = []
    const particleCount = Math.min(
      80,
      Math.floor((canvas.width * canvas.height) / 25000)
    )

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle())
    }

    let animationFrameId: number

    const animate = () => {
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const particle of particles) {
        particle.update()
        particle.draw()
      }

      animationFrameId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', setCanvasSize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [theme])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
    />
  )
}

function SignUpForm() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [acceptPrivacy, setAcceptPrivacy] = useState(false)

  const [errorMsg, setErrorMsg] = useState('')
  const [isSignedUp, setIsSignedUp] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!fullName || !email || !phone || !password || !confirmPassword) {
      setErrorMsg('Por favor, preencha todos os campos obrigatórios.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMsg('As senhas não coincidem.')
      return
    }

    if (!acceptTerms || !acceptPrivacy) {
      setErrorMsg('Você precisa aceitar os Termos de Uso e a Política de Privacidade para prosseguir.')
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.append('fullName', fullName)
      formData.append('email', email)
      formData.append('phone', phone)
      formData.append('password', password)
      formData.append('confirmPassword', confirmPassword)
      formData.append('acceptTerms', acceptTerms ? 'true' : 'false')
      formData.append('acceptPrivacy', acceptPrivacy ? 'true' : 'false')

      const response = await signUpAction(null, formData)
      if (!response.success) {
        setErrorMsg(response.message)
      } else {
        setIsSignedUp(true)
      }
    })
  }

  const handleGoogleSignUp = async () => {
    setErrorMsg('')
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirectTo=/cliente`
        }
      })
      if (error) {
        setErrorMsg('Erro ao se cadastrar com Google: ' + error.message)
      }
    } catch (err: any) {
      setErrorMsg('Erro ao conectar ao Google: ' + err.message)
    }
  }

  if (isSignedUp) {
    return (
      <div className="animated-gradient-card p-8 sm:p-10 rounded-2xl space-y-6 shadow-2xl relative overflow-hidden text-center animate-in zoom-in-95 duration-300">
        <div className="w-16 h-16 rounded-2xl bg-primary/15 text-primary flex items-center justify-center mx-auto border border-primary/30 shadow-lg shadow-primary/10">
          <Mail className="w-8 h-8" />
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-serif font-bold text-foreground">
            Conta criada com sucesso! ✉️
          </h2>
          
          <div className="p-4 bg-secondary/50 border border-primary/20 rounded-xl text-xs sm:text-sm text-foreground/90 text-left space-y-2.5 leading-relaxed">
            <p className="font-semibold text-primary">
              Enviamos um link de confirmação para o seu e-mail: <span className="underline font-mono text-foreground">{email}</span>
            </p>
            <p>
              Você precisa clicar nesse link para ativar sua conta antes de conseguir fazer login.
            </p>
            <p className="text-[11px] text-muted-foreground pt-2 border-t border-border/40">
              💡 <strong>Não encontrou o e-mail?</strong> Verifique também a sua caixa de <strong>spam</strong> ou lixo eletrônico.
            </p>
          </div>
        </div>

        <div className="pt-2">
          <Link
            href="/entrar"
            className="inline-flex items-center justify-center gap-2 w-full py-3.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs shadow-lg transition-all"
          >
            <span>Ir para a Tela de Entrar (Login)</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="animated-gradient-card p-8 sm:p-10 rounded-2xl space-y-6 shadow-2xl relative overflow-hidden transition-all duration-300">
      
      {errorMsg && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2.5 text-xs text-destructive animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Full Name Floating input */}
        <div className="relative">
          <div className="relative border border-border/80 focus-within:border-primary rounded-lg transition-all duration-200 bg-secondary/30">
            <input
              type="text"
              id="fullName"
              placeholder=" "
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isPending}
              className="block px-3.5 pb-2.5 pt-5 w-full text-sm text-foreground bg-transparent border-0 appearance-none focus:outline-none focus:ring-0 peer disabled:opacity-50"
              required
            />
            <label
              htmlFor="fullName"
              className="absolute text-xs sm:text-sm text-muted-foreground duration-200 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] px-3.5 peer-focus:text-primary peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 select-none pointer-events-none"
            >
              Nome Completo
            </label>
          </div>
        </div>

        {/* Email Floating input */}
        <div className="relative">
          <div className="relative border border-border/80 focus-within:border-primary rounded-lg transition-all duration-200 bg-secondary/30">
            <input
              type="email"
              id="email"
              placeholder=" "
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
              className="block px-3.5 pb-2.5 pt-5 w-full text-sm text-foreground bg-transparent border-0 appearance-none focus:outline-none focus:ring-0 peer disabled:opacity-50"
              required
            />
            <label
              htmlFor="email"
              className="absolute text-xs sm:text-sm text-muted-foreground duration-200 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] px-3.5 peer-focus:text-primary peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 select-none pointer-events-none"
            >
              E-mail
            </label>
          </div>
        </div>

        {/* Phone Floating input */}
        <div className="relative">
          <div className="relative border border-border/80 focus-within:border-primary rounded-lg transition-all duration-200 bg-secondary/30">
            <input
              type="tel"
              id="phone"
              placeholder=" "
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isPending}
              className="block px-3.5 pb-2.5 pt-5 w-full text-sm text-foreground bg-transparent border-0 appearance-none focus:outline-none focus:ring-0 peer disabled:opacity-50"
              required
            />
            <label
              htmlFor="phone"
              className="absolute text-xs sm:text-sm text-muted-foreground duration-200 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] px-3.5 peer-focus:text-primary peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 select-none pointer-events-none"
            >
              Telefone (WhatsApp)
            </label>
          </div>
        </div>

        {/* Password Floating input */}
        <div className="relative">
          <div className="relative border border-border/80 focus-within:border-primary rounded-lg transition-all duration-200 bg-secondary/30">
            <input
              type="password"
              id="password"
              placeholder=" "
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isPending}
              className="block px-3.5 pb-2.5 pt-5 w-full text-sm text-foreground bg-transparent border-0 appearance-none focus:outline-none focus:ring-0 peer disabled:opacity-50"
              required
            />
            <label
              htmlFor="password"
              className="absolute text-xs sm:text-sm text-muted-foreground duration-200 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] px-3.5 peer-focus:text-primary peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 select-none pointer-events-none"
            >
              Senha
            </label>
          </div>
        </div>

        {/* Confirm Password Floating input */}
        <div className="relative">
          <div className="relative border border-border/80 focus-within:border-primary rounded-lg transition-all duration-200 bg-secondary/30">
            <input
              type="password"
              id="confirmPassword"
              placeholder=" "
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isPending}
              className="block px-3.5 pb-2.5 pt-5 w-full text-sm text-foreground bg-transparent border-0 appearance-none focus:outline-none focus:ring-0 peer disabled:opacity-50"
              required
            />
            <label
              htmlFor="confirmPassword"
              className="absolute text-xs sm:text-sm text-muted-foreground duration-200 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] px-3.5 peer-focus:text-primary peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 select-none pointer-events-none"
            >
              Confirmar Senha
            </label>
          </div>
        </div>

        {/* Terms Checkboxes */}
        <div className="space-y-3 pt-2">
          <label className="flex items-start gap-2.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              disabled={isPending}
              className="mt-0.5 rounded accent-primary w-4 h-4 cursor-pointer"
              required
            />
            <span>
              Eu aceito e concordo com os{' '}
              <Link href="/termos-de-uso" target="_blank" className="text-primary hover:underline font-semibold">
                Termos de Uso
              </Link>{' '}
              da barbearia.
            </span>
          </label>

          <label className="flex items-start gap-2.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acceptPrivacy}
              onChange={(e) => setAcceptPrivacy(e.target.checked)}
              disabled={isPending}
              className="mt-0.5 rounded accent-primary w-4 h-4 cursor-pointer"
              required
            />
            <span>
              Eu aceito a{' '}
              <Link href="/politica-de-privacidade" target="_blank" className="text-primary hover:underline font-semibold">
                Política de Privacidade
              </Link>{' '}
              e autorizo o tratamento dos dados.
            </span>
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full py-3 bg-primary hover:bg-primary-hover text-primary-foreground font-bold rounded-lg text-xs transition-all shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-2"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-primary-foreground" />
              Criando sua Conta...
            </>
          ) : (
            <>
              Cadastrar
              <ArrowRight className="w-4 h-4 text-primary-foreground" />
            </>
          )}
        </button>
      </form>

      {/* "ou continue com" divider */}
      <div className="relative flex items-center justify-center my-4">
        <div className="border-t border-border/40 w-full absolute z-0" />
        <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground bg-secondary/80 backdrop-blur px-3.5 relative z-10 rounded-full border border-border/30">
          ou continue com
        </span>
      </div>

      {/* Google login action button */}
      <button
        type="button"
        onClick={handleGoogleSignUp}
        disabled={isPending}
        className="w-full py-3 bg-secondary hover:bg-muted border border-border text-foreground font-semibold rounded-lg text-xs transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2.5 cursor-pointer shadow-md disabled:opacity-50"
      >
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
        </svg>
        <span>Cadastrar com Google</span>
      </button>

      {/* Redirection link */}
      <div className="text-center text-xs text-muted-foreground border-t border-border/40 pt-4">
        Já tem uma conta?{' '}
        <Link href="/entrar" className="text-primary hover:underline font-semibold transition-all">
          Entrar agora
        </Link>
      </div>
    </div>
  )
}

function PacoteMensalCard() {
  const [settings, setSettings] = useState<any>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('business_settings')
      .select('*')
      .eq('key', 'general_settings')
      .single()
      .then(({ data }) => {
        if (data?.value) setSettings(data.value)
      })
  }, [])

  const waMessage = "Olá! Tenho interesse no Pacote Mensal (4 cortes por R$150). Gostaria de saber mais e agendar meu horário fixo!"
  const waUrl = formatWhatsAppLink(settings?.whatsapp, waMessage)

  return (
    <div className="animated-gradient-card border border-primary/25 rounded-2xl overflow-hidden shadow-2xl relative">
      <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />

      <div className="relative p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Scissors className="w-4 h-4 text-primary rotate-45" />
            </div>
            <div>
              <p className="text-[9px] text-primary uppercase font-bold tracking-widest">Plano Mensal</p>
              <h3 className="font-serif font-bold text-base text-foreground leading-tight">Horário Fixo Toda Semana</h3>
            </div>
          </div>
          <span className="shrink-0 text-[8px] font-bold text-primary-foreground bg-primary px-2.5 py-1 rounded-full uppercase tracking-widest">
            Mais Econômico
          </span>
        </div>

        {/* Price anchoring */}
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <span className="text-2xl font-serif font-bold text-primary">R$ 150<span className="text-xs font-normal text-muted-foreground">/mês</span></span>
          <span className="text-sm text-muted-foreground line-through decoration-2">R$ 200</span>
          <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase">
            Economize R$ 50
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground -mt-1">
          4 cortes avulsos custariam R$ 200 — no plano, apenas R$ 150 por mês.
        </p>

        {/* Benefit bullets */}
        <ul className="space-y-1.5">
          {[
            'Mesmo dia e horário garantidos pelas 4 semanas',
            'Sem precisar agendar toda semana — vaga reservada',
            'Prioridade na agenda em dias concorridos',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              {item}
            </li>
          ))}
        </ul>

        {/* WhatsApp CTA */}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3 bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md hover:scale-[1.01] active:scale-[0.99]"
        >
          <MessageCircle className="w-4 h-4" />
          Saber mais pelo WhatsApp
        </a>
      </div>
    </div>
  )
}

export default function CriarConta() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="relative min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-secondary/40 via-background to-background flex items-center justify-center p-4 py-12 overflow-hidden transition-colors duration-300">
      
      {/* Dynamic Gold/Amber Particle Canvas */}
      <ParticlesBackground />

      {/* Floating Theme Toggle at top right */}
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 p-3 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-all duration-200 z-10 cursor-pointer border border-border/50 glass"
        aria-label="Alternar tema"
      >
        {theme === 'dark' ? <Sun size={20} className="text-primary" /> : <Moon size={20} className="text-primary" />}
      </button>

      <div className="w-full max-w-md space-y-6 z-10 relative">
        
        {/* Logo and Premium Branding Headers */}
        <div className="text-center space-y-3">
          <Link href="/" className="inline-flex items-center group mx-auto select-none">
            <Image 
              src="/osanchez_logo_transparent.png" 
              alt="Osanchez Barbearia" 
              width={180} 
              height={46} 
              className="premium-logo object-contain"
              priority
            />
          </Link>
          <div className="space-y-1 pt-1">
            <p className="text-xs text-muted-foreground font-medium">Crie sua conta para continuar</p>
          </div>
        </div>

        {/* Card Form inside Suspense */}
        <Suspense fallback={
          <div className="glass p-10 rounded-2xl border border-border flex flex-col items-center justify-center py-12 gap-2 shadow-2xl">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Carregando formulário...</p>
          </div>
        }>
          <SignUpForm />
        </Suspense>

        {/* Standalone Pacote Mensal Card */}
        <PacoteMensalCard />

        {/* Small footer back to site */}
        <div className="text-center pt-2">
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-all">
            ← Voltar para a página inicial
          </Link>
        </div>

      </div>
    </div>
  )
}
