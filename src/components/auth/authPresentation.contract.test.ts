import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { authRecoveryMotion } from "./AuthRecoveryTransition";

const read = (path: string) => readFileSync(path, "utf8");
const AUTH_SOURCES = [
  "src/components/auth/AuthFeatureList.js",
  "src/components/auth/AuthLoginCredentials.js",
  "src/components/auth/AuthLoginForm.js",
  "src/components/auth/AuthLoginHero.js",
  "src/components/auth/AuthRecoveryLayout.js",
  "src/components/auth/AuthShell.js",
  "src/app/(auth)/auth/email-verified/page.client.js",
  "src/app/(auth)/auth/forgot-password/page.client.js",
  "src/app/(auth)/auth/reset-password/page.client.js",
  "src/lib/auth-sign-in-targets.js",
];
const LIGHT_AUTH_SOURCES = [
  "src/components/auth/AuthLoginCredentials.js",
  "src/components/auth/AuthLoginForm.js",
  "src/app/(auth)/auth/email-verified/page.client.js",
  "src/app/(auth)/auth/forgot-password/page.client.js",
  "src/app/(auth)/auth/reset-password/page.client.js",
];
const OKLCH_CHANNEL_PATTERN = /oklch\(([\d.]+) ([\d.]+) ([\d.]+)/;
const SEAMLESS_CLICHE_PATTERN = /Seamless (?:Exploration|support)/;
const PORTAL_SMALL_TARGET_PATTERN = /\.portal-small-btn\s*\{[\s\S]*?min-height:\s*2\.5rem;/;
const PORTAL_DANGER_TARGET_PATTERN = /\.portal-danger-btn\s*\{[\s\S]*?min-height:\s*2\.5rem;/;

function relativeLuminance([lightness, chroma, hue]: [number, number, number]) {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const l = (lightness + 0.396_337_777_4 * a + 0.215_803_757_3 * b) ** 3;
  const m = (lightness - 0.105_561_345_8 * a - 0.063_854_172_8 * b) ** 3;
  const s = (lightness - 0.089_484_177_5 * a - 1.291_485_548 * b) ** 3;
  const red = 4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s;
  const green = -1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s;
  const blue = -0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function readOklchToken(source: string, token: string) {
  const tokenLine = source.split("\n").find((line) => line.includes(`${token}:`));
  const channels = tokenLine?.match(OKLCH_CHANNEL_PATTERN);
  if (!channels) {
    throw new Error(`Missing auth color token ${token}`);
  }
  // SAFETY: This test controls the asserted value at the framework boundary below.
  return channels.slice(1).map(Number) as [number, number, number];
}

function contrastRatio(left: [number, number, number], right: [number, number, number]) {
  const leftLuminance = relativeLuminance(left);
  const rightLuminance = relativeLuminance(right);
  return (
    (Math.max(leftLuminance, rightLuminance) + 0.05) /
    (Math.min(leftLuminance, rightLuminance) + 0.05)
  );
}

describe("auth presentation and recovery contract", () => {
  test("splits decorative gold from a WCAG AA light-surface auth ink", () => {
    const globals = read("src/app/globals.css");
    expect(globals).toContain("--color-auth-accent-on-dark");
    expect(globals).toContain("--color-auth-accent-ink");
    expect(
      contrastRatio(
        readOklchToken(globals, "--color-auth-accent-ink"),
        readOklchToken(globals, "--color-public-paper")
      )
    ).toBeGreaterThanOrEqual(4.5);
    for (const path of LIGHT_AUTH_SOURCES) {
      const source = read(path);
      expect(source, path).not.toContain("#d4af37");
      expect(source, path).not.toContain("#b5952f");
    }
  });

  test("keeps helper copy readable and removes generic auth presentation copy", () => {
    const combined = AUTH_SOURCES.map(read).join("\n");
    expect(combined).not.toContain("font-light");
    expect(combined).not.toContain("John Doe");
    expect(combined).not.toMatch(SEAMLESS_CLICHE_PATTERN);
    expect(combined).not.toContain("mobileTitle");
    expect(read("src/components/auth/AuthFeatureList.js")).toContain("divide-y divide-white/10");
  });

  test("auth fields expose mode-aware autofill, busy state, and usable visibility targets", () => {
    const login = read("src/components/auth/AuthLoginForm.js");
    const forgot = read("src/app/(auth)/auth/forgot-password/page.client.js");
    const reset = read("src/app/(auth)/auth/reset-password/page.client.js");
    expect(login).toContain('autoComplete="name"');
    expect(login).toContain('autoComplete="email"');
    expect(login).toContain('mode === "signup" ? "new-password" : "current-password"');
    expect(login).toContain("min-h-11 min-w-11");
    expect(login).toContain("aria-busy={isLoading}");
    expect(forgot).toContain('autoComplete="email"');
    expect(forgot).toContain("aria-invalid");
    expect(reset.match(/autoComplete="new-password"/g)).toHaveLength(2);
    expect(reset).toContain("focusInvalidField");
    expect(reset).toContain("clearTimeout(redirectTimer)");
  });

  test("primary auth actions stay flat and focused", () => {
    for (const path of LIGHT_AUTH_SOURCES) {
      const source = read(path);
      expect(source, path).not.toContain("bg-gradient-to-r");
      expect(source, path).not.toContain("shadow-xl");
      expect(source, path).not.toContain("whileHover={{ scale");
    }
  });

  test("uses the exact recovery crossfade and reduced-motion recipes", () => {
    const full = authRecoveryMotion(false);
    expect(full.initial).toEqual({
      opacity: 0,
      transform: "translateY(6px) scale(0.98)",
    });
    expect(full.exit).toEqual({ opacity: 0, transform: "translateY(-4px) scale(0.99)" });
    expect(full.transition).toMatchObject({
      opacity: { duration: 0.3, ease: "linear" },
      transform: {
        damping: 33.161_255_787_892_26,
        stiffness: 304.617_419_786_708_64,
        type: "spring",
      },
    });
    expect(authRecoveryMotion(true)).toEqual({
      animate: { opacity: 1, transform: "none" },
      exit: { opacity: 0, transform: "none" },
      initial: { opacity: 0, transform: "none" },
      transition: { duration: 0.2, ease: "linear" },
    });
    const transition = read("src/components/auth/AuthRecoveryTransition.js");
    expect(transition).toContain('<AnimatePresence initial={false} mode="wait">');
    expect(transition).toContain("inert={isPresent ? undefined : true}");
    expect(transition).toContain("aria-live={tone}");
    expect(transition).toContain("useState(null)");
    expect(transition).toContain("setMotionPreference(Boolean(prefersReducedMotion))");
    expect(transition).toContain("motionPreference === null ? null");
  });

  test("compact Staff and Account actions retain minimum acquisition targets", () => {
    const globals = read("src/app/globals.css");
    const account = [
      "src/components/account/AccountSidebar.js",
      "src/components/account/AccountProfilePanel.js",
      "src/components/account/AccountSettingsPanel.js",
      "src/components/account/AccountJourneysPanel.js",
    ]
      .map(read)
      .join("\n");
    expect(globals).toMatch(PORTAL_SMALL_TARGET_PATTERN);
    expect(globals).toMatch(PORTAL_DANGER_TARGET_PATTERN);
    expect(account).not.toContain("min-h-0");
    expect(account).toContain("min-h-11");
    const accountUi = read("src/components/account/AccountUi.js");
    const accountToggle = accountUi.slice(
      accountUi.indexOf("export function Toggle"),
      accountUi.indexOf("export function AccountHero")
    );
    expect(accountToggle).toContain("before:-inset-y-2.5");
    expect(accountToggle).toContain('thumbClassName="absolute top-1 left-1 duration-150');
    expect(accountToggle).not.toContain("<m.span");
    expect(accountToggle).not.toContain("animate={{");
    expect(read("src/components/portal/QueryRowActions.tsx")).not.toContain("md:min-h-8");
  });
});
