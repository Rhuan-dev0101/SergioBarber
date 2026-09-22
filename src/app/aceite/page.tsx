'use client'

import React, { Suspense, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { sanitizeRedirectPath } from '@/lib/utils'
import { recordLegalAcceptanceAction } from './actions'

function AceiteForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = sanitizeRedirectPath(searchParams.get('redirectTo'), '/cliente')

  const [checkingSession, setCheckingSession] = useState(true)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [acceptPrivacy, setAcceptPrivacy] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.replace(`/entrar?redirectTo=${encodeURIComponent(redirectTo)}`)
        return
      }
      setCheckingSession(false)
    })
  }, [router, redirectTo])

  const handleContinue = () => {
    setErrorMsg('')
    if (!acceptTerms || !acceptPrivacy) {
      setErrorMsg('Você precisa aceitar os Termos de Uso e a Política de Privacidade para continuar.')
      return
    }

    startTransition(async () => {
      const res = await recordLegalAcceptanceAction()
      if (!res.success) {
        setErrorMsg(res.message)
        return
      }
      router.push(redirectTo)
    })
  }

  if (checkingSession) {
    return (
      <div className="glass p-10 rounded-2xl border border-border flex flex-col items-center justify-center py-12 gap-2 shadow-2xl">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Verificando sua sessão...</p>
      </div>
    )
  }

  return (
    <div className="animated-gradient-card p-8 sm:p-10 rounded-2xl space-y-6 shadow-2xl relative overflow-hidden transition-all duration-300">
      <div className="flex items-center gap-2.5 text-primary">
        <ShieldCheck className="w-5 h-5" />
        <h1 className="font-serif font-bold text-lg text-foreground">Só falta um passo</h1>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Antes de continuar, precisamos que você confirme que leu e concorda com nossos termos.
      </p>

      {errorMsg && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2.5 text-xs text-destructive animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="space-y-3 pt-2 border-t border-border/40">
        <label className="flex items-start gap-2.5 text-xs text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="mt-0.5 rounded accent-primary w-4 h-4 cursor-pointer"
          />
          <span>
            Eu li e concordo com os{' '}
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
            className="mt-0.5 rounded accent-primary w-4 h-4 cursor-pointer"
          />
          <span>
            Eu li e concordo com a{' '}
            <Link href="/politica-de-privacidade" target="_blank" className="text-primary hover:underline font-semibold">
              Política de Privacidade
            </Link>{' '}
            e autorizo o tratamento dos meus dados.
          </span>
        </label>
      </div>

      <button
        type="button"
        onClick={handleContinue}
        disabled={isPending}
        className="w-full py-3 bg-primary hover:bg-primary-hover text-primary-foreground font-bold rounded-lg text-xs transition-all shadow-md hover:shadow-lg disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
      >
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-primary-foreground" />
            Confirmando...
          </>
        ) : (
          'Continuar'
        )}
      </button>
    </div>
  )
}

export default function Aceite() {
  return (
    <div className="relative min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-secondary/40 via-background to-background flex items-center justify-center p-4 py-12 transition-colors duration-300">
      <div className="w-full max-w-md space-y-6 z-10 relative">
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
        </div>

        <Suspense
          fallback={
            <div className="glass p-10 rounded-2xl border border-border flex flex-col items-center justify-center py-12 gap-2 shadow-2xl">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Carregando...</p>
            </div>
          }
        >
          <AceiteForm />
        </Suspense>
      </div>
    </div>
  )
}
