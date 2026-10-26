// Floodlit header band shared by the inner pages.
export default function PageHeader({ title, sub, children, photo = '/photos/match-attack.webp' }) {
  return (
    <section className="duotone relative left-1/2 -ml-[50vw] w-screen mb-10 -mt-px">
      <img src={photo} alt="" className="absolute inset-0 w-full h-full object-cover object-[50%_55%]" />
      <div className="relative z-10 max-w-6xl mx-auto px-4 pt-14 pb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="font-display text-5xl md:text-7xl text-chalk leading-[0.9]">{title}</h1>
          {sub && <p className="text-chalk/70 mt-3 max-w-xl">{sub}</p>}
        </div>
        {children}
      </div>
    </section>
  )
}
