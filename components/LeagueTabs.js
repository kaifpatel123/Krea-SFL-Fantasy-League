import Link from 'next/link'

export default function LeagueTabs({ league, base }) {
  return (
    <div className="flex bg-ink/70 backdrop-blur border border-white/15">
      {['MSFL', 'WSFL'].map((l) => (
        <Link
          key={l}
          href={`${base}?league=${l}`}
          className={`px-4 py-2 font-display tracking-wider text-sm ${
            league === l ? 'bg-gold text-ink' : 'text-chalk/70 hover:text-gold'
          }`}
        >
          {l === 'MSFL' ? "MEN'S" : "WOMEN'S"}
        </Link>
      ))}
    </div>
  )
}
