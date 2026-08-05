export default function PortalLoadingShell() {
  return (
    <div
      aria-busy="true"
      className="portal-shell min-h-screen overflow-x-hidden bg-brand-light text-brand-dark"
    >
      <span aria-live="polite" className="sr-only" role="status">
        Loading Citius Connect portal
      </span>

      <header className="sticky top-0 z-50 h-[4.25rem] border-brand-border/80 border-b bg-white/90 shadow-sm">
        <div className="flex h-full items-center justify-between gap-3 px-3 sm:px-4 lg:px-6">
          <div aria-hidden className="flex items-center gap-3 motion-safe:animate-pulse">
            <div className="h-8 w-36 rounded-lg bg-brand-border/60 sm:h-9 sm:w-44" />
            <div className="hidden h-7 w-24 rounded-full bg-brand-border/50 sm:block" />
          </div>
          <div aria-hidden className="flex items-center gap-2 motion-safe:animate-pulse">
            <div className="h-9 w-9 rounded-full bg-brand-border/50" />
            <div className="hidden h-9 w-28 rounded-full bg-brand-border/50 sm:block" />
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-68px)]">
        <aside
          aria-hidden
          className="hidden w-64 shrink-0 border-brand-border/80 border-r bg-white/80 lg:block"
        >
          <div className="space-y-3 px-6 py-8 motion-safe:animate-pulse">
            <div className="h-3 w-20 rounded bg-brand-border/50" />
            <div className="h-10 rounded-xl bg-brand-border/40" />
            <div className="h-10 rounded-xl bg-brand-border/40" />
            <div className="h-10 rounded-xl bg-brand-border/40" />
            <div className="mt-8 h-3 w-24 rounded bg-brand-border/50" />
            <div className="h-10 rounded-xl bg-brand-border/40" />
            <div className="h-10 rounded-xl bg-brand-border/40" />
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-4 sm:p-5 md:p-8 lg:p-10" id="portal-main">
          <div className="mx-auto max-w-[1500px] space-y-6">
            <div aria-hidden className="space-y-3 motion-safe:animate-pulse">
              <div className="h-8 w-56 rounded-lg bg-brand-border/60" />
              <div className="h-4 w-80 max-w-full rounded bg-brand-border/40" />
            </div>
            <div
              aria-hidden
              className="min-h-[22rem] rounded-2xl border border-brand-border bg-white p-5 motion-safe:animate-pulse"
            >
              <div className="mb-6 flex gap-3">
                <div className="h-10 flex-1 rounded-xl bg-brand-border/40" />
                <div className="h-10 w-28 rounded-xl bg-brand-border/40" />
              </div>
              <div className="space-y-4">
                <div className="h-12 rounded-xl bg-brand-border/35" />
                <div className="h-12 rounded-xl bg-brand-border/35" />
                <div className="h-12 rounded-xl bg-brand-border/35" />
                <div className="h-12 rounded-xl bg-brand-border/35" />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
