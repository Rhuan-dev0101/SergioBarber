'use server'

import { headers } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase'
import { checkRateLimit } from '@/lib/rateLimit'

export type AuthResponse = {
  success: boolean
  message: string
  redirectTo?: string
}

/**
 * Server Action to log in a user.
 */
export async function loginAction(prevState: any, formData: FormData): Promise<AuthResponse> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const redirectTo = formData.get('redirectTo') as string || '/cliente'

  // Validate fields
  if (!email || !password) {
    return { success: false, message: 'Por favor, preencha todos os campos.' }
  }

  // Get IP address
  const headerList = await headers()
  const ip = headerList.get('x-forwarded-for') || '127.0.0.1'

  // 1. Rate Limiting Check
  const rateLimitStatus = checkRateLimit(ip, email)
  if (rateLimitStatus.limited) {
    return { success: false, message: rateLimitStatus.message }
  }

  try {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      // 5. No User Enumeration: return a generic message
      return { success: false, message: 'Credenciais inválidas. Verifique seu e-mail e senha.' }
    }

    return { success: true, message: 'Acesso autorizado.', redirectTo }
  } catch (err) {
    console.error('Login action error:', err)
    return { success: false, message: 'Ocorreu um erro no servidor. Tente novamente mais tarde.' }
  }
}

/**
 * Server Action to sign up a new user.
 */
export async function signUpAction(prevState: any, formData: FormData): Promise<AuthResponse> {
  const fullName = formData.get('fullName') as string
  const email = formData.get('email') as string
  const phone = formData.get('phone') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string
  const acceptTerms = formData.get('acceptTerms') === 'true'
  const acceptPrivacy = formData.get('acceptPrivacy') === 'true'

  // Validate fields
  if (!fullName || !email || !phone || !password || !confirmPassword) {
    return { success: false, message: 'Por favor, preencha todos os campos obrigatórios.' }
  }

  if (password !== confirmPassword) {
    return { success: false, message: 'As senhas não coincidem.' }
  }

  if (password.length < 6) {
    return { success: false, message: 'A senha deve conter no mínimo 6 caracteres.' }
  }

  if (!acceptTerms || !acceptPrivacy) {
    return { success: false, message: 'Você precisa aceitar os Termos de Uso e a Política de Privacidade para prosseguir.' }
  }

  // Get IP address
  const headerList = await headers()
  const ip = headerList.get('x-forwarded-for') || '127.0.0.1'

  // 1. Rate Limiting Check
  const rateLimitStatus = checkRateLimit(ip, email)
  if (rateLimitStatus.limited) {
    return { success: false, message: rateLimitStatus.message }
  }

  try {
    const supabase = await createServerSupabaseClient()

    // Sign up via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: 'customer' // default role
        }
      }
    })

    if (authError) {
      // 5. No User Enumeration: return a generic error message
      return { success: false, message: 'Não foi possível realizar o cadastro. Tente novamente ou entre em contato.' }
    }

    const user = authData.user
    if (user) {
      // If the user profile is created, let's insert the legal acceptances
      // Since we need to log it, let's insert into legal_acceptances.
      // Note: We bypass RLS in Server Action or let the authenticated client insert it.
      // We can insert under the user's session context if they are logged in.
      // If they require email verification, they may not have a session yet, but we write it:
      const { error: profileError } = await supabase.from('profiles').update({
        phone: phone
      }).eq('id', user.id)

      if (profileError) {
        console.error('Error updating phone in profile:', profileError)
      }

      // Record legal acceptances
      await supabase.from('legal_acceptances').insert([
        {
          profile_id: user.id,
          document_type: 'terms_of_use',
          version: '1.0',
          ip_address: ip
        },
        {
          profile_id: user.id,
          document_type: 'privacy_policy',
          version: '1.0',
          ip_address: ip
        }
      ])
    }

    return { 
      success: true, 
      message: 'Cadastro realizado com sucesso! Você já pode fazer login.' 
    }
  } catch (err) {
    console.error('Signup action error:', err)
    return { success: false, message: 'Ocorreu um erro ao processar seu cadastro.' }
  }
}
