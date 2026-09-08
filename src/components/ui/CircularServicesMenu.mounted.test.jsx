import { describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { renderToStaticMarkup } from "react-dom/server";
import { PUBLIC_SERVICES } from "@/data/publicServices";
import CircularServicesMenu from "./CircularServicesMenu";

describe("Public service choices", () => {
  test("All eleven choices have readable descriptions and ordinary detail or enquiry links", () => {
    const dom = new JSDOM(renderToStaticMarkup(<CircularServicesMenu />));
    const { document } = dom.window;
    const items = [...document.querySelectorAll("ul > li")];
    expect(items).toHaveLength(11);
    expect(items.map((item) => item.querySelector("h2")?.textContent)).toEqual(
      PUBLIC_SERVICES.map((service) => service.title)
    );
    for (const [index, item] of items.entries()) {
      const link = item.querySelector("a");
      expect(item.querySelector("p")?.textContent).toBe(PUBLIC_SERVICES[index].description);
      expect(link?.textContent).toContain(PUBLIC_SERVICES[index].title);
      expect(link?.tabIndex).toBe(0);
      expect(link?.getAttribute("href")).toBe(
        PUBLIC_SERVICES[index].path === "/services" ? "/contact" : PUBLIC_SERVICES[index].path
      );
    }
    expect(document.querySelector("button")).toBeNull();
    expect(document.body.textContent).not.toContain("Hover");
    dom.window.close();
  });
});
