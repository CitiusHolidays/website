import {
  LOCATION_HELP,
  type LocationHelpPlatform,
  locationHelpOrder,
} from "@/lib/officeCheckIn/presentation";

const HEADING_ID = "office-check-in-location-help";

function HelpSteps({ platform }: { platform: LocationHelpPlatform }) {
  const help = LOCATION_HELP[platform];
  return (
    <div className="grid gap-1">
      <p className="font-medium text-brand-dark text-sm">{help.label}</p>
      <ol className="ms-5 grid list-decimal gap-1 text-brand-dark text-sm">
        {help.steps.map((step) => (
          <li className="text-pretty" key={step}>
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * How to turn location on, shown after a press where the browser didn't share it. The person's
 * own device comes first; the rest are folded away. Without a known device, all are shown.
 */
export function LocationHelp({ platform }: { platform: LocationHelpPlatform | null }) {
  const [first, ...others] = locationHelpOrder(platform);
  return (
    <section
      aria-labelledby={HEADING_ID}
      className="grid gap-3 rounded-lg border border-brand-border bg-white px-3 py-3"
    >
      <h3 className="font-medium text-brand-dark text-sm" id={HEADING_ID}>
        How to turn location on
      </h3>
      {platform ? (
        <>
          <HelpSteps platform={first} />
          <details className="group">
            <summary className="inline-flex min-h-10 cursor-pointer items-center text-citius-blue text-sm">
              Other devices
            </summary>
            <div className="mt-2 grid gap-3">
              {others.map((entry) => (
                <HelpSteps key={entry} platform={entry} />
              ))}
            </div>
          </details>
        </>
      ) : (
        [first, ...others].map((entry) => <HelpSteps key={entry} platform={entry} />)
      )}
    </section>
  );
}
