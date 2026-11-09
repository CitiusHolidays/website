const TABLE_COLUMNS = [
  "query",
  "client",
  "lifecycle",
  "budget",
  "stage",
  "owner",
  "files",
  "action",
];
const TABLE_ROWS = ["one", "two", "three", "four", "five"];
const MOBILE_ROWS = ["one", "two", "three"];

function LoadingBlock({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`rounded-md bg-brand-light motion-safe:animate-pulse ${className}`}
    />
  );
}

function QueryTableSkeleton() {
  return (
    <div
      className="hidden overflow-hidden rounded-2xl border border-brand-border bg-white md:block"
      data-testid="queries-loading-table"
    >
      <div
        className="grid gap-4 border-brand-border border-b bg-brand-light/80 px-4 py-3"
        style={{ gridTemplateColumns: `repeat(${TABLE_COLUMNS.length}, minmax(0, 1fr))` }}
      >
        {TABLE_COLUMNS.map((column) => (
          <LoadingBlock className="h-3" key={`header-${column}`} />
        ))}
      </div>
      {TABLE_ROWS.map((row) => (
        <div
          className="grid gap-4 border-brand-border border-b px-4 py-5 last:border-b-0"
          key={row}
          style={{ gridTemplateColumns: `repeat(${TABLE_COLUMNS.length}, minmax(0, 1fr))` }}
        >
          {TABLE_COLUMNS.map((column, columnIndex) => (
            <LoadingBlock
              className={columnIndex === 0 ? "h-4 w-4/5" : "h-4 w-3/5"}
              key={`${row}-${column}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function QueryMobileSkeleton() {
  return (
    <div className="space-y-3 md:hidden" data-testid="queries-loading-cards">
      {MOBILE_ROWS.map((row) => (
        <div className="rounded-2xl border border-brand-border bg-white p-4" key={row}>
          <LoadingBlock className="h-4 w-2/5" />
          <LoadingBlock className="mt-3 h-5 w-4/5" />
          <div className="mt-5 grid grid-cols-2 gap-3">
            <LoadingBlock className="h-10" />
            <LoadingBlock className="h-10" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function QueriesLoadingPanel() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading All Sales Queries"
      className="space-y-4"
      data-testid="queries-loading-panel"
    >
      <div className="sr-only" role="status">
        Loading All Sales Queries
      </div>
      {/* Mirrors PortalListToolbar for Queries: sticky under the chrome, title row with the
          New Query action, then search, Filters toggle and the command palette trigger. The
          Queries filter row starts collapsed, so it is not reserved here. */}
      <div
        className="sticky top-[var(--portal-chrome-height)] mb-4 border-brand-border border-b bg-white py-4"
        data-testid="queries-loading-toolbar"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <LoadingBlock className="h-8 w-48" />
            <LoadingBlock className="h-4 w-28" />
          </div>
          <LoadingBlock className="h-11 w-32 shrink-0" />
        </div>
        <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2">
          <LoadingBlock className="h-11 min-w-[8rem] flex-1 sm:max-w-72" />
          <LoadingBlock className="h-11 w-28 shrink-0" />
          <LoadingBlock className="h-11 w-11 shrink-0 sm:w-[4.5rem]" />
        </div>
      </div>
      <QueryMobileSkeleton />
      <QueryTableSkeleton />
    </section>
  );
}
