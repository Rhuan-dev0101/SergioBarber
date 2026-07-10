'use client'

import React, { useState, useTransition, useEffect, Suspense, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Scissors, Mail, Lock, ArrowRight, AlertCircle, Loader2, Eye, EyeOff, Sun, Moon } from 'lucide-react'
import { loginAction } from '@/app/auth/actions'
import { createClient } from '@/lib/supabase'
import { useTheme } from '@/components/ThemeProvider'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || ''

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
    <div className="glass p-8 sm:p-10 rounded-2xl border border-border/80 space-y-6 shadow-2xl relative overflow-hidden backdrop-blur-md transition-all duration-300">
      
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
              className="block pl-3.5 pr-11 pb-2.5 pt-5 w-full text-sm text-foreground bg-transparent border-0 appearance-none focus:outline-none focus:ring-0 peer disabled:opacity-50"
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

      {/* Redirection link */}
      <div className="text-center text-xs text-muted-foreground border-t border-border/40 pt-4">
        Não tem uma conta?{' '}
        <Link href="/criar-conta" className="text-primary hover:underline font-semibold transition-all">
          Criar conta
        </Link>
      </div>
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
          <Link href="/" className="inline-flex items-center gap-2 group mx-auto hover:scale-105 transition-all duration-300">
            <div className="p-2 rounded bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 shadow-md">
              <Scissors className="w-6 h-6 rotate-45" />
            </div>
            <span className="font-serif font-bold text-xl tracking-wider text-foreground">
              OSANCHEZ
            </span>
          </Link>
          <div className="space-y-1">
            <h1 className="text-3xl font-serif font-bold text-foreground tracking-tight">Osanchez Barbearia</h1>
            <p className="text-xs text-muted-foreground">Entre para continuar</p>
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
