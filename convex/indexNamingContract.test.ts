import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const schema = readFileSync("convex/schema.ts", "utf8");
const compactSchema = schema.replaceAll(/\s+/g, "");

const stagedFieldCompleteIndexes = [
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
  test("adds staged, field-complete aliases before any call-site migration", () => {
    for (const [name, fields] of stagedFieldCompleteIndexes) {
      expect(compactSchema).toContain(
        `.index("${name}",{fields:${fields},staged:true`.replaceAll(/\s+/g, "")
      );
    }
  });

  test("retains the deployed legacy aliases until every target reports readiness", () => {
    for (const name of [
      "by_actor_job_source",
      "by_operation_batch",
      "by_operation",
      "by_actor_export_command",
      "by_actor_operation_command",
    ]) {
      expect(schema).toContain(`.index("${name}"`);
    }
  });
});
