import { describe, expect, test } from "bun:test";
import { Suspense } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PublicRouteLoadingShell from "@/components/layout/PublicRouteLoadingShell";
import ContactPage from "./contact/page";
import PoliciesPage from "./policies/page";

function fallbackMarkup(page) {
  expect(page.type).toBe(Suspense);
  expect(page.props.fallback.type).toBe(PublicRouteLoadingShell);
  return renderToStaticMarkup(page.props.fallback);
}

describe("Public URL-data loading shells", () => {
  test("keeps contact intent data behind a truthful static shell", () => {
    const sentinel = "private-contact-intent";
    const markup = fallbackMarkup(
      ContactPage({ searchParams: Promise.resolve({ intent: sentinel }) })
    );

    expect(markup).toContain("Get in Touch");
    expect(markup).toContain("Tell us your dates, group size, and destination.");
    expect(markup).not.toContain(sentinel);
  });

  test("keeps the selected policy behind a truthful static shell", () => {
    const sentinel = "private-policy-view";
    const markup = fallbackMarkup(
      PoliciesPage({ searchParams: Promise.resolve({ view: sentinel }) })
    );

    expect(markup).toContain("Legal &amp; Policies");
    expect(markup).toContain("These policies govern bookings, cancellations, and travel");
    expect(markup).not.toContain(sentinel);
  });
});
