import { describe, expect, test } from "bun:test";
import {
  AUTH_LOGIN_VARIANTS,
  getAuthVariant,
  getLoginUrlForCallback,
  getSignInAuthUrl,
  SIGN_IN_TARGET_LIST,
  VISIBLE_SIGN_IN_TARGETS,
} from "./auth-sign-in-targets";

describe("Auth sign-in target inventory", () => {
  test("registers only the implemented Staff and Customer products", () => {
    expect(Object.keys(AUTH_LOGIN_VARIANTS)).toEqual(["employee", "guest"]);
    expect(SIGN_IN_TARGET_LIST.map((target) => target.id)).toEqual(["employee", "guest"]);
    expect(VISIBLE_SIGN_IN_TARGETS.map((target) => target.id)).toEqual(["employee", "guest"]);
  });

  test("fails closed for Vendor auth and preserves owned callback mappings", () => {
    expect(() => getAuthVariant("vendor")).toThrow("Unknown auth variant: vendor");
    expect(() => getSignInAuthUrl("vendor")).toThrow("Unknown auth variant: vendor");
    expect(getLoginUrlForCallback("/vendor")).toBe("/contact");
    expect(getLoginUrlForCallback("/vendor/invoices?open=invoice_1")).toBe("/contact");
    expect(getLoginUrlForCallback("/vendor?mode=signin")).toBe("/contact");
    expect(getLoginUrlForCallback("/portal")).toBe("/auth/connect");
    expect(getLoginUrlForCallback("/account")).toBe("/auth/guest");
  });
});
