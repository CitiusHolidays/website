import { describe, expect, mock, test } from "bun:test";

const redirects = [];
mock.module("next/navigation", () => ({
  redirect: (href) => {
    redirects.push(href);
    throw new Error("NEXT_REDIRECT");
  },
}));
mock.module("./page.client", () => ({ default: () => null }));

const { default: ContactPage } = await import("./page.js");

async function renderContent(query) {
  const boundary = ContactPage({ searchParams: Promise.resolve(query) });
  const content = boundary.props.children;
  return await content.type(content.props);
}

describe("Contact page intents", () => {
  test("Forwards the retired account-deletion intent to self-service deletion", async () => {
    redirects.length = 0;

    await expect(renderContent({ intent: "account-deletion" })).rejects.toThrow("NEXT_REDIRECT");

    expect(redirects).toEqual(["/account?tab=settings#delete-account"]);
  });

  test("Keeps other intents on the contact form", async () => {
    redirects.length = 0;

    const element = await renderContent({ intent: "mice-proposal" });

    expect(redirects).toEqual([]);
    expect(element.props.contactIntent).toBe("mice-proposal");
  });
});
