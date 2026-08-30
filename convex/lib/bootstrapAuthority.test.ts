import { describe, expect, test } from "bun:test";
import {
  BOOTSTRAP_EXPIRY_ENV,
  getBootstrapAuthority,
  getBootstrapAuthorityExpiry,
  isBootstrapAdmin,
} from "./bootstrapAuthority";

const baseEnv = {
  PORTAL_BOOTSTRAP_ADMINS: "Admin@Example.com, second@example.com",
};

describe("Bootstrap authority policy", () => {
  test("Requires an explicit future expiry before the allowlist can grant access", () => {
    expect(getBootstrapAuthority(baseEnv, 1_700_000_000_000).active).toBe(false);
    expect(
      getBootstrapAuthority(
        { ...baseEnv, [BOOTSTRAP_EXPIRY_ENV]: "2020-01-01T00:00:00.000Z" },
        1_700_000_000_000
      ).active
    ).toBe(false);
  });

  test("Normalizes email and accepts an ISO or epoch expiry", () => {
    const env = { ...baseEnv, [BOOTSTRAP_EXPIRY_ENV]: "2030-01-01T00:00:00.000Z" };
    expect(isBootstrapAdmin(" ADMIN@example.com ", env, 1_700_000_000_000)).toBe(true);
    expect(isBootstrapAdmin("unknown@example.com", env, 1_700_000_000_000)).toBe(false);
    expect(getBootstrapAuthorityExpiry(env)).toBe(Date.parse("2030-01-01T00:00:00.000Z"));
    expect(
      getBootstrapAuthority(
        { ...baseEnv, [BOOTSTRAP_EXPIRY_ENV]: "1800000000000" },
        1_700_000_000_000
      ).expiresAt
    ).toBe(1_800_000_000_000);
  });

  test("Expires at the boundary and rejects malformed expiry values", () => {
    const env = { ...baseEnv, [BOOTSTRAP_EXPIRY_ENV]: "2030-01-01T00:00:00.000Z" };
    const expiry = Date.parse(env[BOOTSTRAP_EXPIRY_ENV]);
    expect(getBootstrapAuthority(env, expiry).active).toBe(false);
    expect(
      getBootstrapAuthority(
        { ...baseEnv, [BOOTSTRAP_EXPIRY_ENV]: "tomorrow-ish" },
        1_700_000_000_000
      ).expiresAt
    ).toBeNull();
    expect(
      getBootstrapAuthority(
        { ...baseEnv, [BOOTSTRAP_EXPIRY_ENV]: "999999999999999999999" },
        1_700_000_000_000
      ).expiresAt
    ).toBeNull();
  });

  test("Fails closed when the authorization reference time is not deterministic", () => {
    const env = { ...baseEnv, [BOOTSTRAP_EXPIRY_ENV]: "2030-01-01T00:00:00.000Z" };
    for (const referenceTime of [Number.NaN, Number.POSITIVE_INFINITY, -1, 1.5]) {
      expect(getBootstrapAuthority(env, referenceTime).active).toBe(false);
      expect(isBootstrapAdmin("admin@example.com", env, referenceTime)).toBe(false);
    }
  });
});
