import { createAdminClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/manager'
import AdminPanel from '@/components/AdminPanel'
import AdminLogin from '@/components/AdminLogin'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  if (!(await isAdmin())) return <AdminLogin />

  const supabase = createAdminClient()
  const [{ data: gameweeks }, { data: players }, { data: fixtures }, { data: teams }, { data: stats }] =
    await Promise.all([
      supabase.from('gameweeks').select('*').order('match_date', { ascending: true }),
      supabase.from('players').select('id, name, position, auction_team').order('name'),
      supabase.from('fixtures').select('*').order('match_date', { ascending: true }).order('id', { ascending: true }),
      supabase.from('teams').select('*'),
      supabase.from('player_stats').select('*'),
    ])

  return (
    <AdminPanel
      gameweeks={gameweeks || []}
      players={players || []}
      fixtures={fixtures || []}
      teams={teams || []}
      stats={stats || []}
    />
  )
}
