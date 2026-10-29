'use client'

export default function EntryPayment({ amountPaise, payment, formUrl, qrUrl, upiId, payeeName }) {
  return (
    <div className="pt-12 max-w-lg">
      <p className="font-display text-gold text-sm tracking-[0.3em] mb-3">LEAGUE ENTRY</p>
      <h1 className="font-display text-4xl text-chalk mb-4">PAY TO UNLOCK YOUR SQUAD</h1>
      <p className="text-chalk/60 mb-6">
        Pay the one-time entry fee of <span className="text-gold">₹{(amountPaise / 100).toFixed(0)}</span> using
        the official payment QR, then submit your proof through the Krea form.
      </p>

      {qrUrl && (
        <img
          src={qrUrl}
          alt="Official league entry payment QR code"
          className="w-56 h-56 object-contain bg-white p-2 mb-5"
        />
      )}
      {(payeeName || upiId) && (
        <div className="border border-white/10 p-4 mb-5 text-sm">
          {payeeName && (
            <p className="text-chalk">
              Payee: <span className="text-gold">{payeeName}</span>
            </p>
          )}
          {upiId && (
            <p className="text-chalk mt-1">
              UPI ID: <span className="text-gold">{upiId}</span>
            </p>
          )}
        </div>
      )}

      {payment?.status === 'pending' ? (
        <div className="border border-gold/30 p-4">
          <p className="font-display text-gold">PAYMENT UNDER REVIEW</p>
          <p className="text-chalk/60 text-sm mt-2">
            Your payment proof was submitted for {payment.submitted_email}. An admin will review it before squad access
            is enabled. Refresh this page after approval to unlock your squad.
          </p>
          <p className="text-chalk/40 text-xs mt-2">Transaction reference: {payment.transaction_reference}</p>
        </div>
      ) : (
        <>
          {payment?.status === 'rejected' && (
            <p role="alert" className="text-red-300 text-sm mb-4">
              Your previous payment submission was not approved. Check the payment details and submit the form again.
            </p>
          )}
          {formUrl ? (
            <a
              href={formUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block bg-gold text-ink font-display text-lg px-6 py-3 tracking-wide"
            >
              I PAID — SUBMIT PROOF
            </a>
          ) : (
            <p role="alert" className="text-red-400 text-sm">
              Payment submission is not configured yet. Please contact the league admin.
            </p>
          )}
        </>
      )}
      <p className="text-chalk/40 text-xs mt-4">
        Use your Krea email and enter the transaction reference in the form. Squad access is enabled after admin
        approval.
      </p>
    </div>
  )
}
