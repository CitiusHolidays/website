import { beforeEach, describe, expect, mock, test } from "bun:test";

const calls: string[] = [];

mock.module("@/lib/auth-server", () => ({
  fetchAuthMutation: () => {
    calls.push("mutation");
    return { email: "traveller@example.com", id: "user_1", name: "A Traveller" };
  },
  fetchAuthQuery: () => {
    calls.push("query");
    return { id: "user_1" };
  },
}));

const { PUT } = await import("./route");

function put(headers: Record<string, string>) {
  return PUT(
    new Request("http://localhost/api/profile", {
      body: JSON.stringify({ name: "A Traveller", phoneNumber: "" }),
      headers: { "Content-Type": "application/json", ...headers },
      method: "PUT",
    })
  );
}

beforeEach(() => {
  calls.length = 0;
});

describe("Profile route", () => {
  test("refuses a cross-site browser request before reading the session", async () => {
    const response = await put({ Origin: "https://attacker.example" });

    expect(response.status).toBe(403);
    expect(calls).toEqual([]);
  });

  test("updates the signed-in profile for a same-origin request", async () => {
    const response = await put({ "Sec-Fetch-Site": "same-origin" });

    expect(response.status).toBe(200);
    expect(calls).toEqual(["query", "mutation"]);
  });
});
