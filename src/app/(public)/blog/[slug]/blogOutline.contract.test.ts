import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const postPage = readFileSync(new URL("./page.client.js", import.meta.url), "utf8");

describe("blog post document outline", () => {
  test("reserves h1 for the route title and demotes author-supplied h1 blocks", () => {
    expect(postPage).toContain("h1: ({ children }) => (\n      <h2");
    expect(postPage).toContain("{post.title}\n              </h1>");
  });
});
