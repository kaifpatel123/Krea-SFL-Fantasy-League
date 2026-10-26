import { cookies } from 'next/headers'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { TEST_MODE, isAllowedEmail } from '@/lib/config'

export const MANAGER_COOKIE = 'fsfl_manager'
export const ADMIN_COOKIE = 'fsfl_admin'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

// Returns the current fantasy manager's profile row, or null.
export async function getManager() {
  const admin = createAdminClient()

  if (TEST_MODE) {
    const id = cookies().get(MANAGER_COOKIE)?.value
    if (!id) return null
    const { data } = await admin.from('profiles').select('*').eq('id', id).maybeSingle()
    return data || null
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  if (!isAllowedEmail(user.email)) return null

  let { data } = await admin.from('profiles').select('*').eq('id', user.id).maybeSingle()
  if (!data) {
    const inserted = await admin
      .from('profiles')
      .insert({ id: user.id, email: user.email, display_name: '' })
      .select()
      .single()
    data = inserted.data
  }
  return data
}

// Admin access: the passcode cookie (works in any mode), or a signed-in admin email.
export async function isAdmin() {
  const code = cookies().get(ADMIN_COOKIE)?.value
  if (code && process.env.ADMIN_PASSCODE && code === process.env.ADMIN_PASSCODE) return true

  if (!TEST_MODE && ADMIN_EMAILS.length) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user && ADMIN_EMAILS.includes((user.email || '').toLowerCase())) return true
  }
  return false
}
