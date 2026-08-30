import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { sacredBharatEditionHref } from "@/lib/sacredBharat/editionHref";
import { deriveEditionResult } from "@/lib/sacredBharat/editionResult";
import { SACRED_BHARAT_EDITION_001 } from "./edition001";
import { validateSacredBharatEditionAssets } from "./editionAssetValidation";
import {
  createSacredBharatEditionRegistry,
  isAllowedSacredBharatEventEnvelope,
  resolveSacredBharatEdition,
  SACRED_BHARAT_EDITION_REGISTRY,
  validateSacredBharatEdition,
} from "./editionRegistry";

function syntheticEdition(
  editionId: string,
  status: "archived" | "published"
): typeof SACRED_BHARAT_EDITION_001 {
  const edition = structuredClone(SACRED_BHARAT_EDITION_001);
  edition.edition = editionId;
  edition.operationalControlKey = `synthetic.sacred_bharat_${editionId}`;
  edition.publication.status = status;
  edition.publication.reviewedOn = "2099-01-01";
  edition.contentRecord.revision = `${editionId}.test`;
  edition.questions = edition.questions.map((question) => ({
    ...question,
    id: `${editionId}-${question.id}`,
    image: question.image.replace("/001/", `/${editionId}/`),
  }));
  edition.share.image = edition.share.image.replace("/001/", `/${editionId}/`);
  return edition;
}

describe("Sacred Bharat recurring edition registry", () => {
  test("scores two synthetic editions under one content and result contract", () => {
    const archived = syntheticEdition("001", "archived");
    const active = syntheticEdition("002", "published");
    const registry = createSacredBharatEditionRegistry({
      activeEditionId: "002",
      editions: [archived, active],
      legacyUnversionedShareEditionId: "001",
    });

    for (const edition of registry.editions) {
      expect(validateSacredBharatEdition(edition)).toBe(edition);
      const correctness = Object.fromEntries(
        edition.questions.map((question: { id: string }) => [question.id, true])
      );
      expect(deriveEditionResult(edition.questions, correctness)).toMatchObject({
        score: edition.questions.length,
        total: edition.questions.length,
      });
    }
  });

  test("keeps active entry, legacy shares, archives, and unknown links deterministic", () => {
    const archived = syntheticEdition("001", "archived");
    const active = syntheticEdition("002", "published");
    const registry = createSacredBharatEditionRegistry({
      activeEditionId: "002",
      editions: [archived, active],
      legacyUnversionedShareEditionId: "001",
    });

    expect(resolveSacredBharatEdition({}, registry)?.edition).toBe("002");
    expect(resolveSacredBharatEdition({ hasLegacyShareToken: true }, registry)?.edition).toBe(
      "001"
    );
    expect(resolveSacredBharatEdition({ requestedEditionId: "001" }, registry)?.edition).toBe(
      "001"
    );
    expect(resolveSacredBharatEdition({ requestedEditionId: "999" }, registry)).toBeNull();
    expect(sacredBharatEditionHref("001", { via: "a".repeat(32) })).toBe(
      `/sacred-bharat/001?via=${"a".repeat(32)}`
    );
  });

  test("allows only the selected edition's event, question, style, and score vocabulary", () => {
    const archived = syntheticEdition("001", "archived");
    const active = syntheticEdition("002", "published");
    const registry = createSacredBharatEditionRegistry({
      activeEditionId: "002",
      editions: [archived, active],
      legacyUnversionedShareEditionId: "001",
    });

    expect(
      isAllowedSacredBharatEventEnvelope(
        {
          edition: "002",
          event: "question_answered",
          questionId: active.questions[0]?.id,
        },
        registry
      )
    ).toBe(true);
    expect(
      isAllowedSacredBharatEventEnvelope(
        {
          edition: "002",
          event: "question_answered",
          questionId: archived.questions[0]?.id,
        },
        registry
      )
    ).toBe(false);
    expect(
      isAllowedSacredBharatEventEnvelope(
        { edition: "002", event: "share_clicked", score: 6, style: "archive" },
        registry
      )
    ).toBe(false);
    expect(
      isAllowedSacredBharatEventEnvelope({ edition: "999", event: "edition_started" }, registry)
    ).toBe(false);
  });

  test("validates reviewed provenance and the exact crop derivatives on disk", async () => {
    await expect(
      validateSacredBharatEditionAssets(
        SACRED_BHARAT_EDITION_REGISTRY.editions,
        resolve(import.meta.dir, "../../../public")
      )
    ).resolves.toBeUndefined();

    const invalid = syntheticEdition("002", "published");
    invalid.questions[0].asset.transformations = ["generated", "webp"];
    expect(() => validateSacredBharatEdition(invalid)).toThrow(
      "may only record crop and WebP conversion"
    );
  });
});
