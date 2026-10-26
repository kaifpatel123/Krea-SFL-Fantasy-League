import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getManager } from '@/lib/manager'
import { getRazorpayPayment, verifyCheckoutSignature } from '@/lib/razorpay'

export async function POST(request) {
  const manager = await getManager()
  if (!manager) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = body
  if (!orderId || !paymentId || !signature) {
    return NextResponse.json({ error: 'Missing payment confirmation details' }, { status: 400 })
  }

  try {
    if (!verifyCheckoutSignature(orderId, paymentId, signature)) {
      return NextResponse.json({ error: 'Payment signature could not be verified' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: payment, error } = await admin
      .from('payments')
      .select('*')
      .eq('profile_id', manager.id)
      .eq('razorpay_order_id', orderId)
      .maybeSingle()
    if (error) throw new Error(`Could not find payment order: ${error.message}`)
    if (!payment) return NextResponse.json({ error: 'Payment order not found' }, { status: 404 })
    if (payment.status === 'paid' && payment.razorpay_payment_id === paymentId) {
      return NextResponse.json({ ok: true })
    }
    if (payment.status !== 'pending') {
      return NextResponse.json({ error: 'This payment order is no longer pending' }, { status: 409 })
    }

    const providerPayment = await getRazorpayPayment(paymentId)
    if (
      providerPayment.order_id !== orderId ||
      providerPayment.amount !== payment.amount_paise ||
      providerPayment.currency !== payment.currency
    ) {
      return NextResponse.json({ error: 'Payment details do not match the order' }, { status: 400 })
    }
    if (providerPayment.status !== 'captured') {
      if (providerPayment.status === 'authorized') {
        const { error: pendingError } = await admin
          .from('payments')
          .update({ razorpay_payment_id: paymentId, updated_at: new Date().toISOString() })
          .eq('id', payment.id)
          .eq('status', 'pending')
        if (pendingError) throw new Error(`Could not record pending payment: ${pendingError.message}`)
      }
      return NextResponse.json({ error: 'Payment is still being confirmed' }, { status: 409 })
    }

    const { error: updateError } = await admin
      .from('payments')
      .update({ razorpay_payment_id: paymentId, status: 'paid', updated_at: new Date().toISOString() })
      .eq('id', payment.id)
      .eq('status', 'pending')
    if (updateError) throw new Error(`Could not update payment status: ${updateError.message}`)

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Could not verify payment' }, { status: 500 })
  }
}
