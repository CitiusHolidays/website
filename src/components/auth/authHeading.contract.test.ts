import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const credentials = readFileSync(new URL("./AuthLoginCredentials.js", import.meta.url), "utf8");
const hero = readFileSync(new URL("./AuthLoginHero.js", import.meta.url), "utf8");

describe("auth page heading contract", () => {
  test("keeps one responsive primary heading in the credentials surface", () => {
    expect(credentials.match(/<h1\b/g)).toHaveLength(1);
    expect(credentials).toContain('{mode === "signin" ? copy.signInTitle : copy.signUpTitle}');
    expect(hero).not.toContain("<h1");
  });
});
