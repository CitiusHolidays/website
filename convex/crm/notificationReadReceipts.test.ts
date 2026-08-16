import { describe, expect, test } from "bun:test";
import type { RuntimeObject, RuntimeValue } from "../lib/runtimeValues";
import {
  listNotifications,
  markNotificationRead,
  notificationSummary,
  removeNotification,
} from "./activity";

function makeCtx() {
  const tables = {
    notificationReads: [],
    notificationReadTargetCounts: [],
    notifications: [
      {
        _id: "notification_1",
        body: "Please review",
        createdAt: 100,
        recipientRole: "Sales",
        title: "Sales action",
      },
    ],
    notificationTargetCounts: [],
    notificationUnreadProjectionReadiness: [],
    staffUsers: [
      {
        _id: "staff_a",
        active: true,
        authUserId: "auth_a",
        email: "a@example.com",
        name: "Sales A",
        roles: ["Sales"],
      },
      {
        _id: "staff_b",
        active: true,
        authUserId: "auth_b",
        email: "b@example.com",
        name: "Sales B",
        roles: ["Sales"],
      },
      {
        _id: "staff_admin",
        active: true,
        authUserId: "auth_admin",
        email: "admin@example.com",
        name: "Admin",
        roles: ["Admin"],
      },
    ],
  } satisfies Record<string, any[]>;
  let subject = "auth_a";
  const find = (id: string) =>
    Object.values(tables)
      .flat()
      .find((row) => row._id === id) ?? null;
  const query = (table: string) => {
    let rows = [...(tables[table] ?? [])];
    const builder: any = {
      collect: async () => rows,
      order: (direction: "asc" | "desc") => {
        rows.sort((left, right) =>
          direction === "desc" ? right.createdAt - left.createdAt : left.createdAt - right.createdAt
        );
        return builder;
      },
      take: async (limit: number) => rows.slice(0, limit),
      unique: async () => rows[0] ?? null,
      withIndex: (_name: string, callback: (q: any) => RuntimeValue) => {
        const filters: [string, unknown][] = [];
        const q = {
          eq(field: string, value: RuntimeValue) {
            filters.push([field, value]);
            return q;
          },
        };
        callback(q);
        rows = rows.filter((row) => filters.every(([field, value]) => row[field] === value));
        return builder;
      },
    };
    return builder;
  };

  return {
    ctx: {
      auth: {
        getUserIdentity: () => {
          const staff = tables.staffUsers.find((row) => row.authUserId === subject);
          return { email: staff.email, name: staff.name, subject };
        },
      },
      db: {
        delete: (_table: string, ...args: string[]) => {
          const id = args.at(-1);
          for (const [table, rows] of Object.entries(tables)) {
            tables[table] = rows.filter((row) => row._id !== id);
          }
        },
        get: (_table: string, id: string) => find(id),
        insert: (table: string, value: RuntimeObject) => {
          tables[table] ??= [];
          const id = `${table}_${tables[table].length + 1}`;
          tables[table].push({ _id: id, ...value });
          return id;
        },
        normalizeId: (_table: string, id: string) => id,
        patch: (...args: [string, RuntimeObject] | [string, string, RuntimeObject]) => {
          const id = args.length === 2 ? args[0] : args[1];
          // SAFETY: This test controls the asserted value at the framework boundary below.
          const value = args.at(-1) as RuntimeObject;
          for (const [table, rows] of Object.entries(tables)) {
            const index = rows.findIndex((row) => row._id === id);
            if (index >= 0) {
              tables[table][index] = { ...rows[index], ...value };
              return;
            }
          }
        },
        query,
      },
    },
    setSubject: (next: string) => {
      subject = next;
    },
    tables,
  };
}

describe("per-staff notification read receipts", () => {
  test("one Sales user's click does not clear a role notification for another", async () => {
    const { ctx, setSubject } = makeCtx();

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await (markNotificationRead as any)._handler(ctx, { notificationId: "notification_1" });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    expect(await (notificationSummary as any)._handler(ctx, {})).toEqual({
      coverage: "partial",
      unreadCount: 0,
    });

    setSubject("auth_b");
    // SAFETY: This test controls the asserted value at the framework boundary below.
    expect(await (notificationSummary as any)._handler(ctx, {})).toEqual({
      coverage: "partial",
      unreadCount: 1,
    });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    expect((await (listNotifications as any)._handler(ctx, { limit: 20 }))[0].readAt).toBeNull();
  });

  test("only Activity administrators can globally delete a shared notification", async () => {
    const { ctx, setSubject, tables } = makeCtx();

    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      (removeNotification as any)._handler(ctx, { notificationId: "notification_1" })
    ).rejects.toThrow();
    expect(tables.notifications).toHaveLength(1);

    setSubject("auth_admin");
    // SAFETY: This test controls the asserted value at the framework boundary below.
    await (removeNotification as any)._handler(ctx, { notificationId: "notification_1" });
    expect(tables.notifications).toHaveLength(0);
  });
});
