'use server'

import { createServerSupabaseClient } from '@/lib/supabase'

export type ClientActionResponse = {
  success: boolean
  message: string
}

/**
 * Server Action to update private notes of a customer profile.
 */
export async function updateCustomerPrivateNotesAction(
  customerId: string,
  notes: string
): Promise<ClientActionResponse> {
  if (!customerId) {
    return { success: false, message: 'ID de cliente inválido.' }
  }

  try {
    const supabase = await createServerSupabaseClient()
    
    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, message: 'Sessão expirada. Faça login novamente.' }
    }

    // 2. Authorize (admin or barber role check)
    const { data: staffProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!staffProfile || (staffProfile.role !== 'admin' && staffProfile.role !== 'barber')) {
      return { success: false, message: 'Não autorizado.' }
    }

    // 3. Insert private note
    const { error } = await supabase
      .from('client_notes')
      .insert({
        profile_id: customerId,
        note: notes || '',
        created_by: user.id
      })

    if (error) {
      console.error('Error updating customer notes:', error)
      return { 
        success: false, 
        message: 'Erro ao salvar anotações na tabela client_notes.' 
      }
    }

    return { success: true, message: 'Anotações salvas com sucesso!' }
  } catch (err) {
    console.error('Error inside updateCustomerPrivateNotesAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}

/**
 * Server Action to delete a customer profile and auth account (Admin only)
 */
export async function deleteCustomerAction(customerId: string): Promise<ClientActionResponse> {
  if (!customerId) {
    return { success: false, message: 'ID de cliente inválido.' }
  }

  try {
    const supabase = await createServerSupabaseClient()
    
    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, message: 'Sessão expirada. Faça login novamente.' }
    }

    // 2. Verify server-side that the requesting user has role='admin'
    const { data: staffProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!staffProfile || staffProfile.role !== 'admin') {
      return { success: false, message: 'Não autorizado. Apenas administradores podem excluir clientes.' }
    }

    // 3. Create Supabase admin client using the service role key (imported dynamically)
    const { createClient: createBaseClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createBaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // 4. Delete the auth user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(customerId)

    if (deleteError) {
      console.error('Error deleting user via admin API:', deleteError)
      return { success: false, message: `Erro ao deletar usuário: ${deleteError.message}` }
    }

    return { success: true, message: 'Cliente excluído com sucesso!' }
  } catch (err) {
    console.error('Error inside deleteCustomerAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}

export type RegisterManuallyInput = {
  fullName: string
  email: string
  phone: string
  password: string
}

export type RegisterManuallyResponse = {
  success: boolean
  message: string
  data?: {
    email: string
    id: string
  }
}

/**
 * Server Action to register a customer profile manually (Admin or Barber only).
 */
export async function registerCustomerManuallyAction(
  input: RegisterManuallyInput
): Promise<RegisterManuallyResponse> {
  const { fullName, email, phone, password } = input

  if (!fullName || !email || !phone || !password) {
    return { success: false, message: 'Preencha todos os campos obrigatórios.' }
  }

  if (password.length < 6) {
    return { success: false, message: 'A senha deve conter no mínimo 6 caracteres.' }
  }

  try {
    const supabase = await createServerSupabaseClient()
    
    // 1. Authenticate requesting user
    const { data: { user: staffUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !staffUser) {
      return { success: false, message: 'Sessão expirada. Faça login novamente.' }
    }

    // 2. Authorize (admin or barber role check)
    const { data: staffProfile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', staffUser.id)
      .single()

    if (!staffProfile || (staffProfile.role !== 'admin' && staffProfile.role !== 'barber')) {
      return { success: false, message: 'Não autorizado.' }
    }

    // 3. Create Admin client using the service role key
    const { createClient: createBaseClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createBaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // 4. Pre-check if email already exists in profiles
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()

    if (existingProfile) {
      return { success: false, message: 'Este e-mail já está cadastrado.' }
    }

    // 5. Create auth user with auto-confirm
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName.trim()
      }
    })

    if (createError) {
      console.error('Error creating user via admin API:', createError)
      let friendlyMessage = `Erro ao criar usuário: ${createError.message}`
      if (createError.message.includes('Email already exists') || createError.message.includes('email already registered') || createError.message.includes('already exists')) {
        friendlyMessage = 'Este e-mail já está cadastrado.'
      }
      return { success: false, message: friendlyMessage }
    }

    const newCustomerUser = authData.user
    if (!newCustomerUser) {
      return { success: false, message: 'Falha ao obter os dados do usuário criado.' }
    }

    // 6. Update the user profile (role stays 'customer', which is the default from trigger, do not change it)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        phone: phone.trim()
      })
      .eq('id', newCustomerUser.id)

    if (profileError) {
      console.error('Error updating profiles row:', profileError)
      // Rollback: delete the created auth user
      await supabaseAdmin.auth.admin.deleteUser(newCustomerUser.id)
      return { success: false, message: 'Usuário criado, mas erro ao atualizar dados de perfil. Cadastro cancelado.' }
    }

    // 7. Insert legal acceptances with the recorded_by column
    const { error: acceptancesError } = await supabaseAdmin
      .from('legal_acceptances')
      .insert([
        {
          profile_id: newCustomerUser.id,
          document_type: 'terms_of_use',
          version: '1.0',
          recorded_by: staffUser.id
        },
        {
          profile_id: newCustomerUser.id,
          document_type: 'privacy_policy',
          version: '1.0',
          recorded_by: staffUser.id
        }
      ])

    if (acceptancesError) {
      console.error('Error inserting legal acceptances:', acceptancesError)
      // Rollback: delete the created auth user
      await supabaseAdmin.auth.admin.deleteUser(newCustomerUser.id)
      return { success: false, message: 'Erro ao registrar aceites legais do cliente. Cadastro cancelado.' }
    }

    return {
      success: true,
      message: 'Cliente cadastrado com sucesso!',
      data: {
        email: email.trim().toLowerCase(),
        id: newCustomerUser.id
      }
    }
  } catch (err) {
    console.error('Error inside registerCustomerManuallyAction:', err)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}

