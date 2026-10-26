import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/manager'
import { getEntryFeePaise } from '@/lib/payments'

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  try {
    return NextResponse.json({ amountPaise: await getEntryFeePaise() })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const amount = Number(body.amountRupees)
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100000) {
    return NextResponse.json({ error: 'Enter a whole amount between ₹1 and ₹100,000' }, { status: 400 })
  }

  const { error } = await createAdminClient()
    .from('app_settings')
    .upsert({ key: 'entry_fee_paise', value: amount * 100, updated_at: new Date().toISOString() })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, amountPaise: amount * 100 })
}
