import { describe, expect, test } from "bun:test";
import {
  AUTH_LOGIN_VARIANTS,
  getAuthRecoveryUrl,
  getAuthVariant,
  getAuthVariantFromCallbackUrl,
  getLoginUrlForCallback,
  getSignInAuthUrl,
  resolveAuthReturnTarget,
  SIGN_IN_TARGET_LIST,
  VISIBLE_SIGN_IN_TARGETS,
} from "./auth-sign-in-targets";

describe("Auth sign-in target inventory", () => {
  test("keeps Vendor provisioned but hidden from the public chooser", () => {
    expect(Object.keys(AUTH_LOGIN_VARIANTS)).toEqual(["employee", "guest", "vendor"]);
    expect(SIGN_IN_TARGET_LIST.map((target) => target.id)).toEqual(["employee", "guest", "vendor"]);
    expect(VISIBLE_SIGN_IN_TARGETS.map((target) => target.id)).toEqual(["employee", "guest"]);
  });

  test("uses the official implemented product identity", () => {
    expect(AUTH_LOGIN_VARIANTS.employee).toMatchObject({
      label: "Citius Connect",
      metadata: { title: "Citius Connect" },
    });
    expect(AUTH_LOGIN_VARIANTS.guest).toMatchObject({
      label: "Customer Travel Account",
      metadata: { title: "Customer Travel Account" },
    });
  });

  test("preserves Vendor sign-in and isolates its return path", () => {
    expect(getAuthVariant("vendor").visible).toBe(false);
    expect(getSignInAuthUrl("vendor")).toBe("/auth/vendor");
    expect(getLoginUrlForCallback("/vendor")).toBe("/auth/vendor");
    expect(getAuthVariantFromCallbackUrl("/vendor").id).toBe("vendor");
    expect(resolveAuthReturnTarget("vendor", "/vendor/files")).toBe("/vendor");
    expect(resolveAuthReturnTarget("vendor", "/portal/queries")).toBe("/vendor");
    expect(resolveAuthReturnTarget("guest", "/vendor")).toBe("/account");
  });

  test("preserves only relative paths owned by the selected product", () => {
    expect(resolveAuthReturnTarget("employee", "/portal/queries?open=salesDecision&id=q_1")).toBe(
      "/portal/queries?open=salesDecision&id=q_1"
    );
    expect(resolveAuthReturnTarget("guest", "/account?tab=journeys&journey=j_safe")).toBe(
      "/account?tab=journeys&journey=j_safe"
    );
    expect(resolveAuthReturnTarget("employee", "/account?tab=profile")).toBe("/portal");
    expect(resolveAuthReturnTarget("guest", "/portal/queries")).toBe("/account");
  });

  test("rejects hostile, ambiguous, encoded, and overlong return values", () => {
    for (const candidate of [
      "https://attacker.example/portal",
      "//attacker.example/portal",
      "javascript:alert(1)",
      "/portal\\queries",
      "/portal/queries#private",
      "/portal/%2e%2e/account",
      "/portal/%252e%252e/account",
      "/portal%2fqueries",
      "/portal\u0000/queries",
      `/portal?${"x".repeat(2048)}`,
    ]) {
      expect(resolveAuthReturnTarget("employee", candidate)).toBe("/portal");
    }
    expect(resolveAuthReturnTarget("employee", ["/portal", "/account"])).toBe("/portal");
    for (const candidate of [["/account", "/portal"], {}, 1, null, undefined]) {
      expect(getLoginUrlForCallback(candidate)).toBe("/auth/guest");
    }
  });

  test("carries a validated deep target through login and recovery URLs", () => {
    const target = "/portal/queries?open=salesDecision&id=q_1";
    expect(getAuthVariantFromCallbackUrl(target).id).toBe("employee");
    expect(getLoginUrlForCallback(target)).toBe(
      "/auth/connect?callbackUrl=%2Fportal%2Fqueries%3Fopen%3DsalesDecision%26id%3Dq_1"
    );
    expect(getSignInAuthUrl("employee", target)).toBe(
      "/auth/connect?callbackUrl=%2Fportal%2Fqueries%3Fopen%3DsalesDecision%26id%3Dq_1"
    );
    expect(getAuthRecoveryUrl("/auth/forgot-password", "employee", target)).toBe(
      "/auth/forgot-password?callbackUrl=%2Fportal%2Fqueries%3Fopen%3DsalesDecision%26id%3Dq_1"
    );
  });
});
