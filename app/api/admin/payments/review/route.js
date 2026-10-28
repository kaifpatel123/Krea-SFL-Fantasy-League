import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/manager'

export async function POST(request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const paymentId = body?.paymentId
  const action = body?.action
  if (!paymentId || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'A payment record and valid review action are required' }, { status: 400 })
  }

  const status = action === 'approve' ? 'paid' : 'rejected'
  const { data, error } = await createAdminClient()
    .from('payments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', paymentId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'This payment is no longer awaiting review' }, { status: 409 })

  return NextResponse.json({ ok: true, status })
}
