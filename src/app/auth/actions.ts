'use server'

import { headers } from 'next/headers'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase'
import { checkRateLimit } from '@/lib/rateLimit'

export type AuthResponse = {
  success: boolean
  message: string
  redirectTo?: string
}

/**
 * Resposta unica de cadastro (anti-enumeracao de contas).
 *
 * O mesmo texto e' devolvido para "e-mail novo" e para "e-mail ja cadastrado".
 * Se as duas situacoes respondessem coisas diferentes, bastaria um laco sobre
 * uma lista de e-mails para descobrir quem e' cliente da barbearia.
 *
 * Para que isso seja verdade de ponta a ponta, o endpoint /auth/v1/signup do
 * proprio Supabase tambem precisa parar de auto-confirmar o e-mail
 * (mailer_autoconfirm = false) -- veja SECURITY.md, item 2.
 */
const NEUTRAL_SIGNUP_MESSAGE =
  'Se este e-mail estiver disponivel, enviaremos um link de confirmacao. Verifique sua caixa de entrada e a pasta de spam.'

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
  const rateLimitStatus = await checkRateLimit(ip, email)
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
    return { success: false, message: 'Não foi possível concluir a operação. Tente novamente em instantes.' }
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
  const rateLimitStatus = await checkRateLimit(ip, email)
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
      // Anti-enumeracao: "e-mail ja cadastrado" nao pode ser distinguivel de
      // um cadastro novo. Erros de conta existente devolvem exatamente a mesma
      // resposta do caminho de sucesso; so falhas reais de infraestrutura
      // (rede, provedor fora do ar) retornam erro.
      const alreadyRegistered =
        authError.code === 'user_already_exists' ||
        authError.status === 422 ||
        /already\s*(registered|exists)/i.test(authError.message || '')

      if (alreadyRegistered) {
        return { success: true, message: NEUTRAL_SIGNUP_MESSAGE }
      }

      console.error('Signup auth error:', authError.message)
      return { success: false, message: 'Não foi possível realizar o cadastro. Tente novamente ou entre em contato.' }
    }

    const user = authData.user
    if (user) {
      // Gravamos telefone e aceites com o client de servico.
      //
      // Motivo: quando a confirmacao de e-mail estiver ligada (item 2 do
      // hardening), o signUp NAO devolve sessao. O client de sessao cairia no
      // role `anon` e estas escritas falhariam em silencio -- o telefone do
      // cliente e o registro de consentimento LGPD seriam perdidos.
      // O client de servico roda apenas no servidor e independe de sessao.
      const admin = await createAdminSupabaseClient()

      const { error: profileError } = await admin
        .from('profiles')
        .update({ phone })
        .eq('id', user.id)

      if (profileError) {
        console.error('Error updating phone in profile:', profileError.message)
      }

      // Registro de aceite dos documentos legais (LGPD)
      const { error: acceptError } = await admin.from('legal_acceptances').insert([
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

      if (acceptError) {
        console.error('Error recording legal acceptances:', acceptError.message)
      }
    }

    // Mesma mensagem do caminho "e-mail ja existe" (ver NEUTRAL_SIGNUP_MESSAGE).
    return {
      success: true,
      message: NEUTRAL_SIGNUP_MESSAGE
    }
  } catch (err) {
    console.error('Signup action error:', err)
    return { success: false, message: 'Não foi possível concluir seu cadastro. Tente novamente em instantes.' }
  }
}
