/**
 * PageSkeleton — generic loading skeleton for Suspense fallbacks.
 * Reserves layout space to eliminate CLS during lazy page loads.
 * Uses theme-consistent dark colors (slate-800/700).
 */
export default function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header placeholder */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-48 bg-slate-800 rounded-lg" />
          <div className="h-4 w-72 bg-slate-800/60 rounded mt-2" />
        </div>
        <div className="h-10 w-40 bg-slate-800 rounded-xl hidden md:block" />
      </div>

      {/* Hero/Banner placeholder */}
      <div className="h-24 md:h-28 bg-slate-800 rounded-2xl" />

      {/* Cards grid placeholder */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl p-4 h-28 bg-slate-800/70 border border-slate-700/30">
            <div className="w-10 h-10 rounded-full bg-slate-700 mx-auto mb-3" />
            <div className="h-3 w-16 bg-slate-700 rounded mx-auto" />
          </div>
        ))}
      </div>

      {/* List placeholder */}
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 bg-slate-800/50 rounded-xl border border-slate-700/20" />
        ))}
      </div>
    </div>
  );
}
