'use client'

import React, { useState, useTransition, useEffect, Suspense, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { Scissors, Mail, Lock, ArrowRight, AlertCircle, Loader2, Eye, EyeOff, Sun, Moon } from 'lucide-react'
import { loginAction } from '@/app/auth/actions'
import { createClient } from '@/lib/supabase'
import { useTheme } from '@/components/ThemeProvider'
import { sanitizeRedirectPath } from '@/lib/utils'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const searchParams = useSearchParams()
  // Sanitizado aqui na entrada: todo uso downstream (OAuth redirect, router.push)
  // ja recebe um path interno seguro, nunca uma URL externa vinda da query string.
  const redirectTo = sanitizeRedirectPath(searchParams.get('redirectTo'), '')

  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam === 'OAuthFail') {
      setErrorMsg('Falha na autenticação via Google. Por favor, tente novamente.')
    }
  }, [searchParams])

  const handleGoogleSignIn = async () => {
    setErrorMsg('')
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo || '/cliente')}`
        }
      })
      if (error) {
        console.error(error); setErrorMsg('Não foi possível continuar com Google. Tente novamente ou use e-mail e senha.')
      }
    } catch (err: any) {
      console.error(err); setErrorMsg('Não foi possível conectar ao Google. Verifique sua conexão e tente novamente.')
    }
  }

  const handleFacebookSignIn = async () => {
    setErrorMsg('')
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo || '/cliente')}`
        }
      })
      if (error) {
        console.error(error); setErrorMsg('Não foi possível continuar com Facebook. Tente novamente ou use e-mail e senha.')
      }
    } catch (err: any) {
      console.error(err); setErrorMsg('Não foi possível conectar ao Facebook. Verifique sua conexão e tente novamente.')
    }
  }

  useEffect(() => {
    // If the user is already logged in, redirect them
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => {
            if (data?.role === 'admin' || data?.role === 'barber') {
              router.push('/painel')
            } else {
              router.push('/cliente')
            }
          })
      }
    })
  }, [router])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!email || !password) {
      setErrorMsg('Por favor, preencha todos os campos.')
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.append('email', email)
      formData.append('password', password)
      if (redirectTo) {
        formData.append('redirectTo', redirectTo)
      }

      const response = await loginAction(null, formData)
      if (!response.success) {
        setErrorMsg(response.message)
      } else {
        // Redirection based on role
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
          
          if (profile?.role === 'admin' || profile?.role === 'barber') {
            router.push('/painel')
          } else {
            router.push(redirectTo || '/cliente')
          }
          router.refresh()
        }
      }
    })
  }

  return (
    <div className="animated-gradient-card p-8 sm:p-10 rounded-2xl space-y-6 shadow-2xl relative overflow-hidden transition-all duration-300">
      
      {errorMsg && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2.5 text-xs text-destructive animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email Field with Floating Label */}
        <div className="relative">
          <div className="relative border border-border/80 focus-within:border-primary rounded-lg transition-all duration-200 bg-secondary/30">
            <input
              type="email"
              id="email"
              placeholder=" "
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
              className="block px-3.5 pb-2.5 pt-5 w-full text-base text-foreground bg-transparent border-0 appearance-none focus:outline-none focus:ring-0 peer disabled:opacity-50"
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

        {/* Password Field with Floating Label and show/hide toggle */}
        <div className="relative">
          <div className="relative border border-border/80 focus-within:border-primary rounded-lg transition-all duration-200 bg-secondary/30">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              placeholder=" "
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isPending}
              className="block pl-3.5 pr-11 pb-2.5 pt-5 w-full text-base text-foreground bg-transparent border-0 appearance-none focus:outline-none focus:ring-0 peer disabled:opacity-50"
              required
            />
            <label
              htmlFor="password"
              className="absolute text-xs sm:text-sm text-muted-foreground duration-200 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] px-3.5 peer-focus:text-primary peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 select-none pointer-events-none"
            >
              Senha
            </label>
            
            <button
              type="button"
              disabled={isPending}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none select-none transition-colors"
              aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs pt-1 select-none">
          <label className="flex items-center gap-2 text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={() => setRememberMe(!rememberMe)}
              className="rounded accent-primary w-4 h-4 cursor-pointer"
            />
            <span>Lembrar de mim</span>
          </label>

          <Link href="#" className="text-primary hover:underline font-semibold transition-all">
            Esqueceu a senha?
          </Link>
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
              Autenticando...
            </>
          ) : (
            <>
              Entrar
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

      {/* Social login action buttons */}
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isPending}
          className="w-full py-3 bg-secondary hover:bg-muted border border-border text-foreground font-semibold rounded-lg text-xs transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2.5 cursor-pointer shadow-md disabled:opacity-50"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
          </svg>
          <span>Continuar com Google</span>
        </button>

        <button
          type="button"
          onClick={handleFacebookSignIn}
          disabled={isPending}
          className="w-full py-3 bg-secondary hover:bg-muted border border-border text-foreground font-semibold rounded-lg text-xs transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2.5 cursor-pointer shadow-md disabled:opacity-50"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="#1877F2">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          <span>Continuar com Facebook</span>
        </button>
      </div>

      {/* Redirection link */}
      <div className="text-center text-xs text-muted-foreground border-t border-border/40 pt-4">
        Não tem uma conta?{' '}
        <Link href="/criar-conta" className="text-primary hover:underline font-semibold transition-all">
          Criar conta
        </Link>
      </div>

      {/* Legal notice — o aceite em si acontece em /aceite no primeiro login */}
      <p className="text-center text-[10px] text-muted-foreground/80 leading-relaxed">
        Ao continuar, você concorda com nossos{' '}
        <Link href="/termos-de-uso" target="_blank" className="text-primary hover:underline">
          Termos de Uso
        </Link>{' '}
        e nossa{' '}
        <Link href="/politica-de-privacidade" target="_blank" className="text-primary hover:underline">
          Política de Privacidade
        </Link>.
      </p>
    </div>
  )
}

function ParticlesBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { theme } = useTheme()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

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
        // Gold/amber tint for dark mode, subtle dark tint for light mode
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

export default function Entrar() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="relative min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-secondary/40 via-background to-background flex items-center justify-center p-4 overflow-hidden transition-colors duration-300">
      
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
            <p className="text-xs text-muted-foreground font-medium">Entre para continuar</p>
          </div>
        </div>

        {/* Card Form inside Suspense */}
        <Suspense fallback={
          <div className="glass p-10 rounded-2xl border border-border flex flex-col items-center justify-center py-12 gap-2 shadow-2xl">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Carregando formulário...</p>
          </div>
        }>
          <LoginForm />
        </Suspense>

        {/* Small footer back to site */}
        <div className="text-center">
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-all">
            ← Voltar para a página inicial
          </Link>
        </div>

      </div>
    </div>
  )
}
