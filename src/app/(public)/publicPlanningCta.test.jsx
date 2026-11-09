import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

mock.module("next/image", () => ({
  default: ({ alt }) => <span aria-label={alt} role="img" />,
}));

const { default: AboutPage } = await import("./about/page.client.js");
const { default: ServicesPage } = await import("./services/page.client.js");

describe("Public pages without their own enquiry form", () => {
  test.each([
    ["About", AboutPage],
    ["Services", ServicesPage],
  ])("%s ends with the standard planning call to action", (_name, Page) => {
    const markup = renderToStaticMarkup(<Page />);
    expect(markup).toContain("Planning a trip or event?");
    expect(markup).toContain('href="/contact"');
    expect(markup).toContain("Start Planning Now");
  });
});
