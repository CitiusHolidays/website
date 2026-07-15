import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { getNotificationHref } from "@/lib/portal/notificationTargets";

const root = process.cwd();
const portalRoot = join(root, "src/app/portal");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const PORTAL_LAYOUT = "src/app/portal/layout.js";
const PORTAL_OPT_OUT_PATTERN = /export const instant = false/;
const PORTAL_CACHE_TODO_PATTERN = /TODO: Cache Components adoption/;

function listPortalPageFiles() {
  const pages: string[] = [];

  function walk(relativeDir: string) {
    for (const entry of readdirSync(join(root, relativeDir))) {
      const relativePath = join(relativeDir, entry);
      const absolutePath = join(root, relativePath);
      const stats = statSync(absolutePath);
      if (stats.isDirectory()) {
        walk(relativePath);
        continue;
      }
      if (entry === "page.js") {
        pages.push(relativePath);
      }
    }
  }

  walk("src/app/portal");
  return pages.sort();
}

const deepLinkRoutes = [
  {
    href: getNotificationHref({
      entityId: "query_1",
      entityType: "query",
      title: "Proposal ready for review",
    }),
    page: "src/app/portal/queries/page.js",
    view: "queries",
  },
  {
    href: getNotificationHref({
      entityId: "query_1",
      entityType: "query",
      title: "Order confirmed",
    }),
    page: "src/app/portal/accounts/job-cards/page.js",
    view: "accounts-job-cards",
  },
  {
    href: getNotificationHref({
      entityId: "job_1",
      entityType: "jobCard",
      title: "Assign operations owner",
    }),
    page: "src/app/portal/job-cards/page.js",
    view: "job-cards",
  },
  {
    href: getNotificationHref({
      entityId: "ticket_1",
      entityType: "ticket",
      title: "Ticket update",
    }),
    page: "src/app/portal/tickets/page.js",
    view: "tickets",
  },
  {
    href: getNotificationHref({
      entityId: "approval_1",
      entityType: "approval",
      title: "Expense approval",
    }),
    page: "src/app/portal/approvals/page.js",
    view: "approvals",
  },
] as const;

describe("portal Cache Components policy", () => {
  test("layout keeps one request-sensitive instant boundary without obsolete noStore", () => {
    const source = read(PORTAL_LAYOUT);

    expect(source).toContain("export const instant = false");
    expect(source).toContain('requireAuth("/portal")');
    expect(source).toContain("getMyPortalAccess");
    expect(source).toContain("portal=unauthorized");
    expect(source).not.toContain("unstable_noStore");
    expect(source).not.toContain('"use cache"');
    expect(source).not.toContain("cachedSanityFetch");
    expect(source).not.toMatch(PORTAL_CACHE_TODO_PATTERN);
    expect(source).toMatch(/must stay outside use cache/);
  });

  test("portal leaves inherit the layout boundary and do not export redundant opt-outs", () => {
    const pages = listPortalPageFiles();

    expect(pages.length).toBeGreaterThanOrEqual(20);

    for (const page of pages) {
      const source = read(page);
      expect(source).not.toMatch(PORTAL_OPT_OUT_PATTERN);
      expect(source).not.toMatch(PORTAL_CACHE_TODO_PATTERN);
      expect(source).not.toContain('"use cache"');
      expect(source).not.toContain("cachedSanityFetch");
    }
  });

  test("notification deep links resolve to existing portal route files", () => {
    for (const route of deepLinkRoutes) {
      const pathname = route.href.split("?")[0];
      const relativePage = pathname.replace(/^\/portal\/?/, "");
      const pagePath = join(portalRoot, relativePage, "page.js");

      expect(existsSync(pagePath)).toBe(true);
      expect(read(route.page)).toContain(`view="${route.view}"`);
      expect(route.href.startsWith("/portal/")).toBe(true);
    }
  });

  test("dynamic job card command center route keeps param-driven rendering", () => {
    const source = read("src/app/portal/job-cards/[jobCardId]/page.js");

    expect(source).toContain("await params");
    expect(source).toContain("JobCardCommandCenter");
    expect(source).not.toMatch(PORTAL_OPT_OUT_PATTERN);
    expect(source).not.toMatch(PORTAL_CACHE_TODO_PATTERN);
  });
});
