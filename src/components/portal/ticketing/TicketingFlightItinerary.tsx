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

function renderFlightSegment(segment: FlightSegment, visibleColumnIds: ReadonlySet<string>) {
  return (
    <div className="space-y-2 text-sm">
      <p className="font-semibold text-brand-dark">{segment.dateLabel}</p>
      <p className="font-medium text-brand-dark">
        {segment.origin} → {segment.destination}
      </p>
      <p className="text-brand-muted">
        {segment.departTime || "Departure time pending"} →{" "}
        {segment.arriveTime || "Arrival time pending"}
      </p>
      <p className="text-brand-muted">
        {segment.airline} <span className="font-mono">{segment.flightNumber}</span>
      </p>
      {visibleColumnIds.has("duration") && segment.duration ? (
        <p className="text-brand-muted">Duration: {segment.duration}</p>
      ) : null}
      {visibleColumnIds.has("transit") && segment.transit ? (
        <p className="text-brand-muted">Transit: {segment.transit}</p>
      ) : null}
    </div>
  );
}

export function TicketingFlightItinerary({ rows }: { rows?: FlightGroup[] }) {
  if (!rows) {
    return (
      <p className="py-4 text-brand-muted text-sm" role="status">
        Loading flight itinerary…
      </p>
    );
  }
  if (rows.length === 0) {
    return <p className="py-4 text-brand-muted text-sm">No flight itinerary imported yet.</p>;
  }
  return (
    <div className="space-y-4">
      {rows.map((group, groupIndex) => (
        <section className="space-y-3" key={group.id}>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="font-semibold text-citius-blue">{group.name}</h3>
              <p className="text-brand-muted text-xs">
                {group.jobCode} · {group.clientName}
              </p>
            </div>
            <p className="font-medium text-brand-dark text-sm">{group.route}</p>
          </div>
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
            layoutKey={`ticketing:flight-itinerary:${group.id}`}
            layoutLabel={`Flight itinerary table ${groupIndex + 1} for ${group.name}, ${group.jobCode}`}
            mobileCardRender={renderFlightSegment}
            rows={group.segments}
          />
        </section>
      ))}
    </div>
  );
}
