import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/manager'
import { refundRazorpayPayment } from '@/lib/razorpay'

export async function POST(request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  if (!body.paymentId) return NextResponse.json({ error: 'Missing payment record' }, { status: 400 })

  const admin = createAdminClient()
  const { data: payment, error } = await admin.from('payments').select('*').eq('id', body.paymentId).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!payment) return NextResponse.json({ error: 'Payment record not found' }, { status: 404 })
  if (payment.status !== 'paid' || !payment.razorpay_payment_id) {
    return NextResponse.json({ error: 'Only captured payments can be refunded' }, { status: 409 })
  }

  const { data: refundingPayment, error: lockError } = await admin
    .from('payments')
    .update({ status: 'refund_pending', updated_at: new Date().toISOString() })
    .eq('id', payment.id)
    .eq('status', 'paid')
    .select('id')
    .maybeSingle()
  if (lockError) return NextResponse.json({ error: lockError.message }, { status: 500 })
  if (!refundingPayment) {
    return NextResponse.json({ error: 'This payment is already being refunded or is no longer paid' }, { status: 409 })
  }

  try {
    const refund = await refundRazorpayPayment(payment.razorpay_payment_id)
    const status = refund.status === 'processed' ? 'refunded' : 'refund_pending'
    const { error: updateError } = await admin
      .from('payments')
      .update({
        razorpay_refund_id: refund.id,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id)
      .eq('status', 'refund_pending')
    if (updateError) throw new Error(`Refund was requested but payment status could not be updated: ${updateError.message}`)
    return NextResponse.json({ ok: true, status })
  } catch (error) {
    if (error.status && error.status < 500) {
      const { error: restoreError } = await admin
        .from('payments')
        .update({ status: 'paid', updated_at: new Date().toISOString() })
        .eq('id', payment.id)
        .eq('status', 'refund_pending')
        .is('razorpay_refund_id', null)
      if (restoreError) {
        return NextResponse.json({ error: `${error.message}. Could not restore payment status: ${restoreError.message}` }, { status: 502 })
      }
    }
    return NextResponse.json({
      error: `${error.message || 'Could not refund payment'}. The payment remains suspended while the refund is reconciled.`,
    }, { status: 502 })
  }
}
