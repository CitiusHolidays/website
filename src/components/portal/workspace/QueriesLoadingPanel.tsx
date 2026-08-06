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
      <div
        className="sticky top-16 z-10 mb-4 border-brand-border border-b bg-brand-light/95 py-2 backdrop-blur-sm"
        data-testid="queries-loading-toolbar"
      >
        <div className="flex min-h-11 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <LoadingBlock className="h-7 w-48" />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <LoadingBlock className="h-11 w-full min-w-40 sm:w-56" />
            <LoadingBlock className="hidden h-11 w-24 sm:block" />
            <LoadingBlock className="hidden h-11 w-28 sm:block" />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 border-brand-border/60 border-t pt-2">
          <LoadingBlock className="h-11 w-28" />
          <LoadingBlock className="h-11 w-32" />
          <LoadingBlock className="h-11 w-36" />
        </div>
      </div>
      <QueryMobileSkeleton />
      <QueryTableSkeleton />
    </section>
  );
}
