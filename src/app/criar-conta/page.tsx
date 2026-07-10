'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Scissors, User, Mail, Phone, Lock, ArrowRight, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { signUpAction } from '@/app/auth/actions'

export default function CriarConta() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [acceptPrivacy, setAcceptPrivacy] = useState(false)

  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

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
        setSuccessMsg(response.message)
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/entrar')
        }, 3000)
      }
    })
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-secondary/40 via-background to-background flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-md space-y-6">
        
        {/* Logo and Intro */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 group mx-auto">
            <div className="p-2 rounded bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
              <Scissors className="w-6 h-6 rotate-45" />
            </div>
            <span className="font-serif font-bold text-xl tracking-wider text-foreground">
              OSANCHEZ
            </span>
          </Link>
          <h2 className="text-2xl font-serif font-bold text-foreground">Crie sua Conta</h2>
          <p className="text-xs text-muted-foreground">Cadastre-se para agendar seu horário premium</p>
        </div>

        {/* Card Form */}
        <div className="glass p-8 rounded-lg border border-border space-y-6 shadow-2xl">
          {errorMsg && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded flex items-start gap-2 text-xs text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded flex items-start gap-2 text-xs text-emerald-500">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label htmlFor="fullName" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome Completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="fullName"
                  type="text"
                  placeholder="Seu nome completo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={isPending || !!successMsg}
                  className="w-full pl-10 pr-4 py-2 bg-secondary border border-border focus:border-primary rounded text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  placeholder="exemplo@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isPending || !!successMsg}
                  className="w-full pl-10 pr-4 py-2 bg-secondary border border-border focus:border-primary rounded text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all"
                  required
                />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <label htmlFor="phone" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Telefone (WhatsApp)</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="phone"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isPending || !!successMsg}
                  className="w-full pl-10 pr-4 py-2 bg-secondary border border-border focus:border-primary rounded text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isPending || !!successMsg}
                  className="w-full pl-10 pr-4 py-2 bg-secondary border border-border focus:border-primary rounded text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all"
                  required
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Confirmar Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repita sua senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isPending || !!successMsg}
                  className="w-full pl-10 pr-4 py-2 bg-secondary border border-border focus:border-primary rounded text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all"
                  required
                />
              </div>
            </div>

            {/* Checkboxes */}
            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-2.5 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  disabled={isPending || !!successMsg}
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
                  disabled={isPending || !!successMsg}
                  className="mt-0.5 rounded accent-primary w-4 h-4 cursor-pointer"
                  required
                />
                <span>
                  Eu aceito a{' '}
                  <Link href="/politica-de-privacidade" target="_blank" className="text-primary hover:underline font-semibold">
                    Política de Privacidade (LGPD)
                  </Link>{' '}
                  e autorizo o tratamento dos meus dados cadastrais.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isPending || !!successMsg}
              className="w-full py-3 bg-primary hover:bg-primary-hover text-primary-foreground font-bold rounded text-xs transition-all shadow-md flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer mt-4"
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

          {/* Login Link */}
          <div className="text-center text-xs text-muted-foreground border-t border-border/40 pt-4">
            Já tem uma conta?{' '}
            <Link href="/entrar" className="text-primary hover:underline font-semibold">Entrar agora</Link>
          </div>
        </div>

        {/* Back link */}
        <div className="text-center">
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Voltar para a página inicial
          </Link>
        </div>

      </div>
    </div>
  )
}
