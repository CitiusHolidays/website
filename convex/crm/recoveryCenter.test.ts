import { describe, expect, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import { OPERATION_STALL_THRESHOLD_MS } from "./operationTimePolicy";
import {
  projectJobCardDeletionRecoveryItem,
  projectPassengerExportRecoveryItem,
  projectPassengerImportRecoveryItem,
  projectPassportCleanupRecoveryItem,
  projectWorkflowNudgeRecoveryItem,
  recoveryAgeMs,
  recoveryFreshness,
} from "./recoveryCenter";
import { WORKFLOW_NUDGE_MAX_RETRIES, WORKFLOW_NUDGE_STALE_MS } from "./workflowNudgeRun";

const REFERENCE_NOW = Date.parse("2026-08-30T16:00:00.000Z");
const PRIVATE_PASSPORT_METADATA_PATTERN =
  /Sentinel Traveller|passport\.pdf|storage_secret|token_digest|content_digest/i;

describe("Recovery Center projection", () => {
  test("projects only partial or stale imports without offering an unsafe source-free retry", () => {
    const partial = projectPassengerImportRecoveryItem(
      fromAny({
        _id: "import_partial",
        jobCardId: "job_1",
        remaining: 3,
        status: "partial",
        total: 10,
        updatedAt: REFERENCE_NOW - 90_000,
      }),
      "JC-1001",
      REFERENCE_NOW
    );
    expect(partial).toMatchObject({
      ageMs: 90_000,
      freshness: "recent",
      href: "/portal/job-cards/job_1",
      owner: { kind: "initiator" },
      readiness: "source_required",
      source: "passenger_import",
      status: "partial",
    });
    expect(partial).not.toHaveProperty("retry");

    expect(
      projectPassengerImportRecoveryItem(
        fromAny({
          _id: "import_complete",
          jobCardId: "job_1",
          remaining: 0,
          status: "completed",
          total: 10,
          updatedAt: REFERENCE_NOW - 90_000,
        }),
        "JC-1001",
        REFERENCE_NOW
      )
    ).toBeNull();
  });

  test("uses the deterministic operation clock at the exact stale boundary", () => {
    const running = fromAny({
      _id: "import_running",
      jobCardId: "job_1",
      remaining: 5,
      status: "running",
      total: 10,
      updatedAt: REFERENCE_NOW - OPERATION_STALL_THRESHOLD_MS,
    });
    expect(projectPassengerImportRecoveryItem(running, "JC-1001", REFERENCE_NOW)).toBeNull();
    expect(projectPassengerImportRecoveryItem(running, "JC-1001", REFERENCE_NOW + 1)).toMatchObject(
      { freshness: "aged", status: "stale" }
    );
    expect(recoveryAgeMs(REFERENCE_NOW + 1, REFERENCE_NOW)).toBe(0);
    expect(recoveryFreshness(REFERENCE_NOW - OPERATION_STALL_THRESHOLD_MS, REFERENCE_NOW)).toBe(
      "recent"
    );
    expect(recoveryFreshness(REFERENCE_NOW - OPERATION_STALL_THRESHOLD_MS - 1, REFERENCE_NOW)).toBe(
      "aged"
    );
  });

  test("preserves the exact export command only for a replay-safe failed or stale export", () => {
    const operation = fromAny({
      _id: "export_failed",
      commandId: "018fbe7a-62c8-7f35-9d2f-2d3f53f9e111",
      exportKind: "traveller",
      jobCardId: "job_1",
      rowsProcessed: 40,
      status: "failed",
      updatedAt: REFERENCE_NOW - 30_000,
    });
    const failed = projectPassengerExportRecoveryItem(operation, "JC-1001", REFERENCE_NOW);
    expect(failed).toMatchObject({
      readiness: "retry_available",
      retry: {
        commandId: "018fbe7a-62c8-7f35-9d2f-2d3f53f9e111",
        exportKind: "traveller",
        jobCardId: "job_1",
        kind: "passenger_export",
      },
      status: "retryable",
    });
    expect(projectPassengerExportRecoveryItem(operation, "JC-1001", REFERENCE_NOW)?.retry).toEqual(
      failed?.retry
    );

    const legacyUnsafe = projectPassengerExportRecoveryItem(
      fromAny({
        ...operation,
        _id: "export_legacy",
        commandId: "legacy-command",
      }),
      "JC-1001",
      REFERENCE_NOW
    );
    expect(legacyUnsafe).toMatchObject({ readiness: "manual_review", status: "failed" });
    expect(legacyUnsafe).not.toHaveProperty("retry");

    expect(
      projectPassengerExportRecoveryItem(
        fromAny({
          _id: "export_complete",
          commandId: "018fbe7a-62c8-7f35-9d2f-2d3f53f9e112",
          exportKind: "traveller",
          jobCardId: "job_1",
          rowsProcessed: 40,
          status: "completed",
          updatedAt: REFERENCE_NOW - 30_000,
        }),
        "JC-1001",
        REFERENCE_NOW
      )
    ).toBeNull();
  });

  test("keeps deletion cleanup read-only and removes workflow retry after exhaustion", () => {
    const deletion = projectJobCardDeletionRecoveryItem(
      fromAny({
        _id: "deletion_failed",
        deletedCount: 12,
        jobCode: "JC-1002",
        lastProgressAt: REFERENCE_NOW - 60_000,
        status: "failed",
      }),
      REFERENCE_NOW
    );
    expect(deletion).toMatchObject({
      href: "/portal/job-cards#deletion-status",
      readiness: "manual_review",
      status: "failed",
    });
    expect(deletion).not.toHaveProperty("retry");

    const exhausted = projectWorkflowNudgeRecoveryItem(
      fromAny({
        _id: "workflow_exhausted",
        checked: 50,
        retryCount: WORKFLOW_NUDGE_MAX_RETRIES,
        sent: 4,
        status: "failed",
        updatedAt: REFERENCE_NOW - 60_000,
      }),
      REFERENCE_NOW
    );
    expect(exhausted).toMatchObject({ readiness: "retry_exhausted", status: "exhausted" });
    expect(exhausted).not.toHaveProperty("retry");
  });

  test("projects only privacy-safe Passport cleanup state with a revision-bound retry", () => {
    const retryable = projectPassportCleanupRecoveryItem({
      failureCode: "cleanup_failed",
      jobCardId: fromAny("job_1"),
      referenceNow: REFERENCE_NOW,
      residualPresent: true,
      source: "passport_upload_cleanup",
      ticketId: fromAny("ticket_1"),
      updatedAt: REFERENCE_NOW - 45_000,
    });
    expect(retryable).toMatchObject({
      href: "/portal/passport?jc=job_1",
      owner: { kind: "passport_operations", label: "Passport operations" },
      readiness: "retry_available",
      retry: {
        expectedUpdatedAt: REFERENCE_NOW - 45_000,
        kind: "passport_upload_cleanup",
        ticketId: "ticket_1",
      },
      status: "retryable",
      summary: "Passport upload cleanup did not finish. A replay-safe retry is available.",
    });
    expect(JSON.stringify(retryable)).not.toMatch(PRIVATE_PASSPORT_METADATA_PATTERN);

    const referenced = projectPassportCleanupRecoveryItem({
      cleanupRecordId: fromAny("cleanup_1"),
      failureCode: "storage_referenced",
      jobCardId: fromAny("job_1"),
      referenceNow: REFERENCE_NOW,
      residualPresent: true,
      source: "passport_encrypted_cleanup",
      ticketId: fromAny("ticket_1"),
      updatedAt: REFERENCE_NOW - 60_000,
    });
    expect(referenced).toMatchObject({
      readiness: "manual_review",
      status: "failed",
      summary:
        "Encrypted passport cleanup is blocked by an active storage reference and needs manual review.",
    });
    expect(referenced).not.toHaveProperty("retry");

    expect(
      projectPassportCleanupRecoveryItem({
        failureCode: "cleanup_failed",
        jobCardId: fromAny("job_1"),
        referenceNow: REFERENCE_NOW,
        residualPresent: false,
        source: "passport_upload_cleanup",
        ticketId: fromAny("ticket_1"),
        updatedAt: REFERENCE_NOW - 45_000,
      })
    ).toBeNull();
  });

  test("uses the workflow-owned stale window without exposing a generic retry", () => {
    const running = fromAny({
      _id: "workflow_stale",
      checked: 20,
      retryCount: 1,
      sent: 2,
      status: "running",
      updatedAt: REFERENCE_NOW - WORKFLOW_NUDGE_STALE_MS,
    });
    expect(projectWorkflowNudgeRecoveryItem(running, REFERENCE_NOW)).toMatchObject({
      readiness: "manual_review",
      status: "stale",
    });
    expect(projectWorkflowNudgeRecoveryItem(running, REFERENCE_NOW)).not.toHaveProperty("retry");
  });
});
