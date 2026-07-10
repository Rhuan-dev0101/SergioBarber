'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { 
  Scissors, User, Shield, Clock, Calendar, Check, AlertCircle, 
  CheckCircle2, Loader2, Save, Plus, X, Lock, Play, Pause, Trash2, Camera 
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { DashboardSidebar } from '@/components/DashboardSidebar'
import { 
  updateBarberStatusAction, 
  updateBarberWorkingHoursAction, 
  addBlockedTimeAction, 
  addDayOffAction 
} from './actions'
import { updateBarberProfileAction } from '../perfil-barbeiro/actions'
import { GradientButton } from '@/components/ui/gradient-button'

export default function PainelFuncionarios() {
  const router = useRouter()
  const [barbers, setBarbers] = useState<any[]>([])
  const [selectedBarber, setSelectedBarber] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'hours' | 'blocks' | 'days_off' | 'profile'>('hours')
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)

  // Form inputs: Profile Data
  const [editBio, setEditBio] = useState('')
  const [editAboutQuote, setEditAboutQuote] = useState('')
  const [editExperienceYears, setEditExperienceYears] = useState(0)
  const [editSpecialtiesText, setEditSpecialtiesText] = useState('')
  const [editPhotoUrl, setEditPhotoUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // Sub-data states for selected barber
  const [workingHours, setWorkingHours] = useState<any[]>([])
  const [blockedTimes, setBlockedTimes] = useState<any[]>([])
  const [daysOff, setDaysOff] = useState<any[]>([])

  // Form inputs: Working Hours
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number>(2) // Tuesday default
  const [isClosed, setIsClosed] = useState(false)
  const [morningStart, setMorningStart] = useState('09:00')
  const [morningEnd, setMorningEnd] = useState('13:00')
  const [afternoonStart, setAfternoonStart] = useState('14:00')
  const [afternoonEnd, setAfternoonEnd] = useState('22:00')

  // Form inputs: Blocks
  const [blockStart, setBlockStart] = useState('')
  const [blockEnd, setBlockEnd] = useState('')
  const [blockReason, setBlockReason] = useState('')

  // Form inputs: Days Off
  const [dayOffDate, setDayOffDate] = useState('')
  const [dayOffReason, setDayOffReason] = useState('')

  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isPending, startTransition] = useTransition()

  const supabase = createClient()

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/entrar')
        return
      }

      // Check role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()
      
      if (!profile || (profile.role !== 'admin' && profile.role !== 'barber')) {
        router.push('/cliente')
        return
      }
      setUserRole(profile.role)

      // Fetch barbers
      const { data: dbBarbers } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, barbers (is_active, bio, about_quote, experience_years, specialties, photo_url)')
        .eq('role', 'barber')
      
      if (dbBarbers) {
        const formatted = dbBarbers.map((b: any) => ({
          id: b.id,
          full_name: b.full_name,
          email: b.email,
          role: b.role,
          isActive: b.barbers?.is_active ?? true,
          bio: b.barbers?.bio ?? '',
          about_quote: b.barbers?.about_quote ?? '',
          experience_years: b.barbers?.experience_years ?? 0,
          specialties: b.barbers?.specialties ?? [],
          photo_url: b.barbers?.photo_url ?? null
        }))
        setBarbers(formatted)
      }
    } catch (err) {
      console.error('Error fetching barbers data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Load details whenever selectedBarber changes
  useEffect(() => {
    if (!selectedBarber) return
    loadBarberDetails()
  }, [selectedBarber])

  const loadBarberDetails = async () => {
    if (!selectedBarber) return
    setErrorMsg('')
    setSuccessMsg('')
    
    // Set edit profile states
    setEditBio(selectedBarber.bio || '')
    setEditAboutQuote(selectedBarber.about_quote || '')
    setEditExperienceYears(selectedBarber.experience_years || 0)
    setEditSpecialtiesText(selectedBarber.specialties ? selectedBarber.specialties.join(', ') : '')
    setEditPhotoUrl(selectedBarber.photo_url || null)

    try {
      // 1. Load working hours
      const { data: hours } = await supabase
        .from('barber_working_hours')
        .select('*')
        .eq('barber_id', selectedBarber.id)
      setWorkingHours(hours || [])

      // 2. Load blocked times (future blocks)
      const { data: blocks } = await supabase
        .from('blocked_times')
        .select('*')
        .eq('barber_id', selectedBarber.id)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
      setBlockedTimes(blocks || [])

      // 3. Load days off (future days off)
      const { data: off } = await supabase
        .from('days_off')
        .select('*')
        .eq('barber_id', selectedBarber.id)
        .gte('date', new Date().toLocaleDateString('en-US'))
        .order('date', { ascending: true })
      setDaysOff(off || [])

      // Set default day selector for form
      handleLoadDayForm(selectedDayOfWeek, hours || [])
    } catch (err) {
      console.error('Error loading details:', err)
    }
  }

  const handleLoadDayForm = (dayNum: number, hoursList = workingHours) => {
    setSelectedDayOfWeek(dayNum)
    const current = hoursList.find(h => h.day_of_week === dayNum)
    if (current) {
      setIsClosed(current.is_closed)
      const slots = current.slots as Array<{ start: string; end: string }>
      if (slots && slots.length > 0) {
        setMorningStart(slots[0]?.start || '09:00')
        setMorningEnd(slots[0]?.end || '13:00')
        setAfternoonStart(slots[1]?.start || '14:00')
        setAfternoonEnd(slots[1]?.end || '22:00')
      } else {
        setMorningStart('09:00')
        setMorningEnd('13:00')
        setAfternoonStart('14:00')
        setAfternoonEnd('22:00')
      }
    } else {
      setIsClosed(false)
      setMorningStart('09:00')
      setMorningEnd('13:00')
      setAfternoonStart('14:00')
      setAfternoonEnd('22:00')
    }
  }

  const handleToggleStatus = (barber: any) => {
    if (userRole !== 'admin') {
      setErrorMsg('Apenas administradores podem desativar funcionários.')
      return
    }

    startTransition(async () => {
      const res = await updateBarberStatusAction(barber.id, !barber.isActive)
      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg(res.message)
        setBarbers(prev => prev.map(b => b.id === barber.id ? { ...b, isActive: !b.isActive } : b))
        if (selectedBarber?.id === barber.id) {
          setSelectedBarber((prev: any) => ({ ...prev, isActive: !prev.isActive }))
        }
      }
    })
  }

  const handleSaveWorkingHours = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    const slots: Array<{ start: string; end: string }> = []
    if (!isClosed) {
      if (morningStart && morningEnd) {
        slots.push({ start: morningStart, end: morningEnd })
      }
      if (afternoonStart && afternoonEnd) {
        slots.push({ start: afternoonStart, end: afternoonEnd })
      }
    }

    startTransition(async () => {
      const res = await updateBarberWorkingHoursAction(
        selectedBarber.id,
        selectedDayOfWeek,
        isClosed,
        slots
      )

      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg(res.message)
        loadBarberDetails()
      }
    })
  }

  const handleAddBlock = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!blockStart || !blockEnd || !blockReason) {
      setErrorMsg('Todos os campos são obrigatórios.')
      return
    }

    startTransition(async () => {
      // Inputs will be local timezone formatted to ISO
      const res = await addBlockedTimeAction(
        selectedBarber.id,
        new Date(blockStart).toISOString(),
        new Date(blockEnd).toISOString(),
        blockReason
      )

      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg(res.message)
        setBlockStart('')
        setBlockEnd('')
        setBlockReason('')
        loadBarberDetails()
      }
    })
  }

  const handleAddDayOff = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!dayOffDate || !dayOffReason) {
      setErrorMsg('Todos os campos são obrigatórios.')
      return
    }

    startTransition(async () => {
      const res = await addDayOffAction(selectedBarber.id, dayOffDate, dayOffReason)
      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg(res.message)
        setDayOffDate('')
        setDayOffReason('')
        loadBarberDetails()
      }
    })
  }

  const handleDeleteTimeItem = async (table: 'blocked_times' | 'days_off', id: string) => {
    if (!confirm('Deseja realmente remover este registro?')) return
    setErrorMsg('')
    setSuccessMsg('')
    
    try {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) {
        setErrorMsg('Erro ao deletar registro.')
      } else {
        setSuccessMsg('Registro removido com sucesso.')
        loadBarberDetails()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleEditPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedBarber || !e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    
    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('A imagem deve ter no máximo 2MB.')
      return
    }

    setUploadingAvatar(true)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${selectedBarber.id}-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      const { error } = await supabase.storage
        .from('barber-photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (error) {
        throw new Error('Certifique-se de que o bucket "barber-photos" foi criado no Supabase console.')
      }

      const { data: { publicUrl } } = supabase.storage
        .from('barber-photos')
        .getPublicUrl(filePath)

      setEditPhotoUrl(publicUrl)
      setSuccessMsg('Foto de perfil enviada. Salve o perfil para confirmar.')
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'Erro ao fazer upload da imagem.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleSaveProfileData = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBarber) return
    setErrorMsg('')
    setSuccessMsg('')

    const specialties = editSpecialtiesText
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0)

    startTransition(async () => {
      const res = await updateBarberProfileAction(selectedBarber.id, {
        bio: editBio,
        about_quote: editAboutQuote,
        experience_years: Number(editExperienceYears || 0),
        specialties,
        photo_url: editPhotoUrl
      })

      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg('Perfil atualizado com sucesso!')
        // Reload list to get updated profiles list
        loadData()
      }
    })
  }

  const getDayName = (dayNum: number) => {
    const names = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
    return names[dayNum]
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col md:flex-row justify-center items-center gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Carregando painel de funcionários...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <DashboardSidebar />

      <main className="flex-grow p-6 sm:p-8 space-y-6 overflow-y-auto">
        {/* Title */}
        <div className="border-b border-border/40 pb-4">
          <h1 className="text-2xl font-serif font-bold text-foreground">Gerenciar Funcionários</h1>
          <p className="text-xs text-muted-foreground">Configure a equipe de barbeiros, horários de expediente, pausas de almoço e dias de folga</p>
        </div>

        {/* Master Detail Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left: Barbers list */}
          <div className="lg:col-span-4 space-y-4">
            <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Profissionais Cadastrados</h3>
            
            <div className="glass border border-border rounded-lg overflow-hidden divide-y divide-border/40">
              {barbers.map((b) => (
                <div 
                  key={b.id}
                  className={`p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-colors ${
                    selectedBarber?.id === b.id ? 'bg-primary/5' : ''
                  }`}
                >
                  <button 
                    onClick={() => setSelectedBarber(b)}
                    className="flex items-center gap-2.5 text-left flex-grow cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-secondary/80 text-primary flex items-center justify-center font-serif font-bold shrink-0">
                      {b.full_name.charAt(0)}
                    </div>
                    <div className="truncate">
                      <h4 className="font-serif font-bold text-sm text-foreground truncate">{b.full_name}</h4>
                      <span className="text-[10px] text-muted-foreground">{b.email}</span>
                    </div>
                  </button>

                  <button
                    onClick={() => handleToggleStatus(b)}
                    disabled={userRole !== 'admin' || isPending}
                    className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase transition-all cursor-pointer ${
                      b.isActive 
                        ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' 
                        : 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                    }`}
                  >
                    {b.isActive ? 'Ativo' : 'Inativo'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Selected Barber configuration */}
          <div className="lg:col-span-8">
            {selectedBarber ? (
              <div className="glass p-6 sm:p-8 rounded-lg border border-border space-y-6 shadow-xl">
                
                {/* Header profile */}
                <div className="flex justify-between items-center border-b border-border/40 pb-4">
                  <div>
                    <h2 className="text-xl font-serif font-bold text-foreground">{selectedBarber.full_name}</h2>
                    <span className="text-[10px] uppercase font-bold text-primary">Configuração de Agenda</span>
                  </div>
                  <button
                    onClick={() => setSelectedBarber(null)}
                    className="text-muted-foreground hover:text-foreground p-1 hover:bg-secondary rounded"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {errorMsg && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded flex items-start gap-2 text-xs text-destructive">
                    <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded flex items-start gap-2 text-xs text-emerald-500">
                    <CheckCircle2 className="w-4.5 h-4.5 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* Tabs */}
                <div className="flex gap-2 border-b border-border pb-2 text-xs overflow-x-auto">
                  <button
                    onClick={() => setActiveTab('hours')}
                    className={`px-3 py-1.5 font-bold rounded-md transition-all shrink-0 cursor-pointer ${
                      activeTab === 'hours' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Horários de Expediente
                  </button>
                  <button
                    onClick={() => setActiveTab('blocks')}
                    className={`px-3 py-1.5 font-bold rounded-md transition-all shrink-0 cursor-pointer ${
                      activeTab === 'blocks' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Bloqueios (Pausas)
                  </button>
                  <button
                    onClick={() => setActiveTab('days_off')}
                    className={`px-3 py-1.5 font-bold rounded-md transition-all shrink-0 cursor-pointer ${
                      activeTab === 'days_off' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Folgas / Férias
                  </button>
                  <button
                    onClick={() => setActiveTab('profile')}
                    className={`px-3 py-1.5 font-bold rounded-md transition-all shrink-0 cursor-pointer ${
                      activeTab === 'profile' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Dados do Perfil
                  </button>
                </div>

                {/* TAB 1: WORKING HOURS FORM */}
                {activeTab === 'hours' && (
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <h4 className="text-xs uppercase font-bold text-foreground">Grade Semanal de Trabalho</h4>
                      <p className="text-[10px] text-muted-foreground">Configure os horários de início e término por dia da semana</p>
                    </div>

                    <form onSubmit={handleSaveWorkingHours} className="space-y-4">
                      {/* Day select grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
                        {[0, 1, 2, 3, 4, 5, 6].map((dayNum) => (
                          <button
                            key={dayNum}
                            type="button"
                            onClick={() => handleLoadDayForm(dayNum)}
                            className={`p-2 rounded text-center border text-[11px] font-semibold transition-all cursor-pointer ${
                              selectedDayOfWeek === dayNum
                                ? 'border-primary bg-primary text-primary-foreground'
                                : workingHours.find(h => h.day_of_week === dayNum)?.is_closed
                                ? 'border-destructive bg-destructive/5 text-destructive'
                                : 'border-border bg-secondary/20 text-foreground'
                            }`}
                          >
                            {getDayName(dayNum).substring(0, 3)}
                          </button>
                        ))}
                      </div>

                      <div className="p-4 bg-secondary/20 border border-border/60 rounded-md space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-foreground uppercase">{getDayName(selectedDayOfWeek)}</span>
                          
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isClosed}
                              onChange={(e) => setIsClosed(e.target.checked)}
                              className="rounded accent-primary w-4 h-4 cursor-pointer"
                            />
                            <span>Fechar estabelecimento neste dia</span>
                          </label>
                        </div>

                        {!isClosed && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Morning Shift */}
                            <div className="space-y-2 border border-border/40 p-3 rounded">
                              <h5 className="text-[10px] uppercase font-bold text-primary">Turno Manhã</h5>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <label className="space-y-1">
                                  <span className="text-[10px] text-muted-foreground">Início</span>
                                  <input type="time" value={morningStart} onChange={(e) => setMorningStart(e.target.value)} className="w-full p-2 bg-secondary border border-border rounded outline-none text-foreground" />
                                </label>
                                <label className="space-y-1">
                                  <span className="text-[10px] text-muted-foreground">Término</span>
                                  <input type="time" value={morningEnd} onChange={(e) => setMorningEnd(e.target.value)} className="w-full p-2 bg-secondary border border-border rounded outline-none text-foreground" />
                                </label>
                              </div>
                            </div>

                            {/* Afternoon/Evening Shift */}
                            <div className="space-y-2 border border-border/40 p-3 rounded">
                              <h5 className="text-[10px] uppercase font-bold text-primary">Turno Tarde</h5>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <label className="space-y-1">
                                  <span className="text-[10px] text-muted-foreground">Início</span>
                                  <input type="time" value={afternoonStart} onChange={(e) => setAfternoonStart(e.target.value)} className="w-full p-2 bg-secondary border border-border rounded outline-none text-foreground" />
                                </label>
                                <label className="space-y-1">
                                  <span className="text-[10px] text-muted-foreground">Término</span>
                                  <input type="time" value={afternoonEnd} onChange={(e) => setAfternoonEnd(e.target.value)} className="w-full p-2 bg-secondary border border-border rounded outline-none text-foreground" />
                                </label>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={isPending}
                        className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-primary-foreground font-bold rounded text-xs transition-all shadow flex items-center justify-center gap-1.5 ml-auto cursor-pointer"
                      >
                        <Save className="w-4 h-4 text-primary-foreground" />
                        Salvar Horários
                      </button>

                    </form>
                  </div>
                )}

                {/* TAB 2: BLOCKED TIMES FORM */}
                {activeTab === 'blocks' && (
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <h4 className="text-xs uppercase font-bold text-foreground">Bloquear Agenda Temporariamente</h4>
                      <p className="text-[10px] text-muted-foreground">Adicione intervalos personalizados (almoço, reuniões, pausas) na agenda</p>
                    </div>

                    {/* Block Add Form */}
                    <form onSubmit={handleAddBlock} className="p-4 bg-secondary/20 border border-border rounded-md grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                      <label className="space-y-1 text-xs text-muted-foreground">
                        <span className="text-[10px] font-bold">Data/Hora Início</span>
                        <input
                          type="datetime-local"
                          value={blockStart}
                          onChange={(e) => setBlockStart(e.target.value)}
                          disabled={isPending}
                          className="w-full p-2 bg-secondary border border-border rounded text-foreground text-xs"
                          required
                        />
                      </label>
                      <label className="space-y-1 text-xs text-muted-foreground">
                        <span className="text-[10px] font-bold">Data/Hora Fim</span>
                        <input
                          type="datetime-local"
                          value={blockEnd}
                          onChange={(e) => setBlockEnd(e.target.value)}
                          disabled={isPending}
                          className="w-full p-2 bg-secondary border border-border rounded text-foreground text-xs"
                          required
                        />
                      </label>
                      <label className="space-y-1 text-xs text-muted-foreground">
                        <span className="text-[10px] font-bold">Motivo (Ex: Almoço)</span>
                        <input
                          type="text"
                          placeholder="Reunião, Almoço..."
                          value={blockReason}
                          onChange={(e) => setBlockReason(e.target.value)}
                          disabled={isPending}
                          className="w-full p-2 bg-secondary border border-border rounded text-foreground text-xs"
                          required
                        />
                      </label>
                      
                      <button
                        type="submit"
                        disabled={isPending}
                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold rounded transition-all flex items-center justify-center gap-1 cursor-pointer sm:col-span-3 ml-auto shadow"
                      >
                        <Plus className="w-4 h-4 text-primary-foreground" />
                        Confirmar Bloqueio
                      </button>
                    </form>

                    {/* Existing blocks list */}
                    <div className="space-y-3">
                      <h5 className="text-[11px] uppercase font-bold text-foreground">Bloqueios Futuros Programados</h5>
                      {blockedTimes.length > 0 ? (
                        <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                          {blockedTimes.map((block) => (
                            <div 
                              key={block.id}
                              className="flex justify-between items-center p-3 rounded bg-secondary/35 border border-border/50 text-xs"
                            >
                              <div className="space-y-1">
                                <p className="font-semibold text-foreground">{block.reason || 'Bloqueio de Agenda'}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  Início: {new Date(block.start_time).toLocaleString('pt-BR')} | Fim: {new Date(block.end_time).toLocaleString('pt-BR')}
                                </p>
                              </div>
                              <button
                                onClick={() => handleDeleteTimeItem('blocked_times', block.id)}
                                className="p-1 text-destructive hover:bg-secondary rounded cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Nenhum bloqueio registrado.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 3: DAYS OFF FORM */}
                {activeTab === 'days_off' && (
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <h4 className="text-xs uppercase font-bold text-foreground">Registrar Folga / Férias</h4>
                      <p className="text-[10px] text-muted-foreground">Adicione datas inteiras de indisponibilidade (Feriados, Férias)</p>
                    </div>

                    {/* Form Add */}
                    <form onSubmit={handleAddDayOff} className="p-4 bg-secondary/20 border border-border rounded-md grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                      <label className="space-y-1 text-xs text-muted-foreground">
                        <span className="text-[10px] font-bold">Data da Folga</span>
                        <input
                          type="date"
                          value={dayOffDate}
                          onChange={(e) => setDayOffDate(e.target.value)}
                          disabled={isPending}
                          className="w-full p-2 bg-secondary border border-border rounded text-foreground text-xs"
                          required
                        />
                      </label>
                      <label className="space-y-1 text-xs text-muted-foreground">
                        <span className="text-[10px] font-bold">Motivo (Férias, Médico)</span>
                        <input
                          type="text"
                          placeholder="Férias, Feriado..."
                          value={dayOffReason}
                          onChange={(e) => setDayOffReason(e.target.value)}
                          disabled={isPending}
                          className="w-full p-2 bg-secondary border border-border rounded text-foreground text-xs"
                          required
                        />
                      </label>
                      
                      <button
                        type="submit"
                        disabled={isPending}
                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold rounded transition-all flex items-center justify-center gap-1 cursor-pointer sm:col-span-2 ml-auto shadow"
                      >
                        <Plus className="w-4 h-4 text-primary-foreground" />
                        Registrar Dia de Folga
                      </button>
                    </form>

                    {/* Existing List */}
                    <div className="space-y-3">
                      <h5 className="text-[11px] uppercase font-bold text-foreground">Folgas Registradas</h5>
                      {daysOff.length > 0 ? (
                        <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                          {daysOff.map((off) => (
                            <div 
                              key={off.id}
                              className="flex justify-between items-center p-3 rounded bg-secondary/35 border border-border/50 text-xs"
                            >
                              <div className="space-y-1">
                                <p className="font-semibold text-foreground">{off.reason || 'Folga / Férias'}</p>
                                <p className="text-[10px] text-muted-foreground">Dia: {formatDate(off.date + 'T00:00:00')}</p>
                              </div>
                              <button
                                onClick={() => handleDeleteTimeItem('days_off', off.id)}
                                className="p-1 text-destructive hover:bg-secondary rounded cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Nenhuma folga/férias registrada.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 4: PROFILE DATA FORM */}
                {activeTab === 'profile' && (
                  <form onSubmit={handleSaveProfileData} className="space-y-4">
                    <div className="space-y-1">
                      <h4 className="text-xs uppercase font-bold text-foreground">Informações Profissionais</h4>
                      <p className="text-[10px] text-muted-foreground">Estes dados aparecem na página inicial e no catálogo de barbeiros do site público</p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-secondary/10 border border-border/40 rounded-md">
                      <div className="relative w-20 h-20 rounded-full border border-primary/40 p-0.5 overflow-hidden group shrink-0 bg-secondary/30">
                        {editPhotoUrl ? (
                          <Image 
                            src={editPhotoUrl} 
                            alt={selectedBarber.full_name} 
                            width={80} 
                            height={80} 
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          <div className="w-full h-full rounded-full bg-gradient-to-tr from-secondary to-muted flex items-center justify-center text-primary text-2xl font-serif font-bold">
                            {selectedBarber.full_name.charAt(0)}
                          </div>
                        )}
                        <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center cursor-pointer text-white text-[8px] font-semibold">
                          <Camera size={14} className="text-primary mb-0.5" />
                          <span>Mudar</span>
                          <input type="file" accept="image/*" onChange={handleEditPhotoUpload} disabled={uploadingAvatar} className="hidden" />
                        </label>
                        {uploadingAvatar && (
                          <div className="absolute inset-0 bg-black/75 flex items-center justify-center">
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          </div>
                        )}
                      </div>
                      <div className="space-y-1 text-center sm:text-left">
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold">Foto do Profissional</span>
                        <p className="text-[9px] text-muted-foreground">Clique na foto para subir uma imagem quadrada (máx. 2MB)</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label htmlFor="editBio" className="block text-[10px] font-bold text-foreground uppercase tracking-wider">Apresentação Curta</label>
                        <textarea
                          id="editBio"
                          rows={2}
                          value={editBio}
                          onChange={(e) => setEditBio(e.target.value)}
                          className="w-full p-2.5 bg-secondary/30 border border-border/80 focus:border-primary rounded text-xs text-foreground focus:outline-none focus:ring-0"
                          placeholder="Frase curta para o card fechado..."
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="editAboutQuote" className="block text-[10px] font-bold text-foreground uppercase tracking-wider">Frase "Sobre o Mestre"</label>
                        <textarea
                          id="editAboutQuote"
                          rows={3}
                          value={editAboutQuote}
                          onChange={(e) => setEditAboutQuote(e.target.value)}
                          className="w-full p-2.5 bg-secondary/30 border border-border/80 focus:border-primary rounded text-xs text-foreground focus:outline-none focus:ring-0"
                          placeholder="Trajetória de vida exibida no detalhe..."
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label htmlFor="editExp" className="block text-[10px] font-bold text-foreground uppercase tracking-wider">Anos de Experiência</label>
                          <input
                            type="number"
                            id="editExp"
                            value={editExperienceYears}
                            onChange={(e) => setEditExperienceYears(Number(e.target.value))}
                            className="w-full p-2.5 bg-secondary/30 border border-border/80 focus:border-primary rounded text-xs text-foreground focus:outline-none focus:ring-0"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label htmlFor="editSpecs" className="block text-[10px] font-bold text-foreground uppercase tracking-wider">Especialidades (separadas por vírgula)</label>
                          <input
                            type="text"
                            id="editSpecs"
                            value={editSpecialtiesText}
                            onChange={(e) => setEditSpecialtiesText(e.target.value)}
                            className="w-full p-2.5 bg-secondary/30 border border-border/80 focus:border-primary rounded text-xs text-foreground focus:outline-none focus:ring-0"
                            placeholder="Degradê, Barba, Visagismo"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <GradientButton type="submit" disabled={isPending || uploadingAvatar} className="h-9 text-xs px-4 gap-1.5">
                        {isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        Salvar Perfil
                      </GradientButton>
                    </div>
                  </form>
                )}

              </div>
            ) : (
              <div className="glass p-12 rounded-lg border border-border text-center text-muted-foreground italic flex flex-col items-center justify-center space-y-3 min-h-[300px]">
                <User className="w-12 h-12 text-primary/20" />
                <p className="text-xs">Selecione um profissional na lista lateral para ajustar seus horários de expediente e gerenciar bloqueios/folgas de agenda.</p>
              </div>
            )}
          </div>

        </div>

      </main>
    </div>
  )
}
