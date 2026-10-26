import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { isAllowedEmail } from '@/lib/config'

// Google sign-in lands here. Only Krea accounts are let in; anyone else is removed straight away.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  if (!code) return NextResponse.redirect(`${origin}/login`)

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data?.user) return NextResponse.redirect(`${origin}/login?error=failed`)

  if (!isAllowedEmail(data.user.email)) {
    await supabase.auth.signOut()
    await createAdminClient().auth.admin.deleteUser(data.user.id).catch(() => {})
    return NextResponse.redirect(`${origin}/login?error=krea`)
  }

  return NextResponse.redirect(`${origin}/squad`)
}
