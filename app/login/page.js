'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { ALLOWED_EMAIL_DOMAINS } from '@/lib/config'

const ERRORS = {
  krea: 'Only Krea Google accounts can join. Sign in with your Krea email.',
  failed: 'Sign-in did not go through. Please try again.',
}

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  )
}

function Login() {
  const params = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(ERRORS[params.get('error')] || null)

  async function signIn() {
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          prompt: 'select_account',
          ...(ALLOWED_EMAIL_DOMAINS.length === 1 ? { hd: ALLOWED_EMAIL_DOMAINS[0] } : {}),
        },
      },
    })
    if (error) {
      setBusy(false)
      setError(error.message)
    }
  }

  return (
    <div className="pt-12 max-w-md">
      <h1 className="font-display text-4xl text-chalk mb-3">SIGN IN</h1>
      <p className="text-chalk/60 mb-6">
        Use your Krea Google account (@{ALLOWED_EMAIL_DOMAINS.join(' or @')}) to join SFL Fantasy.
      </p>
      <button
        onClick={signIn}
        disabled={busy}
        className="w-full flex items-center justify-center gap-3 bg-chalk text-ink font-display text-lg px-6 py-3 tracking-wide disabled:opacity-50 hover:bg-white transition-colors"
      >
        <GoogleMark />
        {busy ? 'OPENING GOOGLE...' : 'SIGN IN WITH GOOGLE'}
      </button>
      {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
    </div>
  )
}

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  )
}
