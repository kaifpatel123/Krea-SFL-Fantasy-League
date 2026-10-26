'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ManagerSetup({ signedIn = false }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    const res = await fetch('/api/manager', {
      method: signedIn ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(json.error || 'Something went wrong. Try again.')
      return
    }
    router.refresh()
  }

  return (
    <div className="pt-12 max-w-md">
      <p className="font-display text-gold text-sm tracking-[0.3em] mb-3">{signedIn ? 'WELCOME' : 'TEST MODE'}</p>
      <h1 className="font-display text-4xl text-chalk mb-4">NAME YOUR TEAM</h1>
      <p className="text-chalk/60 mb-6">
        {signedIn
          ? 'Pick a team name. This is what everyone sees on the fantasy table.'
          : 'Sign-in is switched off while we test. Pick a team name and you can start building a squad straight away.'}
      </p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="e.g. Vishant's XI"
          className="bg-ink border border-white/20 px-4 py-3 text-chalk placeholder:text-chalk/30 focus:border-gold outline-none"
        />
        <button
          disabled={busy || !name.trim()}
          className="bg-gold text-ink font-display text-lg px-6 py-3 tracking-wide disabled:opacity-50"
        >
          {busy ? 'SETTING UP...' : 'START PICKING'}
        </button>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </form>
    </div>
  )
}
