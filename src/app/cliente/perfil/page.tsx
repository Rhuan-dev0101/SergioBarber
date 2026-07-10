'use client'

import React, { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Scissors, User, Phone, Mail, ArrowLeft, Check, Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { updateProfileAction } from '../actions'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

export default function ClientePerfil() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('') // email is read-only
  
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isPending, startTransition] = useTransition()
  
  const supabase = createClient()

  useEffect(() => {
    async function loadProfile() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/entrar')
        return
      }

      const { data: prof, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (prof) {
        setFullName(prof.full_name)
        setPhone(prof.phone || '')
        setEmail(prof.email)
      }
      setLoading(false)
    }

    loadProfile()
  }, [router, supabase])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!fullName || !phone) {
      setErrorMsg('Por favor, preencha todos os campos obrigatórios.')
      return
    }

    startTransition(async () => {
      const res = await updateProfileAction(fullName, phone)
      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg(res.message)
        setTimeout(() => {
          router.push('/cliente')
        }, 1500)
      }
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between">
        <Header />
        <div className="flex-grow flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Carregando seus dados cadastrais...</p>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      <Header />

      <main className="flex-grow py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b border-border/60">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-serif font-bold text-foreground">Dados Cadastrais</h1>
            </div>
            <Link
              href="/cliente"
              className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 bg-secondary border border-border px-3 py-1.5 rounded"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar
            </Link>
          </div>

          {/* Form Card */}
          <div className="glass p-6 sm:p-8 rounded-lg border border-border shadow-2xl space-y-6">
            {errorMsg && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded flex items-start gap-2 text-xs text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded flex items-start gap-2 text-xs text-emerald-500">
                <Check className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email (Read-Only) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">E-mail (Não editável)</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full pl-10 pr-4 py-2.5 bg-secondary/50 border border-border text-xs text-muted-foreground rounded outline-none cursor-not-allowed"
                  />
                </div>
              </div>

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
                    className="w-full pl-10 pr-4 py-2.5 bg-secondary border border-border focus:border-primary rounded text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all"
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
                    className="w-full pl-10 pr-4 py-2.5 bg-secondary border border-border focus:border-primary rounded text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all"
                    required
                  />
                </div>
              </div>

              {/* Save Button */}
              <button
                type="submit"
                disabled={isPending || !!successMsg}
                className="w-full py-3 bg-primary hover:bg-primary-hover text-primary-foreground font-bold rounded text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-4"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4.5 h-4.5 animate-spin text-primary-foreground" />
                    Salvando dados...
                  </>
                ) : (
                  <>
                    Salvar Alterações
                    <Check className="w-4 h-4 text-primary-foreground" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
