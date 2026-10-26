import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getManager } from '@/lib/manager'
import { getRazorpayPayment } from '@/lib/razorpay'
import { hasPaidEntry } from '@/lib/payments'

export const dynamic = 'force-dynamic'

export async function GET() {
  const manager = await getManager()
  if (!manager) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  try {
    if (await hasPaidEntry(manager.id)) return NextResponse.json({ paid: true })

    const admin = createAdminClient()
    const { data: payment, error } = await admin
      .from('payments')
      .select('id, razorpay_order_id, razorpay_payment_id, amount_paise, currency')
      .eq('profile_id', manager.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(`Could not check payment status: ${error.message}`)

    if (payment?.razorpay_payment_id) {
      const providerPayment = await getRazorpayPayment(payment.razorpay_payment_id)
      if (
        providerPayment.order_id === payment.razorpay_order_id &&
        providerPayment.amount === payment.amount_paise &&
        providerPayment.currency === payment.currency &&
        providerPayment.status === 'captured'
      ) {
        const { error: updateError } = await admin
          .from('payments')
          .update({ status: 'paid', updated_at: new Date().toISOString() })
          .eq('id', payment.id)
          .eq('status', 'pending')
        if (updateError) throw new Error(`Could not update payment status: ${updateError.message}`)
        return NextResponse.json({ paid: true })
      }
    }

    return NextResponse.json({ paid: false })
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Could not check payment status' }, { status: 500 })
  }
}
