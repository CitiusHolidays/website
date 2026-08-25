export default function PortalLoadingShell() {
  return (
    <div
      aria-busy="true"
      className="portal-shell min-h-screen overflow-x-hidden bg-brand-light text-brand-dark"
    >
      <span aria-live="polite" className="sr-only" role="status">
        Loading Citius Connect
      </span>

      <header className="h-[var(--portal-chrome-height)] border-brand-border/80 border-b bg-white">
        <div className="flex h-full items-center justify-between gap-3 px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div aria-hidden="true" className="size-8 rounded-lg bg-citius-blue" />
            <span className="truncate font-semibold text-citius-blue text-sm">Citius Connect</span>
          </div>
          <span className="rounded-full border border-brand-border bg-brand-light px-3 py-1.5 text-brand-muted text-xs">
            Securing workspace…
          </span>
        </div>
      </header>

      <div className="flex min-h-[calc(100dvh-var(--portal-chrome-height))]">
        <aside
          aria-hidden="true"
          className="hidden w-64 shrink-0 border-brand-border/80 border-r bg-white lg:block"
        >
          <div className="space-y-3 px-6 py-8">
            <div className="h-3 w-20 rounded bg-brand-border/60" />
            <div className="h-10 rounded-xl bg-brand-border/45" />
            <div className="h-10 rounded-xl bg-brand-border/45" />
            <div className="h-10 rounded-xl bg-brand-border/45" />
            <div className="mt-8 h-3 w-24 rounded bg-brand-border/60" />
            <div className="h-10 rounded-xl bg-brand-border/45" />
            <div className="h-10 rounded-xl bg-brand-border/45" />
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-4 sm:p-5 md:p-8 lg:p-10">
          <div className="mx-auto max-w-[1500px] space-y-6">
            <div className="space-y-3">
              <div aria-hidden="true" className="h-8 w-56 rounded-lg bg-brand-border/60" />
              <p className="text-brand-muted text-sm">Checking your secure staff access…</p>
            </div>
            <div
              aria-hidden="true"
              className="min-h-[22rem] rounded-2xl border border-brand-border bg-white p-5"
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
