import { describe, expect, test } from "bun:test";
import {
  executeAiProviderOrchestration,
  prepareAiProviderBoundary,
} from "./majorCapabilityPreparation";

describe("AI provider privacy boundary", () => {
  test("allowlists fields and redacts sensitive sentinels before provider egress or safe logging", async () => {
    const sentinels = {
      card: "4111 1111 1111 1111",
      email: "traveller.private@example.test",
      passport: "Z1234567",
      phone: "98765 43210",
      secret: "sk-private-sentinel",
    };
    let captured: unknown;
    let logged = "";

    await executeAiProviderOrchestration(
      {
        capability: "concierge",
        maxOutputTokens: 512,
        messages: [
          {
            content: [
              {
                providerMetadata: { rawBody: "provider-body-sentinel" },
                text: `Email ${sentinels.email}; mobile ${sentinels.phone}; passport ${sentinels.passport}; card ${sentinels.card}; api_key=${sentinels.secret}`,
                type: "text",
              },
            ],
            providerOptions: { raw: "private-provider-option" },
            role: "user",
          },
        ],
        models: ["recording-provider/model"],
        system: `Never repeat password=${sentinels.secret}`,
        totalTimeoutMs: 10_000,
      },
      (prepared) => {
        captured = prepared;
        logged = JSON.stringify(prepared);
        return Promise.resolve({ recorded: true });
      }
    );

    const serialized = JSON.stringify({ captured, logged });
    for (const sentinel of Object.values(sentinels)) {
      expect(serialized).not.toContain(sentinel);
    }
    expect(serialized).not.toContain("provider-body-sentinel");
    expect(serialized).not.toContain("private-provider-option");
    expect(serialized).toContain("[REDACTED_CONTACT]");
    expect(serialized).toContain("[REDACTED_PASSPORT]");
    expect(serialized).toContain("[REDACTED_PAYMENT]");
    expect(serialized).toContain("[REDACTED_SECRET]");
  });

  test("rejects non-text content, unknown roles, empty messages, and oversized requests", () => {
    const base = {
      capability: "concierge" as const,
      maxOutputTokens: 512,
      models: ["recording-provider/model"],
      system: "Safe system prompt",
      totalTimeoutMs: 10_000,
    };

    expect(() =>
      prepareAiProviderBoundary({
        ...base,
        messages: [{ content: [{ data: "private", type: "file" }], role: "user" }],
      })
    ).toThrow("AI_PROVIDER_BOUNDARY_INVALID");
    expect(() =>
      prepareAiProviderBoundary({
        ...base,
        messages: [{ content: "private", role: "system" }],
      })
    ).toThrow("AI_PROVIDER_BOUNDARY_INVALID");
    expect(() => prepareAiProviderBoundary({ ...base, messages: [] })).toThrow(
      "AI_PROVIDER_BOUNDARY_INVALID"
    );
    expect(() =>
      prepareAiProviderBoundary({
        ...base,
        messages: Array.from({ length: 21 }, () => ({ content: "safe", role: "user" })),
      })
    ).toThrow("AI_PROVIDER_BOUNDARY_INVALID");
    expect(() =>
      prepareAiProviderBoundary({
        ...base,
        messages: [
          {
            content: [
              { text: "a".repeat(2500), type: "text" },
              { text: "b".repeat(2500), type: "text" },
            ],
            role: "user",
          },
        ],
      })
    ).toThrow("AI_PROVIDER_BOUNDARY_INVALID");
  });

  test("preserves ordinary travel-planning text", () => {
    const safeTravelText =
      "Plan a seven-day Kerala trip for 4 travellers from 12 October, and explain passport requirements.";
    expect(
      prepareAiProviderBoundary({
        capability: "concierge",
        maxOutputTokens: 512,
        messages: [{ content: safeTravelText, role: "user" }],
        models: ["recording-provider/model"],
        system: "Use reviewed Citius travel guidance.",
        totalTimeoutMs: 10_000,
      })
    ).toMatchObject({
      messages: [{ content: safeTravelText, role: "user" }],
      system: "Use reviewed Citius travel guidance.",
    });
  });
});
