'use client'

import { useEffect, useMemo, useState } from 'react'

async function request(url, options) {
  const response = await fetch(url, options)
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'Request failed')
  return result
}

export default function AdminPayments() {
  const [payments, setPayments] = useState([])
  const [fee, setFee] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    const [paymentResult, feeResult] = await Promise.all([
      request('/api/admin/payments'),
      request('/api/admin/payments/fee'),
    ])
    setPayments(paymentResult.payments)
    setFee(String(feeResult.amountPaise / 100))
  }

  useEffect(() => {
    refresh().catch((error) => setMessage(error.message))
  }, [])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return payments.filter((payment) => {
      if (statusFilter !== 'all' && payment.status !== statusFilter) return false
      if (!query) return true
      return [
        payment.manager_name,
        payment.manager_email,
        payment.razorpay_order_id,
        payment.razorpay_payment_id,
        payment.razorpay_refund_id,
      ].some((value) => String(value || '').toLowerCase().includes(query))
    })
  }, [payments, search, statusFilter])

  async function saveFee(event) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      await request('/api/admin/payments/fee', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountRupees: fee }),
      })
      setMessage('Entry fee updated.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function refund(payment) {
    if (!window.confirm(`Issue a full refund of ₹${(payment.amount_paise / 100).toFixed(0)} to ${payment.manager_name || payment.manager_email}?`)) {
      return
    }
    setBusy(true)
    setMessage('')
    try {
      await request('/api/admin/payments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: payment.id }),
      })
      await refresh()
      setMessage('Refund requested. Access is suspended until the refund completes.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      <section className="border border-white/10 p-4">
        <h2 className="font-display text-xl text-gold mb-3">ENTRY FEE</h2>
        <form onSubmit={saveFee} className="flex flex-wrap items-end gap-3">
          <label className="text-chalk/70 text-sm">
            Amount (INR)
            <input
              type="number"
              min="1"
              max="100000"
              step="1"
              required
              value={fee}
              onChange={(event) => setFee(event.target.value)}
              className="block mt-1 w-36 bg-ink border border-white/20 px-3 py-2 text-chalk"
            />
          </label>
          <button disabled={busy} className="bg-gold text-ink font-display px-4 py-2 disabled:opacity-50">
            SAVE FEE
          </button>
        </form>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <h2 className="font-display text-xl text-gold">PAYMENT RECORDS</h2>
          <a
            href="/api/admin/payments?export=csv"
            className="text-chalk/70 text-sm underline hover:text-gold"
          >
            Export CSV
          </a>
        </div>
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search manager, email, or payment ID"
            className="min-w-60 flex-1 bg-ink border border-white/20 px-3 py-2 text-chalk"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="bg-ink border border-white/20 px-3 py-2 text-chalk"
          >
            {['all', 'pending', 'paid', 'refund_pending', 'refunded'].map((status) => (
              <option key={status} value={status}>{status.replace('_', ' ').toUpperCase()}</option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto border border-white/10">
          <table className="w-full min-w-[780px] text-sm text-left">
            <thead className="text-chalk/50 border-b border-white/10">
              <tr>
                <th className="p-3">Manager</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Status</th>
                <th className="p-3">Payment ID</th>
                <th className="p-3">Date</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((payment) => (
                <tr key={payment.id}>
                  <td className="p-3">
                    <div className="text-chalk">{payment.manager_name || 'Unnamed manager'}</div>
                    <div className="text-chalk/40 text-xs">{payment.manager_email}</div>
                  </td>
                  <td className="p-3 text-chalk">₹{(payment.amount_paise / 100).toFixed(2)}</td>
                  <td className="p-3 text-gold">{payment.status.replace('_', ' ').toUpperCase()}</td>
                  <td className="p-3 text-chalk/60 text-xs break-all">
                    {payment.razorpay_payment_id || payment.razorpay_order_id}
                  </td>
                  <td className="p-3 text-chalk/60 whitespace-nowrap">
                    {new Date(payment.created_at).toLocaleString()}
                  </td>
                  <td className="p-3">
                    {payment.status === 'paid' && (
                      <button
                        disabled={busy}
                        onClick={() => refund(payment)}
                        className="text-red-300 underline disabled:opacity-50"
                      >
                        Refund
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan="6" className="p-5 text-center text-chalk/40">No matching payments.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {message && <p role="status" className="text-chalk/70 text-sm">{message}</p>}
    </div>
  )
}
