import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import TrailHeroSlideshow from "./TrailHeroSlideshow";

describe("Trail hero", () => {
  test("Links back to the list of trails", () => {
    const markup = renderToStaticMarkup(
      <TrailHeroSlideshow trail={{ slug: "synthetic-trail", title: "Synthetic trail" }} />
    );
    expect(markup).toContain('href="/pilgrimage#all-trails"');
    expect(markup).toContain("All spiritual trails");
  });
});
