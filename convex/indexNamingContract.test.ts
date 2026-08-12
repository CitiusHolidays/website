import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const schema = readFileSync("convex/schema.ts", "utf8");
const compactSchema = schema.replaceAll(/\s+/g, "").replaceAll(",]", "]");

const fieldCompleteIndexes = [
  ["by_initiatedBy_jobCardId_sourceDigest", '["initiatedBy", "jobCardId", "sourceDigest"]'],
  ["by_operationId_batchId", '["operationId", "batchId"]'],
  ["by_operationId", '["operationId"]'],
  [
    "by_initiatedBy_exportKind_jobCardId_commandId",
    '["initiatedBy", "exportKind", "jobCardId", "commandId"]',
  ],
  ["by_actorKey_operation_commandId", '["actorKey", "operation", "commandId"]'],
] as const;

describe("Convex index naming rollout", () => {
  test("defines one active field-complete index for each migrated lookup", () => {
    for (const [name, fields] of fieldCompleteIndexes) {
      expect(compactSchema).toContain(`.index("${name}",${fields.replaceAll(/\s+/g, "")})`);
    }
  });

  test("does not retain duplicate-field legacy aliases", () => {
    for (const name of [
      "by_actor_job_source",
      "by_operation_batch",
      "by_operation",
      "by_actor_export_command",
      "by_actor_operation_command",
    ]) {
      expect(schema).not.toContain(`.index("${name}"`);
    }
  });
});
