type ArrivalPackStatus = "confirmed" | "unknown";

export interface ArrivalPackPacket {
  confirmation: { at: number | null; status: ArrivalPackStatus };
  confirmedOfferId: string;
  entitlement: {
    role: "organizer" | "traveller";
    source: "crm_operator_grant" | "identity_migration";
  };
  nextAction: {
    kind: "download_arrival_pack";
    label: "Download offline Arrival Pack";
  };
  readOnly: true;
  staySummary: {
    asOf: null;
    source: "unknown";
    status: "unknown";
    summary: null;
  };
  travel: {
    asOf: number | null;
    destination: string | null;
    endDate: string | null;
    source: "confirmed_offer";
    startDate: string | null;
  };
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDateOnly(value: string | null) {
  const match = value ? DATE_ONLY.exec(value) : null;
  if (!match) {
    return "Unknown";
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

function formatTimestamp(value: number) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "short",
    timeZone: "UTC",
    timeZoneName: "short",
    year: "numeric",
  }).format(new Date(value));
}

function timestampMarkup(value: number | null) {
  if (value === null) {
    return '<span class="unknown">Freshness: Unknown</span>';
  }
  const iso = new Date(value).toISOString();
  return `<span>As of <time datetime="${iso}">${escapeHtml(formatTimestamp(value))}</time></span>`;
}

function statusMarkup(ready: boolean) {
  return ready
    ? '<strong class="status status-ready">Ready</strong>'
    : '<strong class="status status-pending">Pending — Unknown</strong>';
}

function accessLabel(packet: ArrivalPackPacket) {
  return packet.entitlement.role === "organizer" ? "Organizer access" : "Traveller access";
}

export function renderArrivalPackDocument(packet: ArrivalPackPacket, generatedAt: number) {
  const destination = packet.travel.destination || "Unknown";
  const travelReady = Boolean(
    packet.travel.asOf !== null &&
      packet.travel.destination &&
      packet.travel.startDate &&
      packet.travel.endDate
  );
  const stayReady = false;
  const staySummary =
    '<span class="unknown">Unknown — no approved confirmed stay summary is available.</span>';
  const generatedIso = new Date(generatedAt).toISOString();

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta content="width=device-width, initial-scale=1" name="viewport">
  <meta content="light" name="color-scheme">
  <title>Citius Arrival Pack — ${escapeHtml(destination)}</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: #17223b; background: #f5f1e8; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #f5f1e8; color: #17223b; font-size: 1rem; line-height: 1.6; overflow-wrap: anywhere; }
    main { width: min(100% - 2rem, 48rem); margin: 0 auto; padding: 2rem 0 3rem; }
    header, section, aside { border: 1px solid #d8cfbf; background: #fffdf8; padding: clamp(1rem, 4vw, 2rem); }
    header { border-top: 0.35rem solid #d66b32; }
    section, aside { margin-top: 1rem; }
    h1, h2 { line-height: 1.2; margin: 0; }
    h1 { font-size: clamp(2rem, 8vw, 3.25rem); }
    h2 { font-size: clamp(1.25rem, 5vw, 1.6rem); }
    p { margin: 0.65rem 0 0; }
    dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr)); gap: 1rem; margin: 1.25rem 0 0; }
    dt { color: #5f6572; font-size: 0.82rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
    dd { margin: 0.2rem 0 0; }
    ol { display: grid; gap: 1rem; margin: 1.25rem 0 0; padding-left: 1.4rem; }
    li { padding-left: 0.4rem; }
    .eyebrow { color: #9a4a25; font-size: 0.78rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
    .lede { color: #5f6572; max-width: 42rem; }
    .meta { color: #5f6572; font-size: 0.88rem; }
    .status { display: inline-block; margin-right: 0.5rem; }
    .status-ready { color: #245c47; }
    .status-pending, .unknown { color: #704b13; }
    .summary { white-space: normal; }
    .offline-warning { border-left: 0.35rem solid #d66b32; }
    @media (max-width: 24rem) {
      main { width: min(100% - 1rem, 48rem); padding-top: 0.5rem; }
      header, section, aside { padding: 1rem; }
    }
    @media print {
      @page { size: A4; margin: 14mm; }
      body { background: #fff; color: #000; font-size: 11pt; }
      main { width: 100%; margin: 0; padding: 0; }
      header, section, aside { border-color: #777; break-inside: avoid; box-shadow: none; }
      .print-guidance { display: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { scroll-behavior: auto !important; }
    }
  </style>
</head>
<body>
  <main id="arrival-pack">
    <header aria-labelledby="arrival-pack-title">
      <p class="eyebrow">Read-only confirmed journey record</p>
      <h1 id="arrival-pack-title">Arrival Pack</h1>
      <p class="lede">${escapeHtml(destination)} · ${escapeHtml(accessLabel(packet))}</p>
      <p class="meta">Generated <time datetime="${generatedIso}">${escapeHtml(formatTimestamp(generatedAt))}</time></p>
    </header>

    <section aria-labelledby="readiness-heading">
      <h2 id="readiness-heading">Journey readiness</h2>
      <ol>
        <li>
          ${statusMarkup(packet.confirmation.status === "confirmed")}
          Journey confirmation
          <p class="meta">${timestampMarkup(packet.confirmation.at)}</p>
        </li>
        <li>
          ${statusMarkup(travelReady)}
          Confirmed travel summary
          <p class="meta">${timestampMarkup(packet.travel.asOf)}</p>
        </li>
        <li>
          ${statusMarkup(stayReady)}
          Confirmed stay summary
          <p class="meta">${timestampMarkup(packet.staySummary.asOf)}</p>
        </li>
      </ol>
    </section>

    <section aria-labelledby="travel-heading">
      <h2 id="travel-heading">Confirmed travel</h2>
      <dl>
        <div><dt>Destination</dt><dd>${escapeHtml(destination)}</dd></div>
        <div><dt>Starts</dt><dd>${escapeHtml(formatDateOnly(packet.travel.startDate))}</dd></div>
        <div><dt>Ends</dt><dd>${escapeHtml(formatDateOnly(packet.travel.endDate))}</dd></div>
      </dl>
      <p class="meta">Source: immutable Confirmed Offer. ${timestampMarkup(packet.travel.asOf)}</p>
    </section>

    <section aria-labelledby="stay-heading">
      <h2 id="stay-heading">Confirmed stay summary</h2>
      <p class="summary">${staySummary}</p>
      <p class="meta">Source: Unknown. ${timestampMarkup(packet.staySummary.asOf)}</p>
    </section>

    <aside aria-labelledby="offline-heading" class="offline-warning">
      <h2 id="offline-heading">Offline copy</h2>
      <p>This file is self-contained and can be opened without a network connection. It will not update after download. Return to your Citius Account before travel to confirm you still have access and view the latest authorized record.</p>
      <p class="print-guidance">Use your browser’s Print command to print this pack or save a PDF copy.</p>
    </aside>
  </main>
</body>
</html>`;
}
