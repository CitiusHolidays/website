import {
  INBOUND_BRIEF_CONTACT_WINDOWS,
  INBOUND_BRIEF_DATE_FLEXIBILITY,
  INBOUND_BRIEF_SERVICE_TYPES,
  inboundBriefContactWindowLabel,
  inboundBriefDateFlexibilityLabel,
  inboundBriefServiceLabel,
} from "@/lib/contact/inboundIntentContract";

const EMPTY_BRIEF = {
  contactWindow: "",
  dateFlexibility: "",
  destination: "",
  paxCount: "",
  serviceType: "",
  travelStartDate: "",
};

export function createEmptyEnquiryBrief(values = {}) {
  return { ...EMPTY_BRIEF, ...values };
}

function fieldError(errors, name) {
  const message = errors?.[name];
  return message ? <span className="mt-1 block text-red-700 text-xs">{message}</span> : null;
}

export default function EnquiryBriefFields({
  brief,
  compact = false,
  errors,
  idPrefix,
  onChange,
  sourceLabel,
}) {
  const inputClass = compact
    ? "mt-1 min-h-10 w-full rounded-lg border border-brand-border bg-white px-3 text-base sm:text-sm"
    : "mt-1 min-h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 text-gray-800 focus:border-orange-500 focus:outline-none";
  const labelClass = compact ? "text-brand-dark text-xs" : "text-gray-700 text-sm";
  const describedBy = (name) => (errors?.[name] ? `${idPrefix}-${name}-error` : undefined);
  const renderError = (name) => {
    const error = fieldError(errors, name);
    return error ? <span id={`${idPrefix}-${name}-error`}>{error}</span> : null;
  };

  return (
    <fieldset
      className={
        compact
          ? "rounded-xl border border-brand-border bg-slate-50/70 p-3"
          : "rounded-xl border border-orange-200 bg-orange-50/50 p-4"
      }
    >
      <legend
        className={
          compact
            ? "px-1 font-semibold text-brand-dark text-sm"
            : "px-1 font-semibold text-blue-900"
        }
      >
        Review your optional enquiry brief
      </legend>
      {sourceLabel ? (
        <p className="mt-1 text-gray-700 text-sm">
          Started from: <span className="font-medium">{sourceLabel}</span>
        </p>
      ) : null}
      <p className={compact ? "mt-1 text-brand-muted text-xs" : "mt-1 text-gray-600 text-sm"}>
        Every field below is optional and editable. Citius receives it only when you submit.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className={labelClass} htmlFor={`${idPrefix}-serviceType`}>
          Enquiry type
          <select
            aria-describedby={describedBy("serviceType")}
            aria-invalid={errors?.serviceType ? "true" : "false"}
            className={inputClass}
            id={`${idPrefix}-serviceType`}
            name="serviceType"
            onChange={onChange}
            value={brief.serviceType}
          >
            <option value="">Not selected</option>
            {INBOUND_BRIEF_SERVICE_TYPES.map((value) => (
              <option key={value} value={value}>
                {inboundBriefServiceLabel(value)}
              </option>
            ))}
          </select>
          {renderError("serviceType")}
        </label>

        <label className={labelClass} htmlFor={`${idPrefix}-destination`}>
          Destination or programme
          <input
            aria-describedby={describedBy("destination")}
            aria-invalid={errors?.destination ? "true" : "false"}
            autoComplete="off"
            className={inputClass}
            id={`${idPrefix}-destination`}
            maxLength={240}
            name="destination"
            onChange={onChange}
            value={brief.destination}
          />
          {renderError("destination")}
        </label>

        <label className={labelClass} htmlFor={`${idPrefix}-travelStartDate`}>
          Preferred travel date
          <input
            aria-describedby={describedBy("travelStartDate")}
            aria-invalid={errors?.travelStartDate ? "true" : "false"}
            className={inputClass}
            id={`${idPrefix}-travelStartDate`}
            name="travelStartDate"
            onChange={onChange}
            type="date"
            value={brief.travelStartDate}
          />
          {renderError("travelStartDate")}
        </label>

        <label className={labelClass} htmlFor={`${idPrefix}-dateFlexibility`}>
          Date flexibility
          <select
            aria-describedby={describedBy("dateFlexibility")}
            aria-invalid={errors?.dateFlexibility ? "true" : "false"}
            className={inputClass}
            id={`${idPrefix}-dateFlexibility`}
            name="dateFlexibility"
            onChange={onChange}
            value={brief.dateFlexibility}
          >
            <option value="">Not selected</option>
            {INBOUND_BRIEF_DATE_FLEXIBILITY.map((value) => (
              <option key={value} value={value}>
                {inboundBriefDateFlexibilityLabel(value)}
              </option>
            ))}
          </select>
          {renderError("dateFlexibility")}
        </label>

        <label className={labelClass} htmlFor={`${idPrefix}-paxCount`}>
          Approximate group size
          <input
            aria-describedby={describedBy("paxCount")}
            aria-invalid={errors?.paxCount ? "true" : "false"}
            className={inputClass}
            id={`${idPrefix}-paxCount`}
            max={1000}
            min={1}
            name="paxCount"
            onChange={onChange}
            type="number"
            value={brief.paxCount}
          />
          {renderError("paxCount")}
        </label>

        <label className={labelClass} htmlFor={`${idPrefix}-contactWindow`}>
          Best contact window
          <select
            aria-describedby={describedBy("contactWindow")}
            aria-invalid={errors?.contactWindow ? "true" : "false"}
            className={inputClass}
            id={`${idPrefix}-contactWindow`}
            name="contactWindow"
            onChange={onChange}
            value={brief.contactWindow}
          >
            <option value="">Not selected</option>
            {INBOUND_BRIEF_CONTACT_WINDOWS.map((value) => (
              <option key={value} value={value}>
                {inboundBriefContactWindowLabel(value)}
              </option>
            ))}
          </select>
          {renderError("contactWindow")}
        </label>
      </div>
    </fieldset>
  );
}
