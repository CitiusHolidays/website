import { describe, expect, mock, test } from "bun:test";

let mutationCalls = 0;

mock.module("@/lib/auth-server", () => ({
  fetchAuthMutation: () => {
    mutationCalls += 1;
    return Promise.reject(new Error("must not be called"));
  },
}));

const { POST } = await import("./route");

describe("Verify-payment route", () => {
  test("refuses a cross-site browser request before verifying or confirming", async () => {
    const response = await POST(
      new Request("http://localhost/api/verify-payment", {
        body: JSON.stringify({
          razorpay_order_id: "order_1",
          razorpay_payment_id: "pay_1",
          razorpay_signature: "signature",
        }),
        headers: { "Content-Type": "text/plain", "Sec-Fetch-Site": "cross-site" },
        method: "POST",
      })
    );

    expect(response.status).toBe(403);
    expect(mutationCalls).toBe(0);
  });
});
