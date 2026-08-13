import { describe, expect, test } from "bun:test";
import { METRIC_VERSION } from "./metricAggregates";
import { dashboard } from "./ticketing";
import { collectTicketingDashboardRows } from "./ticketingDashboardReads";

const REFERENCE_NOW = Date.parse("2026-08-07T12:00:00.000Z");

function queryBuilder(rows: any[], counters: Record<string, number>, table: string) {
  let current = [...rows];
  const builder: any = {
    collect: async () => {
      throw new Error(`Unbounded collect is forbidden for ${table}`);
    },
    order: (direction: "asc" | "desc") => {
      current.sort((left, right) =>
        direction === "desc"
          ? Number(right.createdAt ?? right._creationTime ?? 0) -
            Number(left.createdAt ?? left._creationTime ?? 0)
          : Number(left.createdAt ?? left._creationTime ?? 0) -
            Number(right.createdAt ?? right._creationTime ?? 0)
      );
      return builder;
    },
    take: async (limit: number) => {
      counters[`${table}.take`] = (counters[`${table}.take`] ?? 0) + 1;
      return current.slice(0, limit);
    },
    unique: async () => current[0] ?? null,
    withIndex: (_name: string, configure: (q: any) => unknown) => {
      const predicates: Array<(row: any) => boolean> = [];
      const q: any = {
        eq(field: string, value: unknown) {
          predicates.push((row) => row[field] === value);
          return q;
        },
        gte(field: string, value: number | string) {
          predicates.push((row) => row[field] >= value);
          return q;
        },
        lte(field: string, value: number | string) {
          predicates.push((row) => row[field] <= value);
          return q;
        },
      };
      configure(q);
      current = current.filter((row) => predicates.every((predicate) => predicate(row)));
      return builder;
    },
  };
  return builder;
}

