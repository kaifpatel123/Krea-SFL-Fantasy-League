import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-white/10 bg-ink">
      <div className="max-w-6xl mx-auto px-4 py-10 grid gap-8 sm:grid-cols-[1fr_auto] items-start">
        <div className="flex items-center gap-4">
          <img src="/logos/krea-sports.webp" alt="Krea Sports Club" width="56" height="56" className="w-14 h-14 rounded-full" />
          <img src="/logos/eco-club.webp" alt="Economics Club, Krea University" width="56" height="56" className="w-14 h-14 rounded-full" />
          <p className="text-chalk/60 text-sm max-w-xs">
            Run by the SIAS Sports Club and the Economics Club, Krea University, alongside the SIAS Football League.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-chalk/60">
          <Link href="/table" className="hover:text-gold">League table</Link>
          <Link href="/stats" className="hover:text-gold">Player stats</Link>
          <Link href="/leaderboard" className="hover:text-gold">Fantasy table</Link>
          <Link href="/squad" className="hover:text-gold">My squad</Link>
        </nav>
      </div>
    </footer>
  )
}
