import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/manager'

function csvValue(value) {
  let text = String(value ?? '')
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

export async function GET(request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const admin = createAdminClient()
  const { data: payments, error } = await admin
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const profileIds = Array.from(new Set((payments || []).map((payment) => payment.profile_id)))
  const { data: profiles, error: profileError } = profileIds.length
    ? await admin.from('profiles').select('id, display_name, email').in('id', profileIds)
    : { data: [], error: null }
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  const profileById = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]))
  const records = (payments || []).map((payment) => ({
    ...payment,
    manager_name: profileById[payment.profile_id]?.display_name || '',
    manager_email: profileById[payment.profile_id]?.email || '',
  }))

  if (new URL(request.url).searchParams.get('export') === 'csv') {
    const fields = [
      'manager_name',
      'manager_email',
      'amount_inr',
      'currency',
      'status',
      'razorpay_order_id',
      'razorpay_payment_id',
      'razorpay_refund_id',
      'created_at',
      'updated_at',
    ]
    const csvRecords = records.map((record) => ({ ...record, amount_inr: (record.amount_paise / 100).toFixed(2) }))
    const csv = [fields.join(','), ...csvRecords.map((record) => fields.map((field) => csvValue(record[field])).join(','))]
      .join('\r\n')
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="fsfl-payments.csv"',
        'Cache-Control': 'no-store',
      },
    })
  }

  return NextResponse.json({ payments: records })
}
