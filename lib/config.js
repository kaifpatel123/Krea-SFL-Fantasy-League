// Test mode skips sign-in: anyone can create a test manager with just a team name.
// Set NEXT_PUBLIC_TEST_MODE=false in Vercel to switch on Google sign-in (Krea accounts only).
export const TEST_MODE = process.env.NEXT_PUBLIC_TEST_MODE !== 'false'

export const SQUAD_SIZE = 8
export const STARTERS = 6 // goalkeeper + 5 outfield; the other 2 are subs and don't score
export const QUOTA = { GK: 1, DEF: 3, MID: 3, FWD: 1 }
export const POSITIONS = ['GK', 'DEF', 'MID', 'FWD']
export const BUDGET = 100

// Sign-in is limited to Krea Google accounts.
export const ALLOWED_EMAIL_DOMAINS = (process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS || 'krea.ac.in,krea.edu.in')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean)

export function isAllowedEmail(email) {
  const domain = String(email || '').toLowerCase().split('@')[1]
  return !!domain && ALLOWED_EMAIL_DOMAINS.includes(domain)
}

// Transfers: 1 free per gameweek (no rollover). Each extra transfer costs points.
export const FREE_TRANSFERS = 1
export const TRANSFER_HIT = 4

export function transferHit(transfersUsed) {
  return Math.max(0, (transfersUsed || 0) - FREE_TRANSFERS) * TRANSFER_HIT
}
