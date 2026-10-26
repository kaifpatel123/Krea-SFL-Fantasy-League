'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLogin() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    setBusy(false)
    if (!res.ok) {
      setError('Wrong passcode.')
      return
    }
    router.refresh()
  }

  return (
    <div className="pt-12 max-w-sm">
      <h1 className="font-display text-4xl text-chalk mb-4">ADMIN</h1>
      <p className="text-chalk/60 mb-6">Enter the admin passcode to manage results, stats and gameweeks.</p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Passcode"
          className="bg-ink border border-white/20 px-4 py-3 text-chalk placeholder:text-chalk/30 focus:border-gold outline-none"
        />
        <button disabled={busy || !code} className="bg-gold text-ink font-display text-lg px-6 py-3 disabled:opacity-50">
          {busy ? 'CHECKING...' : 'ENTER'}
        </button>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </form>
    </div>
  )
}
