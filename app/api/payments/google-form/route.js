import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getEntryFeePaise } from '@/lib/payments'

export const dynamic = 'force-dynamic'

function hasValidSecret(request) {
  const secret = process.env.GOOGLE_FORM_WEBHOOK_SECRET
  const authorization = request.headers.get('authorization') || ''
  if (!secret) return false

  const expected = Buffer.from(`Bearer ${secret}`)
  const received = Buffer.from(authorization)
  return expected.length === received.length && timingSafeEqual(expected, received)
}

function isGoogleDriveUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' &&
      (url.hostname === 'google.com' ||
        url.hostname.endsWith('.google.com') ||
        url.hostname === 'googleusercontent.com' ||
        url.hostname.endsWith('.googleusercontent.com'))
  } catch {
    return false
  }
}

export async function POST(request) {
  if (!hasValidSecret(request)) {
    return NextResponse.json({ error: 'Invalid form integration credentials' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const transactionReference = typeof body?.transactionReference === 'string'
    ? body.transactionReference.trim()
    : ''
  const proofUrl = typeof body?.proofUrl === 'string' ? body.proofUrl.trim() : ''

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid Krea account email is required' }, { status: 400 })
  }
  if (!transactionReference || transactionReference.length > 120) {
    return NextResponse.json({ error: 'A transaction reference of at most 120 characters is required' }, { status: 400 })
  }
  if (!isGoogleDriveUrl(proofUrl)) {
    return NextResponse.json({ error: 'A valid Google Drive screenshot link is required' }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    if (profileError) throw new Error(`Could not find Krea account: ${profileError.message}`)
    if (!profile) {
      return NextResponse.json({ error: 'No league account matches the submitted Krea email' }, { status: 404 })
    }

    const { data: duplicate, error: duplicateError } = await admin
      .from('payments')
      .select('profile_id')
      .eq('transaction_reference', transactionReference)
      .maybeSingle()
    if (duplicateError) throw new Error(`Could not check transaction reference: ${duplicateError.message}`)
    if (duplicate) {
      if (duplicate.profile_id === profile.id) return NextResponse.json({ received: true, duplicate: true })
      return NextResponse.json({ error: 'This transaction reference has already been submitted' }, { status: 409 })
    }

    const { data: paidPayment, error: paidError } = await admin
      .from('payments')
      .select('id')
      .eq('profile_id', profile.id)
      .eq('status', 'paid')
      .limit(1)
      .maybeSingle()
    if (paidError) throw new Error(`Could not check payment status: ${paidError.message}`)
    if (paidPayment) return NextResponse.json({ error: 'This account already has an approved entry payment' }, { status: 409 })

    const { data: pendingPayment, error: pendingError } = await admin
      .from('payments')
      .select('id')
      .eq('profile_id', profile.id)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle()
    if (pendingError) throw new Error(`Could not check pending submissions: ${pendingError.message}`)
    if (pendingPayment) {
      return NextResponse.json({ error: 'This account already has a payment submission awaiting review' }, { status: 409 })
    }

    const { error: insertError } = await admin.from('payments').insert({
      profile_id: profile.id,
      submitted_email: email,
      transaction_reference: transactionReference,
      proof_url: proofUrl,
      amount_paise: await getEntryFeePaise(),
      currency: 'INR',
      status: 'pending',
    })
    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'A payment with this reference or account is already being reviewed' }, { status: 409 })
      }
      throw new Error(`Could not record payment submission: ${insertError.message}`)
    }

    return NextResponse.json({ received: true }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Could not process form submission' }, { status: 500 })
  }
}
