import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { verifyWebhookSignature } from '@/lib/razorpay'

export async function POST(request) {
  const body = await request.text()
  const signature = request.headers.get('x-razorpay-signature') || ''
  try {
    if (!verifyWebhookSignature(body, signature)) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let event
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid webhook body' }, { status: 400 })
  }

  const admin = createAdminClient()
  if (event.event === 'payment.captured') {
    const entity = event.payload?.payment?.entity
    if (!entity?.order_id || !entity?.id) return NextResponse.json({ error: 'Invalid payment event' }, { status: 400 })
    const { data: payment, error } = await admin
      .from('payments')
      .select('id, amount_paise, currency')
      .eq('razorpay_order_id', entity.order_id)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!payment) return NextResponse.json({ error: 'Payment order is not recorded yet' }, { status: 500 })
    if (entity.amount !== payment.amount_paise || entity.currency !== payment.currency) {
      return NextResponse.json({ error: 'Payment amount does not match order' }, { status: 400 })
    }
    const { error: updateError } = await admin
      .from('payments')
      .update({
        razorpay_payment_id: entity.id,
        status: 'paid',
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id)
      .eq('status', 'pending')
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  if (event.event === 'refund.processed') {
    const entity = event.payload?.refund?.entity
    if (!entity?.payment_id || !entity?.id) return NextResponse.json({ error: 'Invalid refund event' }, { status: 400 })
    const { data: payment, error } = await admin
      .from('payments')
      .select('id, amount_paise')
      .eq('razorpay_payment_id', entity.payment_id)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!payment) return NextResponse.json({ error: 'Payment record was not found' }, { status: 500 })
    const { error: updateError } = await admin
      .from('payments')
      .update({
        razorpay_refund_id: entity.id,
        status: entity.amount >= payment.amount_paise ? 'refunded' : 'refund_pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id)
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
