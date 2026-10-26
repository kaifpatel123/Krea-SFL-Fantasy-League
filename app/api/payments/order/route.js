import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getManager } from '@/lib/manager'
import { getEntryFeePaise } from '@/lib/payments'
import { createRazorpayOrder } from '@/lib/razorpay'

export async function POST() {
  const manager = await getManager()
  if (!manager) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  try {
    const admin = createAdminClient()
    const { data: paidPayment, error: paymentError } = await admin
      .from('payments')
      .select('id')
      .eq('profile_id', manager.id)
      .eq('status', 'paid')
      .limit(1)
      .maybeSingle()
    if (paymentError) throw new Error(`Could not check payment status: ${paymentError.message}`)
    if (paidPayment) return NextResponse.json({ error: 'League entry is already paid' }, { status: 409 })

    const { data: pendingPayment, error: pendingError } = await admin
      .from('payments')
      .select('razorpay_order_id, amount_paise')
      .eq('profile_id', manager.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (pendingError) throw new Error(`Could not check pending payment: ${pendingError.message}`)
    if (pendingPayment) {
      return NextResponse.json({
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: pendingPayment.razorpay_order_id,
        amount: pendingPayment.amount_paise,
        currency: 'INR',
        name: manager.display_name || 'FSFL Manager',
      })
    }

    const amount = await getEntryFeePaise()
    const order = await createRazorpayOrder({
      amount,
      receipt: `fsfl_${manager.id.replaceAll('-', '').slice(0, 20)}_${Date.now()}`,
      notes: { profile_id: manager.id },
    })
    const { error } = await admin.from('payments').insert({
      profile_id: manager.id,
      razorpay_order_id: order.id,
      amount_paise: amount,
      currency: 'INR',
      status: 'pending',
    })
    if (error) {
      const { data: concurrentPayment, error: lookupError } = await admin
        .from('payments')
        .select('razorpay_order_id, amount_paise')
        .eq('profile_id', manager.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (lookupError || !concurrentPayment) {
        throw new Error(`Razorpay order was created but could not be recorded: ${error.message}`)
      }
      return NextResponse.json({
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: concurrentPayment.razorpay_order_id,
        amount: concurrentPayment.amount_paise,
        currency: 'INR',
        name: manager.display_name || 'FSFL Manager',
      })
    }

    return NextResponse.json({
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount,
      currency: 'INR',
      name: manager.display_name || 'FSFL Manager',
    })
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Could not start payment' }, { status: 500 })
  }
}
