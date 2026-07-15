"use client";

import { SelectableDataTable } from "@/components/portal/SelectableDataTable";

interface FlightSegment {
  airline: string;
  arriveTime?: string;
  dateLabel: string;
  departTime?: string;
  destination: string;
  duration?: string;
  flightNumber: string;
  id: string;
  origin: string;
  transit?: string;
}

interface FlightGroup {
  clientName: string;
  id: string;
  jobCode: string;
  name: string;
  route: string;
  segments: FlightSegment[];
}

export function TicketingFlightItinerary({ rows }: { rows?: FlightGroup[] }) {
  if (!rows) {
    return (
      <div className="rounded-2xl border border-brand-border bg-white px-6 py-12 text-center text-brand-muted text-sm">
        Loading flight itinerary…
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-brand-border border-dashed bg-white px-6 py-12 text-center text-brand-muted text-sm">
        No flight itinerary imported yet.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {rows.map((group) => (
        <section
          className="overflow-hidden rounded-xl border border-brand-border bg-brand-light/30"
          key={group.id}
        >
          <div className="flex flex-col gap-1 border-brand-border border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-citius-blue">{group.name}</h3>
              <p className="text-brand-muted text-xs">
                {group.jobCode} · {group.clientName}
              </p>
            </div>
            <p className="font-medium text-brand-dark text-sm">{group.route}</p>
          </div>
          <div className="p-3">
            <SelectableDataTable
              columns={[
                {
                  id: "date",
                  kind: "identity",
                  label: "Date",
                  render: (segment: FlightSegment) => segment.dateLabel,
                },
                {
                  id: "flight",
                  label: "Flight",
                  render: (segment: FlightSegment) => (
                    <>
                      <span className="font-medium">{segment.airline}</span>
                      <span className="ml-2 font-mono text-brand-muted text-xs">
                        {segment.flightNumber}
                      </span>
                    </>
                  ),
                },
                {
                  id: "depart",
                  label: "Depart",
                  render: (segment: FlightSegment) =>
                    `${segment.departTime || "—"} ${segment.origin}`,
                },
                {
                  id: "arrive",
                  label: "Arrive",
                  render: (segment: FlightSegment) =>
                    `${segment.arriveTime || "—"} ${segment.destination}`,
                },
                {
                  hideable: true,
                  id: "duration",
                  label: "Duration",
                  render: (segment: FlightSegment) => segment.duration || "—",
                },
                {
                  hideable: true,
                  id: "transit",
                  label: "Transit",
                  render: (segment: FlightSegment) => segment.transit || "—",
                },
              ]}
              compact
              empty="No flight segments in this group."
              mobileCardRender={undefined}
              onBulkDelete={undefined}
              rowLabel={undefined}
              rows={group.segments}
              rowTone={undefined}
            />
          </div>
        </section>
      ))}
    </div>
  );
}
