'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Scissors, User, ChevronDown, CheckCircle2, Clock, Wallet, DollarSign, CreditCard, QrCode, MoreHorizontal, Search, Phone } from 'lucide-react'

// ==================== 1. CUSTOM SERVICE SELECT ====================
export interface ServiceOption {
  id: string
  name: string
  price: number
  duration: number
}

interface CustomServiceSelectProps {
  services: ServiceOption[]
  selectedId: string
  onSelect: (id: string) => void
  disabled?: boolean
  placeholder?: string
}

export function CustomServiceSelect({
  services,
  selectedId,
  onSelect,
  disabled = false,
  placeholder = 'Selecione o serviço'
}: CustomServiceSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedService = services.find(s => s.id === selectedId)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-3 bg-secondary/60 hover:bg-secondary/90 border rounded-xl flex items-center justify-between transition-all cursor-pointer text-left shadow-sm ${
          isOpen ? 'border-primary ring-2 ring-primary/20' : 'border-border'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {selectedService ? (
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
              <Scissors className="w-4 h-4 rotate-45" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-bold text-sm text-foreground truncate">{selectedService.name}</span>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-primary font-bold">R$ {Number(selectedService.price).toFixed(2)}</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3 text-muted-foreground" /> {selectedService.duration} min
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 text-muted-foreground text-sm font-medium">
            <Scissors className="w-4 h-4 text-muted-foreground rotate-45" />
            <span>{placeholder}</span>
          </div>
        )}
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 ml-2 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : ''}`} />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-card border border-border/90 rounded-2xl p-2 shadow-2xl space-y-1.5 max-h-64 overflow-y-auto animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md">
          {services.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground text-center italic">
              Nenhum serviço disponível.
            </div>
          ) : (
            services.map((s) => {
              const isSelected = s.id === selectedId
              return (
                <div
                  key={s.id}
                  onClick={() => {
                    onSelect(s.id)
                    setIsOpen(false)
                  }}
                  className={`w-full p-3 rounded-xl transition-all flex items-center justify-between cursor-pointer border ${
                    isSelected
                      ? 'bg-primary/15 border-primary/50 text-foreground font-bold'
                      : 'bg-secondary/30 hover:bg-secondary/70 border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-secondary border border-border text-muted-foreground'
                    }`}>
                      <Scissors className="w-4 h-4 rotate-45" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className={`text-sm ${isSelected ? 'font-black text-foreground' : 'font-semibold text-foreground'}`}>
                        {s.name}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3 text-muted-foreground" /> {s.duration} minutos
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-primary/20 text-primary border border-primary/30">
                      R$ {Number(s.price).toFixed(2)}
                    </span>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// ==================== 2. CUSTOM BARBER SELECT ====================
export interface BarberOption {
  id: string
  full_name: string
  photo_url?: string | null
}

interface CustomBarberSelectProps {
  barbers: BarberOption[]
  selectedId: string
  onSelect: (id: string) => void
  disabled?: boolean
  placeholder?: string
}

export function CustomBarberSelect({
  barbers,
  selectedId,
  onSelect,
  disabled = false,
  placeholder = 'Selecione o barbeiro'
}: CustomBarberSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedBarber = barbers.find(b => b.id === selectedId)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-3 bg-secondary/60 hover:bg-secondary/90 border rounded-xl flex items-center justify-between transition-all cursor-pointer text-left shadow-sm ${
          isOpen ? 'border-primary ring-2 ring-primary/20' : 'border-border'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {selectedBarber ? (
          <div className="flex items-center gap-3 min-w-0">
            {selectedBarber.photo_url ? (
              <img
                src={selectedBarber.photo_url}
                alt={selectedBarber.full_name}
                className="w-7 h-7 rounded-full object-cover border border-primary/40 shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                {selectedBarber.full_name?.charAt(0)?.toUpperCase()}
              </div>
            )}
            <span className="font-bold text-sm text-foreground truncate">{selectedBarber.full_name}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 text-muted-foreground text-sm font-medium">
            <User className="w-4 h-4 text-muted-foreground" />
            <span>{placeholder}</span>
          </div>
        )}
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 ml-2 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-card border border-border/90 rounded-2xl p-2 shadow-2xl space-y-1 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md">
          {barbers.map((b) => {
            const isSelected = b.id === selectedId
            return (
              <div
                key={b.id}
                onClick={() => {
                  onSelect(b.id)
                  setIsOpen(false)
                }}
                className={`w-full p-2.5 rounded-xl transition-all flex items-center justify-between cursor-pointer border ${
                  isSelected
                    ? 'bg-primary/15 border-primary/50 text-foreground font-bold'
                    : 'bg-secondary/30 hover:bg-secondary/70 border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {b.photo_url ? (
                    <img
                      src={b.photo_url}
                      alt={b.full_name}
                      className="w-8 h-8 rounded-full object-cover border border-primary/40 shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                      {b.full_name?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm font-bold text-foreground truncate">{b.full_name}</span>
                </div>
                {isSelected && <CheckCircle2 className="w-4 h-4 text-primary shrink-0 ml-2" />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ==================== 3. CUSTOM GENERIC SELECT ====================
export interface GenericOption {
  value: string
  label: string
  icon?: React.ReactNode
}

interface CustomGenericSelectProps {
  options: GenericOption[]
  selectedValue: string
  onSelect: (val: string) => void
  disabled?: boolean
  placeholder?: string
}

export function CustomGenericSelect({
  options,
  selectedValue,
  onSelect,
  disabled = false,
  placeholder = 'Selecione uma opção'
}: CustomGenericSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOpt = options.find(o => o.value === selectedValue)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-3 bg-secondary/60 hover:bg-secondary/90 border rounded-xl flex items-center justify-between transition-all cursor-pointer text-left shadow-sm ${
          isOpen ? 'border-primary ring-2 ring-primary/20' : 'border-border'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {selectedOpt ? (
          <div className="flex items-center gap-2.5 min-w-0">
            {selectedOpt.icon}
            <span className="font-bold text-sm text-foreground truncate">{selectedOpt.label}</span>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm font-medium">{placeholder}</span>
        )}
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 ml-2 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-card border border-border/90 rounded-2xl p-2 shadow-2xl space-y-1 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md">
          {options.map((opt) => {
            const isSelected = opt.value === selectedValue
            return (
              <div
                key={opt.value}
                onClick={() => {
                  onSelect(opt.value)
                  setIsOpen(false)
                }}
                className={`w-full p-2.5 rounded-xl transition-all flex items-center justify-between cursor-pointer border ${
                  isSelected
                    ? 'bg-primary/15 border-primary/50 text-foreground font-bold'
                    : 'bg-secondary/30 hover:bg-secondary/70 border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {opt.icon}
                  <span className="text-sm font-bold text-foreground truncate">{opt.label}</span>
                </div>
                {isSelected && <CheckCircle2 className="w-4 h-4 text-primary shrink-0 ml-2" />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ==================== 4. CUSTOM CUSTOMER SELECT ====================
export interface CustomerOption {
  id: string
  full_name: string
  phone?: string | null
}

interface CustomCustomerSelectProps {
  customers: CustomerOption[]
  selectedId: string
  onSelect: (id: string, name: string) => void
  disabled?: boolean
  placeholder?: string
}

export function CustomCustomerSelect({
  customers,
  selectedId,
  onSelect,
  disabled = false,
  placeholder = 'Buscar ou selecionar cliente cadastrado...'
}: CustomCustomerSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedCustomer = customers.find(c => c.id === selectedId)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return customers
    const q = searchQuery.toLowerCase().trim()
    return customers.filter(c =>
      (c.full_name && c.full_name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q))
    )
  }, [customers, searchQuery])

  return (
    <div ref={containerRef} className="relative w-full space-y-1.5">
      {/* Search Input Box */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          disabled={disabled}
          placeholder="Buscar cliente por nome ou telefone..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            if (!isOpen) setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full pl-10 pr-4 py-2.5 bg-secondary/60 border border-border focus:border-primary rounded-xl text-sm outline-none text-foreground placeholder:text-muted-foreground transition-all"
        />
      </div>

      {/* Select Trigger Dropdown Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-3 bg-secondary/60 hover:bg-secondary/90 border rounded-xl flex items-center justify-between transition-all cursor-pointer text-left shadow-sm ${
          isOpen ? 'border-primary ring-2 ring-primary/20' : 'border-border'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {selectedCustomer ? (
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary font-bold text-xs shrink-0">
              {selectedCustomer.full_name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-bold text-sm text-foreground truncate">{selectedCustomer.full_name}</span>
              {selectedCustomer.phone && (
                <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                  <Phone className="w-3 h-3 text-muted-foreground" /> {selectedCustomer.phone}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 text-muted-foreground text-sm font-medium">
            <User className="w-4 h-4 text-muted-foreground" />
            <span>
              {filtered.length > 0 ? `Selecione o cliente (${filtered.length} encontrado${filtered.length > 1 ? 's' : ''})` : placeholder}
            </span>
          </div>
        )}
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 ml-2 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : ''}`} />
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-card border border-border/90 rounded-2xl p-2 shadow-2xl space-y-1 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md">
          {filtered.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground text-center italic">
              Nenhum cliente cadastrado encontrado com "{searchQuery}".
            </div>
          ) : (
            filtered.map((c) => {
              const isSelected = c.id === selectedId
              return (
                <div
                  key={c.id}
                  onClick={() => {
                    onSelect(c.id, c.full_name)
                    setIsOpen(false)
                  }}
                  className={`w-full p-2.5 rounded-xl transition-all flex items-center justify-between cursor-pointer border ${
                    isSelected
                      ? 'bg-primary/15 border-primary/50 text-foreground font-bold'
                      : 'bg-secondary/30 hover:bg-secondary/70 border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                      {c.full_name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-bold text-foreground truncate">{c.full_name}</span>
                      {c.phone && (
                        <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1">
                          <Phone className="w-3 h-3 text-muted-foreground" /> {c.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-primary shrink-0 ml-2" />}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
