'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { 
  User, Camera, Loader2, Save, AlertCircle, CheckCircle2, Scissors, ArrowLeft 
} from 'lucide-react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import { DashboardSidebar } from '@/components/DashboardSidebar'
import { getBarberProfileAction, updateBarberProfileAction, BarberProfileData } from './actions'
import { GradientButton } from '@/components/ui/gradient-button'

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
        <div className="border-b border-border/40 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-serif font-bold text-foreground">Editar Meu Perfil</h1>
            <p className="text-xs text-muted-foreground">Gerencie sua apresentação pessoal, foto e especialidades exibidas aos clientes</p>
          </div>
          <GradientButton variant="variant" onClick={() => router.push('/painel')} className="h-9 text-xs gap-1.5">
            <ArrowLeft size={14} /> Voltar ao Painel
          </GradientButton>
        </div>

        {errorMsg && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded flex items-start gap-2 text-xs text-destructive max-w-2xl">
            <AlertCircle className="w-4.5 h-4.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded flex items-start gap-2 text-xs text-emerald-500 max-w-2xl">
            <CheckCircle2 className="w-4.5 h-4.5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Profile Card */}
        {profile && (
          <form onSubmit={handleSaveProfile} className="glass p-6 sm:p-8 rounded-lg border border-border max-w-2xl space-y-6 shadow-xl">
            {/* Row 1: Profile Photo upload */}
            <div className="flex flex-col sm:flex-row items-center gap-6 pb-4 border-b border-border/40">
              <div className="relative w-28 h-28 rounded-full border-2 border-primary/40 p-0.5 overflow-hidden group shrink-0 select-none bg-secondary/30">
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
                <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center cursor-pointer text-white text-[10px] font-semibold">
                  <Camera size={18} className="text-primary mb-1" />
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
                  <div className="absolute inset-0 bg-black/75 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                )}
              </div>

              <div className="space-y-1.5 text-center sm:text-left">
                <h3 className="font-serif font-bold text-lg text-foreground">{profile.full_name}</h3>
                <p className="text-xs text-muted-foreground">{profile.email}</p>
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                  {profile.role === 'admin' ? 'Administrador / Proprietário' : 'Barbeiro Profissional'}
                </span>
                <p className="text-[10px] text-muted-foreground">Clique na imagem para enviar uma foto quadrada (máx. 2MB)</p>
              </div>
            </div>

            {/* Inputs grid */}
            <div className="space-y-4">
              {/* Short Bio */}
              <div className="space-y-1.5">
                <label htmlFor="bio" className="block text-xs font-semibold text-foreground uppercase tracking-wider">
                  Apresentação Curta (Exibida no Card Fechado)
                </label>
                <textarea
                  id="bio"
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full p-3 bg-secondary/30 border border-border/80 focus:border-primary rounded-lg text-sm text-foreground focus:outline-none focus:ring-0 transition-colors"
                  placeholder="Ex: Especialista em cortes clássicos executivos e barba terapia com mais de 8 anos..."
                  required
                />
              </div>

              {/* About Quote */}
              <div className="space-y-1.5">
                <label htmlFor="aboutQuote" className="block text-xs font-semibold text-foreground uppercase tracking-wider">
                  Frase de Perfil (Exibida em "Sobre o Mestre")
                </label>
                <textarea
                  id="aboutQuote"
                  rows={3}
                  value={aboutQuote}
                  onChange={(e) => setAboutQuote(e.target.value)}
                  className="w-full p-3 bg-secondary/30 border border-border/80 focus:border-primary rounded-lg text-sm text-foreground focus:outline-none focus:ring-0 transition-colors"
                  placeholder="Compartilhe um pouco da sua trajetória de vida e compromisso com o cliente..."
                  required
                />
              </div>

              {/* Experience Years */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="experienceYears" className="block text-xs font-semibold text-foreground uppercase tracking-wider">
                    Anos de Experiência
                  </label>
                  <input
                    type="number"
                    id="experienceYears"
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(Number(e.target.value))}
                    min={0}
                    max={60}
                    className="w-full p-3 bg-secondary/30 border border-border/80 focus:border-primary rounded-lg text-sm text-foreground focus:outline-none focus:ring-0 transition-colors"
                    required
                  />
                </div>

                {/* Specialties */}
                <div className="space-y-1.5">
                  <label htmlFor="specialties" className="block text-xs font-semibold text-foreground uppercase tracking-wider">
                    Especialidades (Separadas por vírgula)
                  </label>
                  <input
                    type="text"
                    id="specialties"
                    value={specialtiesText}
                    onChange={(e) => setSpecialtiesText(e.target.value)}
                    className="w-full p-3 bg-secondary/30 border border-border/80 focus:border-primary rounded-lg text-sm text-foreground focus:outline-none focus:ring-0 transition-colors"
                    placeholder="Ex: Degradê Americano, Visagismo, Freestyle"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Form Submit */}
            <div className="pt-4 flex justify-end">
              <GradientButton type="submit" disabled={isPending || uploading} className="text-xs px-6 gap-2">
                {(isPending || uploading) ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Salvando...
                  </>
                ) : (
                  <>
                    <Save size={14} /> Salvar Alterações
                  </>
                )}
              </GradientButton>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}
