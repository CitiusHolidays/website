import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Coffee,
  FileText,
  Heart,
  Info,
  Mountain,
  Shield,
  Users,
} from "lucide-react";
import { m } from "motion/react";

export function RegistrationAndPolicySection({ policy }) {
  if (!policy) {
    return null;
  }
  return (
    <div className="mt-10 space-y-8 text-left md:mt-14">
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-6 md:p-8">
        <h4 className="mb-3 flex items-center gap-2 font-heading text-emerald-900 text-lg">
          <FileText className="size-5 text-emerald-700" />
          Registration
        </h4>
        {policy.bookingFormNote && (
          <p className="mb-4 text-brand-muted text-sm leading-relaxed">{policy.bookingFormNote}</p>
        )}
        {policy.registrationSteps?.length > 0 && (
          <ol className="list-inside list-decimal space-y-2 text-brand-dark/90 text-sm">
            {policy.registrationSteps.map((step) => (
              <li className="pl-1 leading-relaxed" key={step}>
                {step}
              </li>
            ))}
          </ol>
        )}
        {policy.fitnessCertificate && (
          <p className="mt-4 border-emerald-200/60 border-t pt-4 text-brand-muted text-sm leading-relaxed">
            <strong className="text-brand-dark">Fitness certificate:</strong>{" "}
            {policy.fitnessCertificate}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-6 md:p-8">
        <h4 className="mb-3 flex items-center gap-2 font-heading text-amber-900 text-lg">
          <AlertCircle className="size-5 text-amber-700" />
          Cancellation &amp; limitations
        </h4>
        {policy.cancellationDisclaimer?.length > 0 && (
          <ul className="mb-6 space-y-2 text-brand-muted text-sm">
            {policy.cancellationDisclaimer.map((line) => (
              <li className="flex gap-2 leading-relaxed" key={line}>
                <span className="shrink-0 text-amber-600">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        )}
        {policy.refundTiers?.length > 0 && (
          <div className="space-y-3">
            <p className="font-heading text-brand-dark text-xs uppercase tracking-wider">
              Refund policy
            </p>
            <ul className="space-y-3">
              {policy.refundTiers.map((tier) => (
                <li
                  className="rounded-xl border border-amber-200/80 bg-white/80 px-4 py-3 text-sm"
                  key={tier.window}
                >
                  <span className="font-semibold text-brand-dark">{tier.window}</span>
                  <span className="text-brand-muted">: {tier.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function PackageDetailsTab({ trail }) {
  return (
    <m.div
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
      exit={{ opacity: 0, y: -20 }}
      initial={{ opacity: 0, y: 20 }}
    >
      {/* Inclusions & Exclusions */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Inclusions */}
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-6">
          <h4 className="mb-5 flex items-center gap-2 font-heading text-emerald-800 text-lg">
            <CheckCircle className="size-5 text-emerald-600" />
            What&apos;s Included
          </h4>
          <ul className="space-y-3">
            {trail.details.inclusions.map((item) => (
              <li className="flex items-start gap-3 text-gray-700 text-sm" key={item}>
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-500" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Exclusions */}
        <div className="rounded-2xl border border-red-100 bg-red-50/50 p-6">
          <h4 className="mb-5 flex items-center gap-2 font-heading text-lg text-red-800">
            <AlertCircle className="size-5 text-red-600" />
            Not Included
          </h4>
          <ul className="space-y-3">
            {trail.details.exclusions.map((item) => (
              <li className="flex items-start gap-3 text-gray-700 text-sm" key={item}>
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-red-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Accommodation */}
      <div className="rounded-2xl border border-brand-light bg-brand-light/50 p-6">
        <h4 className="mb-5 flex items-center gap-2 font-heading text-citius-blue text-lg">
          <Mountain className="size-5 text-citius-orange" />
          Accommodation Details
        </h4>
        <div className="grid gap-4 sm:grid-cols-2">
          {trail.details.accommodation.map((item) => (
            <div
              className="rounded-xl border border-brand-light bg-white p-4 shadow-sm"
              key={item.type}
            >
              <p className="mb-1 font-bold text-[10px] text-citius-orange uppercase tracking-wider">
                {item.type}
              </p>
              <p className="text-brand-dark text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Transport Info (e.g. aerial packages) */}
      {trail.layoutVariant === "aerial" && trail.details.transport && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-6">
          <h4 className="mb-4 flex items-center gap-2 font-heading text-citius-blue text-lg">
            <Users className="size-5 text-citius-orange" />
            Transport Details
          </h4>
          <div className="space-y-2 text-brand-muted text-sm">
            <p>
              <strong className="text-brand-dark">Surface:</strong>{" "}
              {trail.details.transport.surface}
            </p>
            <p>
              <strong className="text-brand-dark">Flight:</strong> {trail.details.transport.flight}
            </p>
            <p>
              <strong className="text-brand-dark">Border:</strong> {trail.details.transport.border}
            </p>
          </div>
        </div>
      )}

      {/* Medical Info */}
      {trail.details.medical && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-6">
          <h4 className="mb-4 flex items-center gap-2 font-heading text-amber-800 text-lg">
            <Shield className="size-5 text-amber-600" />
            Medical Support
          </h4>
          <div className="space-y-2 text-brand-muted text-sm">
            <p>
              <strong className="text-brand-dark">Support:</strong> {trail.details.medical.support}
            </p>
            <p>
              <strong className="text-brand-dark">Checkup:</strong> {trail.details.medical.checkup}
            </p>
            <p>
              <strong className="text-brand-dark">Emergency:</strong>{" "}
              {trail.details.medical.emergency}
            </p>
          </div>
        </div>
      )}
    </m.div>
  );
}

export function InfoTab({ info, layoutVariant }) {
  const isAerialLayout = layoutVariant === "aerial";
  return (
    <m.div
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-8"
      exit={{ opacity: 0, scale: 0.98 }}
      initial={{ opacity: 0, scale: 1.02 }}
    >
      <div className="grid gap-6 md:gap-8 lg:grid-cols-2">
        {/* Eligibility */}
        <div className="space-y-6">
          <div>
            <h4 className="mb-4 flex items-center gap-2 font-heading text-citius-blue text-lg">
              <Heart className="size-5 text-citius-orange" />
              Eligibility & Health
            </h4>
            <ul className="space-y-2">
              {info.eligibility.map((item) => (
                <li
                  className="flex items-start gap-3 rounded-lg bg-brand-light/50 p-3 text-brand-muted text-sm"
                  key={item}
                >
                  <div className="mt-1.5 size-1.5 shrink-0 rounded-full bg-citius-orange" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {info.medicalRequirements && (
            <div>
              <h4 className="mb-4 flex items-center gap-2 font-heading text-citius-blue text-lg">
                <Shield className="size-5 text-citius-orange" />
                Medical Requirements
              </h4>
              <ul className="space-y-2">
                {info.medicalRequirements.map((item) => (
                  <li
                    className="flex items-start gap-3 rounded-lg bg-blue-50/50 p-3 text-brand-muted text-sm"
                    key={item}
                  >
                    <div className="mt-1.5 size-1.5 shrink-0 rounded-full bg-citius-blue" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* What to Pack & Other Info */}
        <div className="space-y-6">
          {info.whatToPack && (
            <div>
              <h4 className="mb-4 flex items-center gap-2 font-heading text-citius-blue text-lg">
                <FileText className="size-5 text-citius-orange" />
                What to Pack
              </h4>
              <ul className="space-y-2">
                {info.whatToPack.map((item) => (
                  <li
                    className="flex items-start gap-3 rounded-lg bg-orange-50/50 p-3 text-brand-muted text-sm"
                    key={item}
                  >
                    <div className="mt-1.5 size-1.5 shrink-0 rounded-full bg-citius-orange" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Best Time */}
          <div className="rounded-xl border border-citius-blue/10 bg-citius-blue/5 p-5">
            <h4 className="mb-2 flex items-center gap-2 font-heading text-base text-citius-blue">
              <Calendar className="size-4 text-citius-orange" />
              Best Time to Visit
            </h4>
            <p className="text-brand-muted text-sm">{info.bestTime}</p>
          </div>

          {/* Border Info (aerial / border-heavy trips) */}
          {isAerialLayout && info.borderInfo && (
            <div className="rounded-xl border border-citius-orange/10 bg-citius-orange/5 p-5">
              <h4 className="mb-2 flex items-center gap-2 font-heading text-base text-citius-orange">
                <Info className="size-4" />
                Border Information
              </h4>
              <p className="text-brand-muted text-sm">{info.borderInfo.title}</p>
              <p className="mt-1 text-brand-muted text-xs">{info.borderInfo.documents}</p>
            </div>
          )}

          {/* Meal Info */}
          {isAerialLayout && info.mealPlan && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-5">
              <h4 className="mb-2 flex items-center gap-2 font-heading text-base text-emerald-700">
                <Coffee className="size-4" />
                Meal Plan
              </h4>
              <p className="text-brand-muted text-sm">{info.mealPlan}</p>
            </div>
          )}
        </div>
      </div>

      {/* Safety Notes */}
      {info.safetyNotes && (
        <div className="rounded-2xl border border-red-100 bg-red-50/50 p-6">
          <h4 className="mb-4 flex items-center gap-2 font-heading text-lg text-red-800">
            <AlertCircle className="size-5 text-red-600" />
            Important Safety Notes
          </h4>
          <ul className="grid gap-2 sm:grid-cols-2">
            {info.safetyNotes.map((note) => (
              <li className="flex items-start gap-2 text-brand-muted text-sm" key={note}>
                <span className="mt-0.5 text-red-500">•</span>
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Visa & Connectivity */}
      {info.visa && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-brand-dark p-5 text-white">
            <p className="mb-2 text-citius-orange text-xs uppercase tracking-wider">
              Travel Documents
            </p>
            <p className="text-sm text-white/80">{info.visa.title}</p>
          </div>
          <div className="rounded-xl border border-brand-light bg-white p-5">
            <p className="mb-2 text-[10px] text-brand-muted uppercase tracking-wider">
              Digital Connection
            </p>
            <p className="text-brand-dark text-sm">{info.visa.connectivity}</p>
          </div>
        </div>
      )}
    </m.div>
  );
}

export function DeparturesBlock({ departures }) {
  if (!departures?.batches?.length) {
    return null;
  }
  return (
    <div className="mt-8 rounded-2xl border border-citius-blue/15 bg-citius-blue/5 p-6 md:p-8">
      <h4 className="mb-4 flex items-center gap-2 font-heading text-citius-blue text-lg">
        <Calendar className="size-5 text-citius-orange" />
        Departure dates
      </h4>
      <div className="space-y-6">
        {departures.batches.map((batch) => (
          <div key={batch.name}>
            <p className="font-semibold text-brand-dark text-sm">{batch.name}</p>
            <ul className="mt-2 space-y-2">
              {batch.dates.map((d) => (
                <li className="flex items-start gap-2 text-brand-muted text-sm" key={d}>
                  <span className="shrink-0 text-citius-orange">•</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
