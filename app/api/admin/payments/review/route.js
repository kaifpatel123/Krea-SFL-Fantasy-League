import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/manager'
import { sendAndTrackPaymentApprovalEmail } from '@/lib/payment-approval-email'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function getRecipient(admin, profileId) {
  const { data: profile, error } = await admin
    .from('profiles')
    .select('email, display_name')
    .eq('id', profileId)
    .maybeSingle()
  if (error) return { error: `Could not load the manager email: ${error.message}` }
  return {
    email: profile?.email || '',
    name: profile?.display_name || '',
  }
}

async function saveEmailError(admin, paymentId, message) {
  const { error } = await admin
    .from('payments')
    .update({ approval_email_error: message })
    .eq('id', paymentId)
    .eq('status', 'paid')
    .is('approval_email_sent_at', null)
  return error
}

export async function POST(request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const paymentId = typeof body?.paymentId === 'string' ? body.paymentId : ''
  const action = body?.action
  if (!UUID.test(paymentId) || !['approve', 'reject', 'retry-email'].includes(action)) {
    return NextResponse.json({ error: 'A payment record and valid review action are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  if (action === 'retry-email') {
    const { data: payment, error } = await admin
      .from('payments')
      .select('id, profile_id, submitted_email, amount_paise, status, approval_email_attempted_at, approval_email_sent_at, approval_email_error')
      .eq('id', paymentId)
      .eq('status', 'paid')
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!payment) return NextResponse.json({ error: 'Approved payment not found' }, { status: 404 })
    if (payment.approval_email_sent_at) {
      return NextResponse.json({ error: 'The approval email has already been sent' }, { status: 409 })
    }
    if (payment.approval_email_attempted_at && !payment.approval_email_error) {
      return NextResponse.json({ error: 'An email attempt is already in progress' }, { status: 409 })
    }

    const recipient = await getRecipient(admin, payment.profile_id)
    if (recipient.error) return NextResponse.json({ error: recipient.error }, { status: 500 })
    const delivery = await sendAndTrackPaymentApprovalEmail(
      admin,
      payment,
      { ...recipient, email: recipient.email || payment.submitted_email },
      payment.approval_email_error,
    )
    return NextResponse.json({
      ok: true,
      status: 'paid',
      emailSent: delivery.sent,
      emailError: delivery.error,
    })
  }

  const status = action === 'approve' ? 'paid' : 'rejected'
  const { data: pendingPayment, error: readError } = await admin
    .from('payments')
    .select('id, profile_id, submitted_email, amount_paise')
    .eq('id', paymentId)
    .eq('status', 'pending')
    .maybeSingle()
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })
  if (!pendingPayment) {
    return NextResponse.json({ error: 'This payment is no longer awaiting review' }, { status: 409 })
  }

  const { data, error } = await admin
    .from('payments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', paymentId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'This payment is no longer awaiting review' }, { status: 409 })
  if (action === 'reject') return NextResponse.json({ ok: true, status })

  const recipient = await getRecipient(admin, pendingPayment.profile_id)
  if (recipient.error) {
    const saveError = await saveEmailError(admin, paymentId, recipient.error)
    return NextResponse.json({
      ok: true,
      status,
      emailSent: false,
      emailError: saveError ? `${recipient.error} Could not save email status: ${saveError.message}` : recipient.error,
    })
  }

  const delivery = await sendAndTrackPaymentApprovalEmail(
    admin,
    { ...pendingPayment, status },
    { ...recipient, email: recipient.email || pendingPayment.submitted_email },
  )
  return NextResponse.json({
    ok: true,
    status,
    emailSent: delivery.sent,
    emailError: delivery.error,
  })
}
