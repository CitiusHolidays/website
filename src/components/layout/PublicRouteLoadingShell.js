const TONE_CLASSES = {
  dark: "min-h-[max(100dvh,700px)] bg-public-night text-white",
  light: "min-h-[70vh] bg-public-paper text-public-ink",
  sacred: "min-h-[70vh] bg-[#fdfcfb] text-public-ink",
};

export default function PublicRouteLoadingShell({ description, eyebrow, title, tone = "light" }) {
  return (
    <section
      aria-label={`Loading ${title}`}
      className={`flex items-center px-6 py-28 ${TONE_CLASSES[tone] || TONE_CLASSES.light}`}
      role="status"
    >
      <div className="mx-auto w-full max-w-5xl">
        <p className="font-semibold text-public-orange-ink text-xs uppercase tracking-[0.24em]">
          {eyebrow}
        </p>
        <h1 className="mt-4 max-w-3xl font-heading text-4xl leading-tight md:text-6xl">{title}</h1>
        <p
          className={`mt-5 max-w-2xl text-base md:text-lg ${tone === "dark" ? "text-white/75" : "text-public-muted"}`}
        >
          {description}
        </p>
        <div
          aria-hidden="true"
          className={`mt-10 h-1 w-24 rounded-full ${tone === "dark" ? "bg-public-orange" : "bg-public-orange-ink"}`}
        />
      </div>
    </section>
  );
}
