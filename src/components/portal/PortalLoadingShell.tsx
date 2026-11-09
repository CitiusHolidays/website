/**
 * Generic Staff Workspace shell streamed while portal auth resolves. Its chrome uses the same
 * geometry as `PortalShell` (fixed full-height sidebar, header offset by the sidebar, main
 * padding and content width) so the authorized workspace replaces it without the frame moving.
 * It carries no identity, role-derived navigation, counts, or CRM records.
 */
export default function PortalLoadingShell() {
  return (
    <div
      aria-busy="true"
      className="portal-shell relative min-h-screen overflow-x-hidden bg-white text-brand-dark"
    >
      <span aria-live="polite" className="sr-only" role="status">
        Loading Citius Connect
      </span>

      <header className="sticky top-0 border-brand-border border-b bg-white lg:ml-[var(--portal-sidebar-width)]">
        <div className="flex h-[var(--portal-chrome-height)] items-center justify-between gap-2 px-3 sm:px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
            <div aria-hidden="true" className="size-11 shrink-0 rounded-full lg:hidden" />
            <span className="truncate font-semibold text-citius-blue text-sm lg:hidden">
              Citius Connect
            </span>
          </div>
          <span className="rounded-full border border-brand-border bg-brand-light px-3 py-1.5 text-brand-muted text-xs">
            Loading workspace…
          </span>
        </div>
      </header>

      <div className="flex min-h-[calc(100dvh-var(--portal-chrome-height))]">
        <aside
          aria-hidden="true"
          className="fixed inset-y-0 left-0 hidden w-[var(--portal-sidebar-width)] flex-col border-brand-border border-r bg-brand-light lg:flex"
        >
          <div className="flex h-[var(--portal-chrome-height)] shrink-0 items-center px-5">
            <span className="font-semibold text-citius-blue text-sm">Citius Connect</span>
          </div>
          <div className="space-y-2 px-4 py-4">
            <div className="h-11 rounded-[var(--portal-control-radius)] bg-brand-border/45" />
            <div className="h-11 rounded-[var(--portal-control-radius)] bg-brand-border/45" />
            <div className="h-11 rounded-[var(--portal-control-radius)] bg-brand-border/45" />
            <div className="h-11 rounded-[var(--portal-control-radius)] bg-brand-border/45" />
            <div className="h-11 rounded-[var(--portal-control-radius)] bg-brand-border/45" />
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:ml-[var(--portal-sidebar-width)] lg:p-8">
          <div className="mx-auto max-w-[1500px] space-y-6">
            <div className="space-y-3">
              <div aria-hidden="true" className="h-8 w-56 rounded-lg bg-brand-border/60" />
              <p className="text-brand-muted text-sm">Checking staff access…</p>
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
