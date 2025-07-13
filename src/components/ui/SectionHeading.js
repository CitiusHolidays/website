import { cn } from "../../utils/cn";

export default function SectionHeading({ title, subtitle, className }) {
  return (
    <div className={cn("mb-12 text-center", className)}>
      <h2 className="text-4xl font-bold text-citius-blue">{title}</h2>
      {subtitle && (
        <p className="mx-auto mt-2 max-w-2xl text-lg text-brand-muted">
          {subtitle}
        </p>
      )}
    </div>
  );
}
