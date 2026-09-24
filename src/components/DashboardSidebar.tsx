'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  Scissors, LayoutDashboard, CalendarRange, Users, UserCog,
  Sparkles, DollarSign, Settings, LogOut, Menu, X, User, Image as ImageIcon,
  Crown, Star, History, Repeat, ChevronDown, ChevronRight, Loader2
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  roles: string[]
}

interface NavGroup {
  id: string
  title: string
  icon: React.ElementType
  items: NavItem[]
}

export function DashboardSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [role, setRole] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    agenda: false,
    clientes: false,
    gestao: false
  })
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

  // Load expanded state from localStorage + auto-expand active group
  useEffect(() => {
    let savedState: Record<string, boolean> = {}
    try {
      const raw = localStorage.getItem('osanchez_sidebar_groups')
      if (raw) {
        savedState = JSON.parse(raw)
      }
    } catch (e) {
      // ignore JSON parse error
    }

    // Auto-expand group if current pathname belongs to it
    const activeState: Record<string, boolean> = { ...savedState }
    
    if (['/painel/agendamentos', '/painel/pacotes', '/painel/reservas-recorrentes'].some(p => pathname.startsWith(p))) {
      activeState.agenda = true
    }
    if (['/painel/clientes', '/painel/historico-clientes', '/painel/avaliacoes'].some(p => pathname.startsWith(p))) {
      activeState.clientes = true
    }
    if (['/painel/funcionarios', '/painel/servicos', '/painel/meus-servicos', '/painel/galeria', '/painel/configuracoes', '/painel/perfil-barbeiro'].some(p => pathname.startsWith(p))) {
      activeState.gestao = true
    }

    setOpenGroups(activeState)
  }, [pathname])

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => {
      const next = { ...prev, [groupId]: !prev[groupId] }
      try {
        localStorage.setItem('osanchez_sidebar_groups', JSON.stringify(next))
      } catch (e) {}
      return next
    })
  }

  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.push('/')
  }

  const isActive = (href: string) => {
    if (href === '/painel' && pathname !== '/painel') return false
    return pathname.startsWith(href)
  }

  // Top level direct links
  const topLevelLinks: NavItem[] = [
    { label: 'Visão Geral', href: '/painel', icon: LayoutDashboard, roles: ['admin', 'barber'] },
  ]

  const financeiroLink: NavItem = {
    label: 'Financeiro', href: '/painel/financeiro', icon: DollarSign, roles: ['admin']
  }

  // Groups
  const groups: NavGroup[] = [
    {
      id: 'agenda',
      title: 'Agenda',
      icon: CalendarRange,
      items: [
        { label: 'Agendamentos', href: '/painel/agendamentos', icon: CalendarRange, roles: ['admin', 'barber'] },
        { label: 'Pacotes', href: '/painel/pacotes', icon: Crown, roles: ['admin'] },
        { label: 'Reservas Fixas', href: '/painel/reservas-recorrentes', icon: Repeat, roles: ['admin'] },
      ]
    },
    {
      id: 'clientes',
      title: 'Clientes',
      icon: Users,
      items: [
        { label: 'Base de Clientes', href: '/painel/clientes', icon: Users, roles: ['admin', 'barber'] },
        { label: 'Meu Histórico', href: '/painel/historico-clientes', icon: History, roles: ['admin', 'barber'] },
        { label: 'Avaliações', href: '/painel/avaliacoes', icon: Star, roles: ['admin'] },
      ]
    },
    {
      id: 'gestao',
      title: 'Gestão',
      icon: Settings,
      items: [
        { label: 'Funcionários', href: '/painel/funcionarios', icon: UserCog, roles: ['admin'] },
        { label: 'Serviços', href: '/painel/servicos', icon: Sparkles, roles: ['admin'] },
        { label: 'Meus Serviços', href: '/painel/meus-servicos', icon: Scissors, roles: ['admin', 'barber'] },
        { label: 'Galeria', href: '/painel/galeria', icon: ImageIcon, roles: ['admin'] },
        { label: 'Configurações', href: '/painel/configuracoes', icon: Settings, roles: ['admin'] },
        { label: 'Editar Perfil', href: '/painel/perfil-barbeiro', icon: User, roles: ['admin', 'barber'] },
      ]
    }
  ]

  const isRoleAllowed = (roles: string[]) => role ? roles.includes(role) : false

  return (
    <>
      {/* Mobile Top Header Bar */}
      <div className="md:hidden w-full flex items-center justify-between bg-card border-b border-border px-4 py-3 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <Scissors className="w-5 h-5 text-primary rotate-45" />
          <span className="font-serif font-bold text-sm tracking-wider">OSANCHEZ PAINEL</span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-lg bg-secondary hover:bg-muted text-foreground transition-colors cursor-pointer"
          aria-label="Menu de Navegação"
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar container */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-card border-r border-border flex flex-col justify-between z-40 transition-transform duration-300 md:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } md:sticky md:h-screen top-0`}>
        
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Logo Section */}
          <div className="p-5 border-b border-border/60 flex items-center gap-2.5 shrink-0">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Scissors className="w-5 h-5 rotate-45" />
            </div>
            <div className="flex flex-col">
              <span className="font-serif font-bold text-sm tracking-wider text-foreground">OSANCHEZ</span>
              <span className="text-[9px] uppercase font-semibold text-primary tracking-widest">Painel Administrativo</span>
            </div>
          </div>

          {/* User Profile Info */}
          <div className="px-5 py-3.5 border-b border-border/40 bg-secondary/20 shrink-0">
            <div className="text-xs font-semibold text-foreground truncate">{name || 'Carregando...'}</div>
            <div className="text-[10px] text-primary uppercase font-bold tracking-wider mt-0.5">
              {role === 'admin' ? 'Administrador' : role === 'barber' ? 'Barbeiro' : ''}
            </div>
          </div>

          {/* Navigation links - Scrollable */}
          <nav className="p-3.5 space-y-2 overflow-y-auto flex-1 scrollbar-thin">
            
            {/* 1. Visão Geral (Always visible top-level item) */}
            {topLevelLinks.filter(l => isRoleAllowed(l.roles)).map((link) => {
              const Icon = link.icon
              const active = isActive(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all min-h-[42px] ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-primary-foreground' : 'text-primary'}`} />
                  <span>{link.label}</span>
                </Link>
              )
            })}

            {/* 2. Group: Agenda */}
            {(() => {
              const grp = groups.find(g => g.id === 'agenda')!
              const allowedItems = grp.items.filter(i => isRoleAllowed(i.roles))
              if (allowedItems.length === 0) return null

              const isExpanded = !!openGroups[grp.id]
              const hasActiveChild = allowedItems.some(i => isActive(i.href))
              const GroupIcon = grp.icon

              return (
                <div key={grp.id} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleGroup(grp.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[42px] ${
                      hasActiveChild && !isExpanded
                        ? 'bg-primary/10 text-primary border border-primary/25'
                        : 'text-foreground/90 hover:bg-secondary/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <GroupIcon className="w-4 h-4 text-primary shrink-0" />
                      <span>{grp.title}</span>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="pl-3.5 space-y-1 border-l-2 border-primary/20 ml-3.5 pt-0.5">
                      {allowedItems.map((item) => {
                        const ItemIcon = item.icon
                        const active = isActive(item.href)
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all min-h-[38px] ${
                              active
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                            }`}
                          >
                            <ItemIcon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-primary-foreground' : 'text-primary/70'}`} />
                            <span>{item.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* 3. Group: Clientes */}
            {(() => {
              const grp = groups.find(g => g.id === 'clientes')!
              const allowedItems = grp.items.filter(i => isRoleAllowed(i.roles))
              if (allowedItems.length === 0) return null

              const isExpanded = !!openGroups[grp.id]
              const hasActiveChild = allowedItems.some(i => isActive(i.href))
              const GroupIcon = grp.icon

              return (
                <div key={grp.id} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleGroup(grp.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[42px] ${
                      hasActiveChild && !isExpanded
                        ? 'bg-primary/10 text-primary border border-primary/25'
                        : 'text-foreground/90 hover:bg-secondary/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <GroupIcon className="w-4 h-4 text-primary shrink-0" />
                      <span>{grp.title}</span>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="pl-3.5 space-y-1 border-l-2 border-primary/20 ml-3.5 pt-0.5">
                      {allowedItems.map((item) => {
                        const ItemIcon = item.icon
                        const active = isActive(item.href)
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all min-h-[38px] ${
                              active
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                            }`}
                          >
                            <ItemIcon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-primary-foreground' : 'text-primary/70'}`} />
                            <span>{item.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* 4. Financeiro (Top level item, no group header) */}
            {isRoleAllowed(financeiroLink.roles) && (() => {
              const Icon = financeiroLink.icon
              const active = isActive(financeiroLink.href)
              return (
                <Link
                  key={financeiroLink.href}
                  href={financeiroLink.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all min-h-[42px] ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-primary-foreground' : 'text-primary'}`} />
                  <span>{financeiroLink.label}</span>
                </Link>
              )
            })()}

            {/* 5. Group: Gestão */}
            {(() => {
              const grp = groups.find(g => g.id === 'gestao')!
              const allowedItems = grp.items.filter(i => isRoleAllowed(i.roles))
              if (allowedItems.length === 0) return null

              const isExpanded = !!openGroups[grp.id]
              const hasActiveChild = allowedItems.some(i => isActive(i.href))
              const GroupIcon = grp.icon

              return (
                <div key={grp.id} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleGroup(grp.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[42px] ${
                      hasActiveChild && !isExpanded
                        ? 'bg-primary/10 text-primary border border-primary/25'
                        : 'text-foreground/90 hover:bg-secondary/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <GroupIcon className="w-4 h-4 text-primary shrink-0" />
                      <span>{grp.title}</span>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="pl-3.5 space-y-1 border-l-2 border-primary/20 ml-3.5 pt-0.5">
                      {allowedItems.map((item) => {
                        const ItemIcon = item.icon
                        const active = isActive(item.href)
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all min-h-[38px] ${
                              active
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                            }`}
                          >
                            <ItemIcon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-primary-foreground' : 'text-primary/70'}`} />
                            <span>{item.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()}

          </nav>
        </div>

        {/* Bottom Log out Button */}
        <div className="p-3.5 border-t border-border/40 shrink-0">
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold text-destructive hover:bg-destructive/10 transition-all cursor-pointer min-h-[42px] disabled:opacity-50"
          >
            {loggingOut ? (
              <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
            ) : (
              <LogOut className="w-4 h-4 shrink-0" />
            )}
            <span>{loggingOut ? 'Saindo...' : 'Sair do Painel'}</span>
          </button>
        </div>

      </aside>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden animate-in fade-in duration-150"
        />
      )}
    </>
  )
}
