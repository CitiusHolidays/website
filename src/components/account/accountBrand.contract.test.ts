import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../../..");
const globals = readFileSync(resolve(root, "src/app/globals.css"), "utf8");
const accountUi = readFileSync(resolve(root, "src/components/account/AccountUi.js"), "utf8");
const rootLayout = readFileSync(resolve(root, "src/app/layout.js"), "utf8");
const RAW_HEX_COLOR_PATTERN = /#[0-9a-f]{3,8}/i;

function sourceBetween(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe("customer Account brand contract", () => {
  test("reuses the chosen global Inter and Poppins tokens without redefining fonts", () => {
    const accountStyles = sourceBetween(globals, ".account-shell", ".account-card");

    expect(rootLayout).toContain('import { Inter, Poppins } from "next/font/google"');
    expect(rootLayout).toContain('variable: "--font-inter"');
    expect(rootLayout).toContain('variable: "--font-poppins"');
    expect(accountStyles).toContain("font-family: var(--font-inter), system-ui, sans-serif");
    expect(accountStyles).toContain("font-family: var(--font-poppins), sans-serif");
    expect(accountStyles).not.toContain("Georgia");
    expect(accountStyles).not.toContain("Times New Roman");
  });

  test("aliases Account colors to the canonical public Citius palette", () => {
    const accountShell = sourceBetween(globals, ".account-shell", ".account-display");

    expect(accountShell).toContain("--account-night: var(--color-public-night)");
    expect(accountShell).toContain("--account-ink: var(--color-public-ink)");
    expect(accountShell).toContain("--account-paper: var(--color-public-paper)");
    expect(accountShell).toContain("--account-surface: var(--color-public-surface)");
    expect(accountShell).toContain("--account-gold: var(--color-public-orange-ink)");
    expect(accountShell).toContain("--account-muted: var(--color-public-muted)");
    expect(accountShell).toContain("--account-border: var(--color-brand-border)");
    expect(accountShell).not.toMatch(RAW_HEX_COLOR_PATTERN);
  });

  test("renders the canonical image logo instead of a substitute text mark", () => {
    const accountMark = sourceBetween(
      accountUi,
      "export function AccountMark",
      "export function NavButton"
    );

    expect(accountUi).toContain('import Logo from "@/static/logos/logo.webp"');
    expect(accountMark).toContain("<Image");
    expect(accountMark).toContain('alt="Citius Holidays"');
    expect(accountMark).toContain("src={Logo}");
    expect(accountMark).not.toContain("CITIUS");
    expect(accountMark).not.toContain("<Plane");
  });
});
