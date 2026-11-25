import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/manager'
import {
  paymentEmailConfigurationError,
  sendAndTrackPaymentApprovalEmail,
} from '@/lib/payment-approval-email'

const BATCH_SIZE = 10

export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const configurationError = paymentEmailConfigurationError()
  if (configurationError) return NextResponse.json({ error: configurationError }, { status: 503 })

  const admin = createAdminClient()
  const { data: payments, error: paymentError } = await admin
    .from('payments')
    .select('id, profile_id, submitted_email, amount_paise')
    .eq('status', 'paid')
    .is('approval_email_sent_at', null)
    .is('approval_email_attempted_at', null)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)
  if (paymentError) return NextResponse.json({ error: paymentError.message }, { status: 500 })

  const profileIds = Array.from(new Set((payments || []).map((payment) => payment.profile_id)))
  const { data: profiles, error: profileError } = profileIds.length
    ? await admin.from('profiles').select('id, email, display_name').in('id', profileIds)
    : { data: [], error: null }
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  const profileById = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]))
  let sent = 0
  let failed = 0
  let trackingWarnings = 0

  for (const payment of payments || []) {
    const profile = profileById[payment.profile_id]
    const delivery = await sendAndTrackPaymentApprovalEmail(
      admin,
      payment,
      {
        email: profile?.email || payment.submitted_email || '',
        name: profile?.display_name || '',
      },
    )
    if (delivery.sent) {
      sent += 1
      if (delivery.error) trackingWarnings += 1
    } else {
      failed += 1
    }
  }

  const { count, error: countError } = await admin
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'paid')
    .is('approval_email_sent_at', null)
    .is('approval_email_attempted_at', null)
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 })

  return NextResponse.json({
    processed: (payments || []).length,
    sent,
    failed,
    trackingWarnings,
    remaining: count || 0,
  })
}
