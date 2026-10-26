'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

async function loadCheckout() {
  if (window.Razorpay) return
  await new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = resolve
    script.onerror = () => reject(new Error('Could not load Razorpay Checkout'))
    document.body.appendChild(script)
  })
}

export default function EntryPayment({ amountPaise }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [confirmationPending, setConfirmationPending] = useState(false)
  const [error, setError] = useState('')

  async function pay() {
    setBusy(true)
    setError('')
    try {
      await loadCheckout()
      const orderResponse = await fetch('/api/payments/order', { method: 'POST' })
      const order = await orderResponse.json()
      if (!orderResponse.ok) throw new Error(order.error || 'Could not start payment')

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'SFL Fantasy',
        description: 'One-time league entry fee',
        order_id: order.orderId,
        prefill: { name: order.name },
        config: {
          display: {
            blocks: {
              upi: { name: 'Pay by UPI', instruments: [{ method: 'upi' }] },
            },
            sequence: ['block.upi'],
            preferences: { show_default_blocks: true },
          },
        },
        handler: async (response) => {
          try {
            const verifyResponse = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(response),
            })
            const result = await verifyResponse.json()
            if (!verifyResponse.ok) {
              if (verifyResponse.status === 409) setConfirmationPending(true)
              throw new Error(result.error || 'Payment verification failed')
            }
            setConfirmationPending(false)
            router.refresh()
          } catch (verificationError) {
            setError(verificationError.message || 'Payment is being confirmed. Refresh this page shortly.')
          } finally {
            setBusy(false)
          }
        },
        modal: {
          ondismiss: () => setBusy(false),
        },
      })
      checkout.on('payment.failed', (response) => {
        setError(response.error?.description || 'Payment failed. Please try again.')
        setBusy(false)
      })
      checkout.open()
    } catch (paymentError) {
      setError(paymentError.message || 'Could not start payment')
      setBusy(false)
    }
  }

  async function checkPayment() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/payments/status')
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not check payment')
      if (result.paid) {
        setConfirmationPending(false)
        router.refresh()
      } else {
        setError('Payment has not been confirmed yet. Wait a moment and check again.')
      }
    } catch (statusError) {
      setError(statusError.message || 'Could not check payment')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pt-12 max-w-lg">
      <p className="font-display text-gold text-sm tracking-[0.3em] mb-3">LEAGUE ENTRY</p>
      <h1 className="font-display text-4xl text-chalk mb-4">PAY TO UNLOCK YOUR SQUAD</h1>
      <p className="text-chalk/60 mb-6">
        Pay the one-time entry fee of <span className="text-gold">₹{(amountPaise / 100).toFixed(0)}</span> to build
        your squad and access the league.
      </p>
      <button
        onClick={pay}
        disabled={busy}
        className="bg-gold text-ink font-display text-lg px-6 py-3 tracking-wide disabled:opacity-50"
      >
        {busy ? 'OPENING CHECKOUT...' : `PAY ₹${(amountPaise / 100).toFixed(0)} WITH RAZORPAY`}
      </button>
      <p className="text-chalk/40 text-xs mt-4">UPI and other Razorpay Checkout methods are available.</p>
      {confirmationPending && (
        <button
          onClick={checkPayment}
          disabled={busy}
          className="block mt-4 text-gold text-sm underline disabled:opacity-50"
        >
          {busy ? 'CHECKING...' : 'CHECK PAYMENT STATUS'}
        </button>
      )}
      {error && <p role="alert" className="text-red-400 text-sm mt-4">{error}</p>}
    </div>
  )
}
