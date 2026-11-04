'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { Sun, Moon, Menu, X, User } from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'
import { GradientButton } from '@/components/ui/gradient-button'

export function Header() {
  const { theme, toggleTheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const pathname = usePathname()
  const router = useRouter()
  // supabase-js so e' carregado quando ha cookie de sessao (visitante anonimo nao paga os ~200 KB).
  const [supabase, setSupabase] = useState<ReturnType<typeof import('@/lib/supabase')['createClient']> | null>(null)

  useEffect(() => {
    if (!/(?:^|;\s*)sb-[^=]*-auth-token/.test(document.cookie)) {
      setLoading(false)
      return
    }
    let cancelled = false
    import('@/lib/supabase').then(m => {
      if (!cancelled) setSupabase(m.createClient())
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!supabase) return
    async function checkUser() {
      if (!supabase) return
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        // Fetch role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()
        if (profile) {
          setRole(profile.role)
        }
      } else {
        setUser(null)
        setRole(null)
      }
      setLoading(false)
    }

    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => {
            if (data) setRole(data.role)
          })
      } else {
        setUser(null)
        setRole(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  const handleLogout = async () => {
    const { createClient } = await import('@/lib/supabase')
    await createClient().auth.signOut()
    router.push('/')
  }

  const navLinks = [
    { label: 'Início', href: '/' },
    { label: 'Serviços', href: '/servicos' },
    { label: 'Barbeiros', href: '/barbeiros' },
    { label: 'Galeria', href: '/galeria' },
    { label: 'Localização', href: '/localizacao' },
  ]

  const isActive = (href: string) => {
    if (href === '/' && pathname !== '/') return false
    return pathname.startsWith(href)
  }

  return (
    <header className="sticky top-0 z-40 w-full glass border-b border-border/40 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center group select-none">
            <Image 
              src="/osanchez_logo_transparent.png" 
              alt="Osanchez Barbearia" 
              width={150} 
              height={38} 
              className="premium-logo object-contain"
              priority
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors relative py-1.5 after:absolute after:bottom-0 after:left-0 after:h-[1.5px] after:w-full after:origin-bottom-right after:scale-x-0 after:bg-primary after:transition-transform after:duration-300 hover:after:origin-bottom-left hover:after:scale-x-100 ${
                  isActive(link.href)
                    ? 'text-primary after:scale-x-100 after:origin-bottom-left'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {!loading && (
              <>
                {user ? (
                  <div className="flex items-center gap-3">
                    <GradientButton variant="variant" asChild className="px-4 py-2 min-w-[110px] text-xs h-9 rounded-md">
                      <Link href={role === 'admin' || role === 'barber' ? '/painel' : '/cliente'} className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" />
                        {role === 'admin' ? 'Painel Admin' : role === 'barber' ? 'Painel Barbeiro' : 'Minha Conta'}
                      </Link>
                    </GradientButton>
                    <button
                      onClick={handleLogout}
                      className="text-xs font-semibold text-destructive hover:underline cursor-pointer"
                    >
                      Sair
                    </button>
                  </div>
                ) : (
                  <GradientButton asChild className="px-5 py-2.5 min-w-[110px] text-xs h-9 rounded-md">
                    <Link href="/entrar">
                      Agendar Agora
                    </Link>
                  </GradientButton>
                )}
              </>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-secondary text-muted-foreground"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded hover:bg-secondary text-muted-foreground"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="md:hidden glass border-b border-border/40 animate-in slide-in-from-top duration-300">
          <div className="px-4 pt-2 pb-6 space-y-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={`block px-3 py-2.5 rounded text-base font-medium transition-colors ${
                  isActive(link.href)
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                {link.label}
              </Link>
            ))}

            <div className="pt-4 border-t border-border/40 space-y-3">
              {!loading && (
                <>
                  {user ? (
                    <div className="space-y-3">
                      <GradientButton variant="variant" asChild className="w-full py-3 text-sm">
                        <Link
                          href={role === 'admin' || role === 'barber' ? '/painel' : '/cliente'}
                          onClick={() => setIsOpen(false)}
                          className="flex items-center justify-center gap-2"
                        >
                          <User className="w-4 h-4" />
                          {role === 'admin' ? 'Painel Admin' : role === 'barber' ? 'Painel Barbeiro' : 'Minha Conta'}
                        </Link>
                      </GradientButton>
                      <button
                        onClick={() => {
                          handleLogout()
                          setIsOpen(false)}
                        }
                        className="w-full text-center py-2.5 text-sm font-semibold text-destructive hover:underline cursor-pointer"
                      >
                        Sair da Conta
                      </button>
                    </div>
                  ) : (
                    <GradientButton asChild className="w-full py-3 text-sm">
                      <Link
                        href="/entrar"
                        onClick={() => setIsOpen(false)}
                      >
                        Agendar Horário
                      </Link>
                    </GradientButton>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
