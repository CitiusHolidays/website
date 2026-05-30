"use client";

export default function LevelBadge({ level, score, size = "md" }) {
  const sizeClasses = size === "lg" ? "px-5 py-3 text-base" : "px-3 py-1.5 text-xs";

  return (
    <div
      className={`inline-flex flex-col items-start rounded-full border border-citius-blue/20 bg-white/80 backdrop-blur-sm ${sizeClasses}`}
    >
      <span className="font-heading uppercase tracking-[0.15em] text-citius-orange text-[10px]">
        {score} pts
      </span>
      <span className="font-heading text-citius-blue font-medium leading-tight">
        {level?.title ?? "Seeker"}
      </span>
    </div>
  );
}
