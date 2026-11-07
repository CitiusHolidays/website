import { describe, expect, test } from "bun:test";
import { hashTripInviteToken, TRIP_INVITE_TOKEN_PATTERN } from "@convex/lib/customerTripInvites";
import { newInviteToken } from "./customerInviteTokens";

describe("customer app invite tokens", () => {
  test("match the server's token format and hash", async () => {
    const { hash, token } = await newInviteToken();
    expect(TRIP_INVITE_TOKEN_PATTERN.test(token)).toBe(true);
    expect(hash).toBe(await hashTripInviteToken(token));
  });

  test("are different every time", async () => {
    const tokens = await Promise.all(Array.from({ length: 20 }, () => newInviteToken()));
    expect(new Set(tokens.map((row) => row.token)).size).toBe(20);
  });
});