describe("ticketing dashboard read model", () => {
  test("bounds Ticket and PNR source reads without pagination or lifetime collection", async () => {
    const rowsByTable = {
      pnrs: Array.from({ length: 150 }, (_, index) => ({
        createdAt: REFERENCE_NOW - index,
        id: `pnr-${index}`,
      })),
      tickets: Array.from({ length: 2001 }, (_, index) => ({
        createdAt: REFERENCE_NOW - index,
        id: `ticket-${index}`,
      })),
    };
    const counters: Record<string, number> = {};
    const ctx = {
      db: {
        query: (table: keyof typeof rowsByTable) =>
          queryBuilder(rowsByTable[table], counters, table),
      },
    };

    const result = await collectTicketingDashboardRows(ctx as never, {
      sinceMs: REFERENCE_NOW - 10_000,
      untilMs: REFERENCE_NOW,
    });

    expect(result.tickets).toHaveLength(120);
    expect(result.pnrs).toHaveLength(120);
    expect(result.truncated).toBe(true);
    expect(counters).toEqual({ "pnrs.take": 1, "tickets.take": 1 });
  });

  test("uses exact scoped aggregates, deduplicates Job Card visibility, and returns the same preview", async () => {
    const tables: Record<string, any[]> = {
      crmMetricBuckets: [
        {
          _id: "bucket_all",
          periodKey: "2026-08",
          periodType: "month",
          scope: "all",
          updatedAt: REFERENCE_NOW,
          values: {
            "pnrs.count": 41,
            "pnrs.issuedSeats": 88,
            "pnrs.totalSeats": 100,
            "tickets.attention": 3,
            "tickets.issued": 99,
            "tickets.pending": 7,
            "tickets.status.Cancelled": 2,
            "tickets.status.Refunded": 1,
            "tickets.type.FIT Ticket": 60,
            "tickets.type.Group Ticket": 40,
          },
        },
        {
          _id: "bucket_owner",
          periodKey: "2026-08",
          periodType: "month",
          scope: "ticketing:staff_ticketing",
          updatedAt: REFERENCE_NOW,
          values: {
            "pnrs.count": 1,
            "pnrs.issuedSeats": 1,
            "pnrs.totalSeats": 2,
            "tickets.issued": 1,
            "tickets.pending": 1,
            "tickets.type.FIT Ticket": 1,
            "tickets.type.Group Ticket": 1,
          },
        },
      ],
      crmMetricPublications: [
        {
          _id: "publication",
          generation: 1,
          key: "global",
          metricVersion: METRIC_VERSION,
          publishedAt: REFERENCE_NOW,
        },
      ],
      jobCards: [
        {
          _id: "job_visible",
          clientName: "Visible Client",
          jobCode: "JC-0001-TK",
          ticketingOwnerId: "staff_ticketing",
        },
        {
          _id: "job_hidden",
          clientName: "Hidden Client",
          jobCode: "JC-0002-XX",
          ticketingOwnerId: "staff_other",
        },
      ],
      pnrs: [
        {
          _id: "pnr_visible",
          createdAt: REFERENCE_NOW - 3000,
          issuedSeats: 1,
          jobCardId: "job_visible",
          pnrCode: "VISIBLE",
          totalSeats: 2,
          updatedAt: REFERENCE_NOW,
        },
      ],
      staffUsers: [
        {
          _id: "staff_admin",
          active: true,
          authUserId: "auth_admin",
          email: "admin@example.com",
          name: "Admin",
          roles: ["Admin"],
        },
        {
          _id: "staff_ticketing",
          active: true,
          authUserId: "auth_ticketing",
          email: "ticketing@example.com",
          name: "Ticketing",
          roles: ["Ticketing"],
        },
      ],
      tickets: [
        {
          _id: "ticket_visible_issued",
          createdAt: REFERENCE_NOW - 1000,
          jobCardId: "job_visible",
          paymentType: "Company Paid",
          pnrId: "pnr_visible",
          ticketStatus: "Issued",
          ticketType: "FIT Ticket",
          updatedAt: REFERENCE_NOW,
        },
        {
          _id: "ticket_visible_pending",
          createdAt: REFERENCE_NOW - 2000,
          jobCardId: "job_visible",
          paymentType: "Company Paid",
          ticketStatus: "Pending Issue",
          ticketType: "Group Ticket",
          updatedAt: REFERENCE_NOW,
        },
        {
          _id: "ticket_hidden",
          createdAt: REFERENCE_NOW - 2500,
          jobCardId: "job_hidden",
          paymentType: "Company Paid",
          ticketStatus: "Issued",
          ticketType: "FIT Ticket",
          updatedAt: REFERENCE_NOW,
        },
      ],
    };
    const counters: Record<string, number> = {};
    let subject = "auth_admin";
    const find = (id: string) =>
      Object.values(tables)
        .flat()
        .find((row) => row._id === id) ?? null;
    const ctx = {
      auth: {
        getUserIdentity: async () => {
          const staff = tables.staffUsers.find((row) => row.authUserId === subject);
          return { email: staff.email, name: staff.name, subject };
        },
      },
      db: {
        get: async (_table: string, id: string) => {
          counters[`get:${id}`] = (counters[`get:${id}`] ?? 0) + 1;
          return find(id);
        },
        query: (table: string) => queryBuilder(tables[table] ?? [], counters, table),
      },
    };

    const adminResult = await (dashboard as any)._handler(ctx, { referenceNow: REFERENCE_NOW });
    expect(adminResult.aggregateCoverage).toMatchObject({ complete: true, scope: "all" });
    expect(adminResult.issued).toBe(99);
    expect(adminResult.totalSeats).toBe(100);
    expect(adminResult.preview.map((row: any) => row.id)).toEqual([
      "ticket_visible_issued",
      "ticket_visible_pending",
      "ticket_hidden",
    ]);
    expect(counters["get:job_visible"]).toBe(1);
    expect(counters["get:job_hidden"]).toBe(1);

    subject = "auth_ticketing";
    const ownerResult = await (dashboard as any)._handler(ctx, { referenceNow: REFERENCE_NOW });
    expect(ownerResult.aggregateCoverage).toMatchObject({
      complete: true,
      scope: "ticketing:staff_ticketing",
    });
    expect(ownerResult.issued).toBe(1);
    expect(ownerResult.pending).toBe(1);
    expect(ownerResult.preview.map((row: any) => row.id)).toEqual([
      "ticket_visible_issued",
      "ticket_visible_pending",
    ]);
    expect(ownerResult.workCoverage).toMatchObject({
      distinctJobCount: 2,
      pnrRowsRead: 1,
      ticketRowsRead: 3,
      truncated: false,
    });
  });
});
