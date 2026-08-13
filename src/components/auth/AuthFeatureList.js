export function AuthFeatureList({ items, className = "" }) {
  return (
    <div className={`divide-y divide-white/10 border-white/10 border-y ${className}`}>
      {items.map(({ description, icon: Icon, title }) => (
        <div className="flex items-start gap-4 py-4" key={title}>
          <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-auth-accent-on-dark" />
          <div>
            <h3 className="font-heading font-medium text-lg text-white">{title}</h3>
            <p className="mt-1 font-normal text-brand-muted-on-dark text-sm leading-relaxed">
              {description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
