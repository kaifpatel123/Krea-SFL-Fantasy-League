export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse pt-10">
      <span className="sr-only">Loading page</span>
      <div className="h-8 w-40 bg-white/10 mb-6" />
      <div className="h-12 w-64 bg-white/10 mb-8" />
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="h-80 border border-white/10 bg-white/5" />
        <div className="h-80 border border-white/10 bg-white/5" />
      </div>
    </div>
  );
}
