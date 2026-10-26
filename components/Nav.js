'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/table', label: 'League' },
  { href: '/stats', label: 'Stats' },
  { href: '/leaderboard', label: 'Fantasy table' },
  { href: '/admin', label: 'Admin' },
]

export default function Nav() {
  const path = usePathname()
  const active = (href) => path === href || path.startsWith(href + '/')

  return (
    <header className="sticky top-0 z-40 bg-ink/85 backdrop-blur-md border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="SFL Fantasy home">
          <span className="flex -space-x-2">
            <img src="/logos/krea-sports.webp" alt="" width="32" height="32" className="w-8 h-8 rounded-full ring-2 ring-ink" />
            <img src="/logos/eco-club.webp" alt="" width="32" height="32" className="w-8 h-8 rounded-full ring-2 ring-ink" />
          </span>
          <span className="font-display text-xl text-chalk leading-none tracking-wide">
            SFL <span className="text-gold">FANTASY</span>
          </span>
        </Link>

        <nav className="flex-1 min-w-0 flex justify-end gap-1 overflow-x-auto no-scrollbar text-sm">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active(l.href) ? 'page' : undefined}
              className={`px-3 py-2 whitespace-nowrap transition-colors ${
                active(l.href) ? 'text-gold' : 'text-chalk/75 hover:text-chalk'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/squad"
          className={`shrink-0 font-display tracking-wide text-ink px-4 py-2 transition-colors ${
            active('/squad') ? 'bg-chalk' : 'bg-gold hover:bg-chalk'
          }`}
        >
          MY SQUAD
        </Link>
      </div>
    </header>
  )
}
