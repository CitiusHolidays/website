import {
  formatJournalDate,
  formatReadingTime,
  getJournalDate,
  getReadingMinutes,
  readingMinutesFromWords,
} from "./journalContent";

function resolveMinutes(post) {
  if (Number.isFinite(post?.wordCount)) {
    return readingMinutesFromWords(post.wordCount);
  }
  return Array.isArray(post?.body) ? getReadingMinutes(post.body) : null;
}

/** Date and reading time on one line. Omits the date instead of printing a placeholder. */
export default function JournalMeta({ className = "", post }) {
  const date = getJournalDate(post);
  const formatted = formatJournalDate(date);
  const minutes = resolveMinutes(post);
  const readingTime = minutes ? formatReadingTime(minutes) : null;

  if (!(formatted || readingTime)) {
    return null;
  }

  return (
    <p className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-sm tabular-nums ${className}`}>
      {formatted ? <time dateTime={date}>{formatted}</time> : null}
      {formatted && readingTime ? (
        <span aria-hidden="true" className="size-1 rounded-full bg-current opacity-60" />
      ) : null}
      {readingTime ? <span>{readingTime}</span> : null}
    </p>
  );
}
