import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { ConvexError } from "convex/values";
import { renderToStaticMarkup } from "react-dom/server";
import { classifyPortalRouteError } from "@/lib/portal/portalRouteError";
import PortalRouteError from "./PortalRouteError";

describe("classifyPortalRouteError", () => {
  test("A FORBIDDEN Convex error is an access problem, not a session failure", () => {
    expect(classifyPortalRouteError(new ConvexError("FORBIDDEN"))).toBe("forbidden");
  });

  test("Record lookups that miss are a missing record", () => {
    expect(classifyPortalRouteError(new ConvexError("Job Card not found"))).toBe("missing");
    expect(classifyPortalRouteError(new ConvexError("Invalid Job Card id"))).toBe("missing");
  });

  test("Anything else is a page that could not load", () => {
    expect(classifyPortalRouteError(new Error("FORBIDDEN"))).toBe("unavailable");
    expect(classifyPortalRouteError(new ConvexError("Rate limited"))).toBe("unavailable");
    expect(classifyPortalRouteError(new ConvexError({ code: "FORBIDDEN" }))).toBe("unavailable");
    expect(classifyPortalRouteError("boom")).toBe("unavailable");
  });
});

describe("PortalRouteError", () => {
  const render = (error: Error) =>
    renderToStaticMarkup(<PortalRouteError error={error} retry={() => undefined} />);

  test("Access errors say so and offer the workspace and sign-in, not a retry", () => {
    const html = render(new ConvexError("FORBIDDEN"));
    expect(html).toContain("You do not have access to this");
    expect(html).toContain('href="/portal"');
    expect(html).toContain('href="/auth/connect"');
    expect(html).not.toContain("Try again");
    expect(html).not.toContain("verify your session");
  });

  test("Missing records link back to the workspace", () => {
    const html = render(new ConvexError("Job Card not found"));
    expect(html).toContain("This record could not be found");
    expect(html).toContain('href="/portal"');
    expect(html).not.toContain("Try again");
  });

  test("Load failures offer a retry and a way back", () => {
    const html = render(new Error("network"));
    expect(html).toContain("This page could not be loaded");
    expect(html).toContain("Try again");
    expect(html).toContain('href="/portal"');
  });

  test("Every Staff Workspace error boundary uses this panel", () => {
    for (const file of [
      "src/app/portal/error.js",
      "src/app/portal/travel-schedule/error.tsx",
      "src/app/portal/external-tour-managers/error.tsx",
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source, file).toContain("PortalRouteError");
      expect(source, file).not.toContain("PrivateAuthError");
    }
  });
});
