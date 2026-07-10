'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  Scissors, LayoutDashboard, CalendarRange, Users, UserCog, 
  Sparkles, DollarSign, Settings, LogOut, Menu, X, User 
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

export function DashboardSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [role, setRole] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', session.user.id)
          .single()
        
        if (profile) {
          setRole(profile.role)
          setName(profile.full_name)
        }
      }
    }
    loadUser()
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const links = [
    { label: 'Visão Geral', href: '/painel', icon: LayoutDashboard, roles: ['admin', 'barber'] },
    { label: 'Agendamentos', href: '/painel/agendamentos', icon: CalendarRange, roles: ['admin', 'barber'] },
    { label: 'Clientes', href: '/painel/clientes', icon: Users, roles: ['admin', 'barber'] },
    { label: 'Editar Perfil', href: '/painel/perfil-barbeiro', icon: User, roles: ['admin', 'barber'] },
    { label: 'Funcionários', href: '/painel/funcionarios', icon: UserCog, roles: ['admin'] },
    { label: 'Serviços', href: '/painel/servicos', icon: Sparkles, roles: ['admin'] },
    { label: 'Financeiro', href: '/painel/financeiro', icon: DollarSign, roles: ['admin'] },
    { label: 'Configurações', href: '/painel/configuracoes', icon: Settings, roles: ['admin'] },
  ]

  const filteredLinks = links.filter(l => role && l.roles.includes(role))

  const isActive = (href: string) => {
    if (href === '/painel' && pathname !== '/painel') return false
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between bg-card border-b border-border px-4 py-3 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <Scissors className="w-5 h-5 text-primary rotate-45" />
          <span className="font-serif font-bold text-sm tracking-wider">OSANCHEZ PAINEL</span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 rounded hover:bg-secondary text-muted-foreground"
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar container */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-card border-r border-border flex flex-col justify-between z-30 transition-transform duration-300 md:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } md:sticky md:h-screen top-0`}>
        
        <div className="flex flex-col">
          {/* Logo Section */}
          <div className="p-6 border-b border-border/60 flex items-center gap-2">
            <div className="p-1.5 rounded bg-primary/10 text-primary">
              <Scissors className="w-5 h-5 rotate-45" />
            </div>
            <div className="flex flex-col">
              <span className="font-serif font-bold text-sm tracking-wider text-foreground">OSANCHEZ</span>
              <span className="text-[9px] uppercase font-semibold text-primary tracking-widest">Painel Administrativo</span>
            </div>
          </div>

          {/* User Profile Info */}
          <div className="p-5 border-b border-border/40 bg-secondary/20">
            <div className="text-xs font-semibold text-foreground truncate">{name}</div>
            <div className="text-[10px] text-primary uppercase font-bold tracking-wider mt-0.5">
              {role === 'admin' ? 'Administrador' : 'Barbeiro'}
            </div>
          </div>

          {/* Navigation links */}
          <nav className="p-4 space-y-1">
            {filteredLinks.map((link) => {
              const Icon = link.icon
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded text-xs font-semibold transition-all ${
                    isActive(link.href)
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive(link.href) ? 'text-primary-foreground' : 'text-primary'}`} />
                  {link.label}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Bottom Log out Button */}
        <div className="p-4 border-t border-border/40">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded text-xs font-semibold text-destructive hover:bg-destructive/10 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sair do Painel
          </button>
        </div>

      </aside>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
        />
      )}
    </>
  )
}
