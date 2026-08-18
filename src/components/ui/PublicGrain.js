import { cn } from "@/lib/utils";

/** Static texture shared by public media compositions. It never moves with transformed media. */
export default function PublicGrain({ className }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "public-grain pointer-events-none absolute inset-0 bg-[url('/noise.svg')] mix-blend-overlay",
        className
      )}
    />
  );
}
