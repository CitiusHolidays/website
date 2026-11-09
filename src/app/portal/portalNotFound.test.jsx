import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

mock.module("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
mock.module("@/components/portal/PortalNavigationPalette", () => ({
  default: ({ children }) => children,
}));

const { default: PortalMissingPage } = await import("./[...missing]/page.js");
const { default: PortalNotFoundPage } = await import("./not-found.js");

describe("Unknown Staff Workspace addresses", () => {
  test("Resolve to the portal's own not-found page", () => {
    expect(() => PortalMissingPage()).toThrow("NEXT_NOT_FOUND");
  });

  test("Offer a way back to the workspace, not staff sign-in", () => {
    const markup = renderToStaticMarkup(<PortalNotFoundPage />);
    expect(markup).toContain("This page does not exist");
    expect(markup).toContain('href="/portal"');
    expect(markup).not.toContain("/auth/connect");
  });
});
