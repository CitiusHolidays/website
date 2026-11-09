import { afterEach, describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

const queryCalls = [];
let token;
let jobCardId;

mock.module("next/navigation", () => ({
  redirect: (href) => {
    throw new Error(`NEXT_REDIRECT ${href}`);
  },
}));
mock.module("@/lib/auth-server", () => ({
  fetchAuthQuery: (reference, args, options) => {
    queryCalls.push({ args, options, reference });
    return Promise.resolve(jobCardId);
  },
  getToken: () => Promise.resolve(token),
}));
mock.module("@/components/portal/PortalNavigationPalette", () => ({
  default: ({ children }) => children,
}));

const { default: PortalTourManagerAllocationPage } = await import("./page.js");

const render = () =>
  PortalTourManagerAllocationPage({ params: Promise.resolve({ assignmentId: "assignment-1" }) });

afterEach(() => {
  queryCalls.length = 0;
});

describe("Tour Manager allocation notification page", () => {
  test("Replaces the address with the assignment's Job Card", async () => {
    token = "session-token";
    jobCardId = "job-card-7";
    await expect(render()).rejects.toThrow("NEXT_REDIRECT /portal/job-cards/job-card-7");
    expect(queryCalls).toHaveLength(1);
    expect(queryCalls[0].args).toEqual({ assignmentId: "assignment-1" });
    expect(queryCalls[0].options).toEqual({ token: "session-token" });
  });

  test("Offers the Job Card list, without redirecting, when the card cannot be opened", async () => {
    token = "session-token";
    jobCardId = null;
    const markup = renderToStaticMarkup(await render());
    expect(markup).toContain("This Job Card is not available");
    expect(markup).toContain('href="/portal/job-cards"');
  });

  test("Does not query Convex without a session", async () => {
    token = null;
    jobCardId = "job-card-7";
    const markup = renderToStaticMarkup(await render());
    expect(queryCalls).toHaveLength(0);
    expect(markup).toContain("This Job Card is not available");
  });
});
