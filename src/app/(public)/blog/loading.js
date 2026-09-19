export default function JournalLoading() {
  return (
    <section
      aria-label="Loading Citius Journal"
      className="min-h-screen bg-public-paper"
      role="status"
    >
      <div className="bg-public-night px-5 pt-28 pb-8 text-white sm:px-8 sm:pt-32 sm:pb-10">
        <div className="mx-auto max-w-6xl">
          <h1 className="font-heading font-semibold text-3xl sm:text-4xl">Citius Journal</h1>
          <p className="mt-4 text-white/75">Loading stories…</p>
        </div>
      </div>
      <div
        aria-hidden="true"
        className="mx-auto max-w-6xl animate-pulse space-y-5 px-5 py-10 motion-reduce:animate-none sm:px-8"
      >
        <div className="h-9 w-4/5 max-w-xl rounded bg-public-ink/10" />
        <div className="h-9 w-3/5 max-w-lg rounded bg-public-ink/10" />
        <div className="h-5 w-4/5 max-w-xl rounded bg-public-ink/5" />
      </div>
    </section>
  );
}
