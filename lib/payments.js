import { createAdminClient } from '@/lib/supabase-server'

export const DEFAULT_ENTRY_FEE_PAISE = 10000
export const PAYMENT_REQUIRED = process.env.REQUIRE_PAYMENT !== 'false'

export async function getEntryFeePaise() {
  const { data, error } = await createAdminClient()
    .from('app_settings')
    .select('value')
    .eq('key', 'entry_fee_paise')
    .maybeSingle()
  if (error) throw new Error(`Could not load entry fee: ${error.message}`)
  if (!data || !Number.isSafeInteger(data.value) || data.value < 100) {
    throw new Error('Entry fee is not configured correctly')
  }
  return data.value
}

export async function hasPaidEntry(profileId) {
  const { data, error } = await createAdminClient()
    .from('payments')
    .select('id')
    .eq('profile_id', profileId)
    .eq('status', 'paid')
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`Could not check entry payment: ${error.message}`)
  return !!data
}

export async function getLatestEntryPayment(profileId) {
  const { data, error } = await createAdminClient()
    .from('payments')
    .select('status, submitted_email, transaction_reference')
    .eq('profile_id', profileId)
    .in('status', ['pending', 'rejected'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`Could not load entry payment: ${error.message}`)
  return data
}
