'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { User, Camera, Loader2, Save, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import { DashboardSidebar } from '@/components/DashboardSidebar'
import { getBarberProfileAction, updateBarberProfileAction, BarberProfileData } from './actions'

export default function PerfilBarbeiroPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<BarberProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)

  // Form Fields
  const [bio, setBio] = useState('')
  const [aboutQuote, setAboutQuote] = useState('')
  const [experienceYears, setExperienceYears] = useState(0)
  const [specialtiesText, setSpecialtiesText] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const supabase = createClient()

  const loadProfileData = async () => {
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const res = await getBarberProfileAction()
      if (!res.success || !res.data) {
        setErrorMsg(res.message)
        if (res.message.includes('autenticado')) {
          router.push('/entrar')
        }
      } else {
        const p = res.data
        setProfile(p)
        setBio(p.bio)
        setAboutQuote(p.about_quote)
        setExperienceYears(p.experience_years)
        setSpecialtiesText(p.specialties.join(', '))
        setPhotoUrl(p.photo_url)
      }
    } catch (err) {
      console.error(err)
      setErrorMsg('Erro ao carregar dados do perfil.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfileData()
  }, [])

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('')
    setSuccessMsg('')
    
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    
    // Check size limit (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('A imagem deve ter no máximo 2MB.')
      return
    }

    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${profile?.id || 'barber'}-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('barber-photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (error) {
        console.error('Storage upload error:', error)
        throw new Error('Certifique-se de que o bucket "barber-photos" foi criado no Supabase console.')
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('barber-photos')
        .getPublicUrl(filePath)

      setPhotoUrl(publicUrl)
      setSuccessMsg('Foto de perfil carregada temporariamente. Lembre-se de salvar as alterações para consolidar.')
    } catch (err: any) {
      console.error('Error uploading photo:', err)
      setErrorMsg(err.message || 'Erro ao carregar a foto para o servidor.')
    } finally {
      setUploading(false)
    }
  }

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    setErrorMsg('')
    setSuccessMsg('')

    // Parse specialties
    const specialties = specialtiesText
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0)

    startTransition(async () => {
      const res = await updateBarberProfileAction(profile.id, {
        bio,
        about_quote: aboutQuote,
        experience_years: Number(experienceYears || 0),
        specialties,
        photo_url: photoUrl
      })

      if (!res.success) {
        setErrorMsg(res.message)
      } else {
        setSuccessMsg('Seu perfil foi atualizado com sucesso! As alterações já estão visíveis no site.')
        loadProfileData()
      }
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col md:flex-row justify-center items-center gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Carregando dados do perfil...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <DashboardSidebar />

      <main className="flex-grow p-6 sm:p-8 space-y-6 overflow-y-auto">
        {/* Header */}
        <div className="border-b border-border/40 pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-2">
              <User className="w-7 h-7 text-primary shrink-0" />
              Editar Meu Perfil 💈
            </h1>
            <p className="text-xs text-muted-foreground">Gerencie sua foto, biografia e especialidades exibidas aos clientes</p>
          </div>
          <button 
            onClick={() => router.push('/painel')} 
            className="px-4 py-2 bg-secondary hover:bg-muted text-foreground border border-border rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar ao Painel
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-2 text-xs text-destructive max-w-2xl">
            <AlertCircle className="w-4.5 h-4.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-2 text-xs text-emerald-500 max-w-2xl">
            <CheckCircle2 className="w-4.5 h-4.5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Profile Card */}
        {profile && (
          <form onSubmit={handleSaveProfile} className="glass p-6 sm:p-8 rounded-2xl border border-border/80 max-w-2xl space-y-6 shadow-xl">
            {/* Row 1: Profile Photo upload */}
            <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-border/40">
              <div className="relative w-28 h-28 rounded-full border-2 border-primary p-1 overflow-hidden group shrink-0 select-none bg-secondary/40 shadow-lg shadow-primary/10">
                {photoUrl ? (
                  <Image 
                    src={photoUrl} 
                    alt={profile.full_name} 
                    width={112} 
                    height={112} 
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-gradient-to-tr from-secondary to-muted flex items-center justify-center text-primary text-4xl font-serif font-bold">
                    {profile.full_name.charAt(0)}
                  </div>
                )}
                
                {/* Upload Button Overlay */}
                <label className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center cursor-pointer text-white text-[10px] font-bold">
                  <Camera size={20} className="text-primary mb-1" />
                  <span>Alterar Foto</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handlePhotoUpload} 
                    disabled={uploading} 
                    className="hidden" 
                  />
                </label>

                {uploading && (
                  <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                )}
              </div>

              <div className="space-y-1.5 text-center sm:text-left">
                <h3 className="font-serif font-bold text-xl text-foreground">{profile.full_name}</h3>
                <p className="text-xs text-muted-foreground font-mono">{profile.email}</p>
                <span className="inline-block px-3 py-1 rounded-full bg-primary/15 text-primary text-[10px] font-bold uppercase tracking-wider border border-primary/20">
                  {profile.role === 'admin' ? 'Administrador / Proprietário' : 'Barbeiro Profissional'}
                </span>
                <p className="text-[10px] text-muted-foreground pt-1">Clique na imagem para trocar a foto de perfil (máx. 2MB)</p>
              </div>
            </div>

            {/* Inputs grid */}
            <div className="space-y-4">
              {/* Short Bio */}
              <div className="space-y-1.5">
                <label htmlFor="bio" className="block text-xs font-bold text-foreground uppercase tracking-wider">
                  Apresentação Curta (Exibida no Card de Seleção)
                </label>
                <textarea
                  id="bio"
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full p-3.5 bg-background border border-border focus:border-primary rounded-xl text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                  placeholder="Ex: Especialista em cortes clássicos executivos e barba terapia com mais de 8 anos..."
                  required
                />
              </div>

              {/* About Quote */}
              <div className="space-y-1.5">
                <label htmlFor="aboutQuote" className="block text-xs font-bold text-foreground uppercase tracking-wider">
                  Frase de Perfil (Exibida no &quot;Sobre o Mestre&quot;)
                </label>
                <textarea
                  id="aboutQuote"
                  rows={3}
                  value={aboutQuote}
                  onChange={(e) => setAboutQuote(e.target.value)}
                  className="w-full p-3.5 bg-background border border-border focus:border-primary rounded-xl text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                  placeholder="Compartilhe um pouco da sua trajetória de vida e compromisso com o cliente..."
                  required
                />
              </div>

              {/* Experience Years */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="experienceYears" className="block text-xs font-bold text-foreground uppercase tracking-wider">
                    Anos de Experiência
                  </label>
                  <input
                    type="number"
                    id="experienceYears"
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(Number(e.target.value))}
                    min={0}
                    max={60}
                    className="w-full p-3.5 bg-background border border-border focus:border-primary rounded-xl text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors font-mono font-bold"
                    required
                  />
                </div>

                {/* Specialties */}
                <div className="space-y-1.5">
                  <label htmlFor="specialties" className="block text-xs font-bold text-foreground uppercase tracking-wider">
                    Especialidades (Separadas por vírgula)
                  </label>
                  <input
                    type="text"
                    id="specialties"
                    value={specialtiesText}
                    onChange={(e) => setSpecialtiesText(e.target.value)}
                    className="w-full p-3.5 bg-background border border-border focus:border-primary rounded-xl text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                    placeholder="Ex: Degradê Americano, Visagismo, Freestyle"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Form Submit */}
            <div className="pt-4 flex justify-end">
              <button 
                type="submit" 
                disabled={isPending || uploading} 
                className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200 cursor-pointer disabled:opacity-50"
              >
                {(isPending || uploading) ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Salvando...
                  </>
                ) : (
                  <>
                    <Save size={14} /> Salvar Alterações
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}
