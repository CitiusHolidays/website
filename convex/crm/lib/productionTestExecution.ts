import {
  type AuthEmailControlKey,
  type AuthEmailDeliveryOutcome,
  type AuthEmailPurpose,
  executeAuthEmailDeliveryOrchestration,
} from "../../lib/authEmailDelivery";
import { prepareAuthEmailMessage } from "../../lib/authEmailHtml";
import {
  executeScheduledJobBoundary,
  scheduledJobControlKey,
} from "../../operationalScheduledJobs";
import { assertEdition001EventPayload } from "../../sacredBharatEditionEvents";
import { planDocumentPreviewPreparation } from "../documentPreviewLifecycle";
import { isDocumentPreviewRolloutAllowed } from "../documentPreviewRollout";
import { deliverNotificationEmailsSequentially } from "../notificationEmailDelivery";
import {
  executeInboundIntentOrchestration,
  type InboundIntentInput,
} from "./inboundIntentPreparation";
import {
  executeAiProviderOrchestration,
  executeRazorpayNewOrderOrchestration,
} from "./majorCapabilityPreparation";
import {
  prepareWorkflowNotificationBoundary,
  type WorkflowNotificationPlan,
  workflowRoleEmailRecipientAddresses,
} from "./notifications";
import type { ProductionTestRecipe } from "./productionTestRecipes";

export type RecordProductionTestEffect = (description: string) => Promise<void>;

const REDACTED_RECIPIENT = "recipient-class";
const COMMUNICATION_REHEARSAL_SCENARIOS = [
  "success",
  "rate_limit_then_success",
  "provider_unavailable_exhausted",
  "receipt_write_failure",
] as const;
type CommunicationRehearsalScenario = (typeof COMMUNICATION_REHEARSAL_SCENARIOS)[number];

function expectedScenarioStatuses(scenario: CommunicationRehearsalScenario) {
  switch (scenario) {
    case "success":
      return ["queued", "sending", "sent"];
    case "rate_limit_then_success":
      return ["queued", "sending", "retrying", "sending", "sent"];
    case "provider_unavailable_exhausted":
      return ["queued", "sending", "retrying", "sending", "exhausted"];
    case "receipt_write_failure":
      return [];
    default:
      throw new Error("UNKNOWN_COMMUNICATION_REHEARSAL_SCENARIO");
  }
}

function assertScenarioStatuses(
  scenario: CommunicationRehearsalScenario,
  statuses: string[],
  providerCalls: number,
  idempotencyKeys: string[]
) {
  const expected = expectedScenarioStatuses(scenario);
  if (JSON.stringify(statuses) !== JSON.stringify(expected)) {
    throw new Error("COMMUNICATION_REHEARSAL_STATUS_MISMATCH");
  }
  let expectedCalls = 2;
  if (scenario === "receipt_write_failure") {
    expectedCalls = 0;
  } else if (scenario === "success") {
    expectedCalls = 1;
  }
  const uniqueKeys = new Set(idempotencyKeys);
  if (
    providerCalls !== expectedCalls ||
    idempotencyKeys.length !== expectedCalls ||
    uniqueKeys.size !== (expectedCalls === 0 ? 0 : 1)
  ) {
    throw new Error("COMMUNICATION_REHEARSAL_IDEMPOTENCY_MISMATCH");
  }
}

function scenarioProviderResult(scenario: CommunicationRehearsalScenario, providerCalls: number) {
  if (scenario === "rate_limit_then_success" && providerCalls === 1) {
    return { error: { name: "rate_limit_exceeded", statusCode: 429 } };
  }
  if (scenario === "provider_unavailable_exhausted") {
    return { error: { name: "provider_unavailable", statusCode: 503 } };
  }
  return { error: null };
}

function isExpectedReceiptFailure(error: Error | null, scenario: CommunicationRehearsalScenario) {
  return (
    scenario === "receipt_write_failure" &&
    error !== null &&
    error.message === "RECORDING_RECEIPT_WRITE_FAILED"
  );
}

function scenarioDeliveryConfig(scenario: CommunicationRehearsalScenario) {
  return { maxAttempts: scenario === "success" ? 1 : 2, minIntervalMs: 0 };
}

async function rehearseAuthEmailScenario(
  input: {
    controlKey: AuthEmailControlKey;
    label: string;
    message: { html: string; subject: string; text: string };
    purpose: AuthEmailPurpose;
  },
  scenario: CommunicationRehearsalScenario,
  record: RecordProductionTestEffect
) {
  let outcome: AuthEmailDeliveryOutcome | null = null;
  let providerCalls = 0;
  let expectedReceiptFailure = false;
  const idempotencyKeys: string[] = [];
  const statuses: string[] = [];
  try {
    await executeAuthEmailDeliveryOrchestration(
      {
        controlKey: input.controlKey,
        correlationSecret: `${input.controlKey}:${scenario}:recording-correlation`,
        deliveryConfig: scenarioDeliveryConfig(scenario),
        expiresAt: Date.now() + 60_000,
        html: input.message.html,
        purpose: input.purpose,
        recipient: "recording-boundary@example.invalid",
        subject: input.message.subject,
        text: input.message.text,
      },
      {
        getOutcome: () => Promise.resolve(outcome),
        now: Date.now,
        providerConfigured: true,
        recordStatus: (statusInput, event) => {
          if (scenario === "receipt_write_failure") {
            return Promise.reject(new Error("RECORDING_RECEIPT_WRITE_FAILED"));
          }
          statuses.push(event.status);
          outcome = {
            attempts: event.attempts,
            correlationDigest: statusInput.correlationDigest,
            expiresAt: statusInput.expiresAt,
            purpose: statusInput.purpose,
            status: event.status,
            updatedAt: Date.now(),
          };
          return Promise.resolve(outcome);
        },
        resolveControl: () => Promise.resolve(true),
        sendEmail: (delivery) => {
          providerCalls += 1;
          idempotencyKeys.push(delivery.idempotencyKey);
          return Promise.resolve(scenarioProviderResult(scenario, providerCalls));
        },
      }
    );
  } catch (error) {
    if (isExpectedReceiptFailure(error instanceof Error ? error : null, scenario)) {
      expectedReceiptFailure = true;
    } else {
      throw error;
    }
  }
  if (scenario === "receipt_write_failure" && !expectedReceiptFailure) {
    throw new Error("COMMUNICATION_REHEARSAL_RECEIPT_FAILURE_MISSING");
  }
  assertScenarioStatuses(scenario, statuses, providerCalls, idempotencyKeys);
  await record(
    `Auth delivery recording substitute rehearsed; kind=${input.label}; scenario=${scenario}; statuses=${statuses.join(">") || "receipt-write-blocked"}; stable-idempotency=yes; provider-calls=${providerCalls}; recipient=${REDACTED_RECIPIENT}`
  );
}

async function rehearseCrmEmailScenario(
  scenario: CommunicationRehearsalScenario,
  record: RecordProductionTestEffect
) {
  let providerCalls = 0;
  let expectedReceiptFailure = false;
  const idempotencyKeys: string[] = [];
  const statuses: string[] = [];
  try {
    await deliverNotificationEmailsSequentially({
      config: scenarioDeliveryConfig(scenario),
      eventId: `production-test/${scenario}`,
      message: {
        from: "Citius Travel <noreply@notifications.citiustravel.com>",
        html: "<p>Recorded workflow boundary</p>",
        subject: "Recorded workflow boundary",
        text: "Recorded workflow boundary",
      },
      onStatus: (event) => {
        if (scenario === "receipt_write_failure") {
          return Promise.reject(new Error("RECORDING_RECEIPT_WRITE_FAILED"));
        }
        statuses.push(event.status);
        return Promise.resolve();
      },
      recipients: ["recording-boundary@example.invalid"],
      sendEmail: (_message, options) => {
        providerCalls += 1;
        idempotencyKeys.push(options.idempotencyKey);
        return Promise.resolve(scenarioProviderResult(scenario, providerCalls));
      },
    });
  } catch (error) {
    if (isExpectedReceiptFailure(error instanceof Error ? error : null, scenario)) {
      expectedReceiptFailure = true;
    } else {
      throw error;
    }
  }
  if (scenario === "receipt_write_failure" && !expectedReceiptFailure) {
    throw new Error("COMMUNICATION_REHEARSAL_RECEIPT_FAILURE_MISSING");
  }
  assertScenarioStatuses(scenario, statuses, providerCalls, idempotencyKeys);
  await record(
    `CRM email delivery recording substitute rehearsed; scenario=${scenario}; statuses=${statuses.join(">") || "receipt-write-blocked"}; stable-idempotency=yes; provider-calls=${providerCalls}; recipient=${REDACTED_RECIPIENT}`
  );
}

async function recordAll(record: RecordProductionTestEffect, descriptions: readonly string[]) {
  await Promise.all(descriptions.map(record));
}

export async function executeProductionTestRecipe(
  recipe: ProductionTestRecipe,
  record: RecordProductionTestEffect
) {
  switch (recipe.kind) {
    case "inbound_leads": {
      const input: InboundIntentInput = {
        brief: { destination: "Kolkata", paxCount: 2 },
        clientName: "Production Test Contact",
        consent: true,
        contactEmail: "recording-boundary@example.invalid",
        source: "Website",
        submissionKeyHash: "a".repeat(64),
      };
      await executeInboundIntentOrchestration(input, Date.now(), {
        persistIntent: async (prepared) => {
          if (!prepared.listSearchText.includes(prepared.clientName)) {
            throw new Error("INBOUND_PREPARATION_MISSING_SEARCH_TEXT");
          }
          await record("CRM lead and handoff writes suppressed; source=Website; contact=redacted");
          return "recorded-inbound-intent";
        },
        publishNotification: async (plan) => {
          await recordAll(record, [
            `Sales bell suppressed; routing=${plan.recipientRoles.join("+")}`,
            `Sales email suppressed; routing=${plan.recipientRoles.join("+")}; template=${plan.title}`,
            `Mailbox copy suppressed; recipients=${plan.additionalEmailRecipients.length}; address=redacted`,
          ]);
          return { recorded: true };
        },
        recordCreatedIntent: async () => {
          await record("CRM intake effect receipt suppressed; evidence=Production Test Lab only");
        },
      });
      return;
    }
    case "auth_email": {
      const verification = prepareAuthEmailMessage({
        ctaHref: "https://example.invalid/auth/verify",
        greetingName: "Account owner",
        purpose: "verification",
      });
      const reset = prepareAuthEmailMessage({
        ctaHref: "https://example.invalid/auth/reset",
        greetingName: "Account owner",
        purpose: "password_reset",
      });
      if (!(verification.html.includes("Verify email") && reset.html.includes("Reset password"))) {
        throw new Error("AUTH_TEMPLATE_PREPARATION_FAILED");
      }
      const rehearsals = [
        {
          controlKey: "email.auth.verification" as const,
          label: "Verification",
          message: verification,
          purpose: "verification" as const,
        },
        {
          controlKey: "email.auth.password_reset" as const,
          label: "Password reset",
          message: reset,
          purpose: "password_reset" as const,
        },
        {
          controlKey: "email.auth.staff_setup" as const,
          label: "Staff setup",
          message: reset,
          purpose: "password_reset" as const,
        },
      ];
      await Promise.all(
        rehearsals.flatMap((rehearsal) =>
          COMMUNICATION_REHEARSAL_SCENARIOS.map(
            async (scenario) => await rehearseAuthEmailScenario(rehearsal, scenario, record)
          )
        )
      );
      return;
    }
    case "crm_notifications": {
      const recipientRoles = ["Sales"];
      const plan: WorkflowNotificationPlan = {
        bellTargets: { kind: "roles", roles: recipientRoles },
        content: {
          body: "A production test reached the workflow notification boundary.",
          entityType: "productionTest",
          title: "Production Test notification",
        },
        emailTargets: { kind: "roles", roles: recipientRoles },
      };
      const prepared = prepareWorkflowNotificationBoundary(plan);
      const emailRecipients = workflowRoleEmailRecipientAddresses(
        [
          {
            active: true,
            email: "sales-recording@example.invalid",
            roles: ["Sales"],
          },
          {
            active: true,
            email: "sales-head-recording@example.invalid",
            roles: ["Sales Head"],
          },
          {
            active: false,
            email: "inactive-recording@example.invalid",
            roles: ["Sales"],
          },
        ],
        recipientRoles
      );
      await recordAll(record, [
        `CRM bell suppressed; routing=${prepared.bellRouting}; control=${prepared.bellControlKey}`,
        `Workflow email suppressed; routing=${prepared.emailRouting}; recipients=${emailRecipients.length}; control=${prepared.emailControlKey}`,
      ]);
      await Promise.all(
        COMMUNICATION_REHEARSAL_SCENARIOS.map(
          async (scenario) => await rehearseCrmEmailScenario(scenario, record)
        )
      );
      return;
    }
    case "concierge":
    case "journey_planner": {
      const capability = recipe.kind === "concierge" ? "concierge" : "journeyPlanner";
      await executeAiProviderOrchestration(
        {
          capability,
          maxOutputTokens: 512,
          messages: [{ content: "Redacted production-test prompt", role: "user" }],
          models: ["recording-provider/model"],
          system: `Validated ${capability} production prompt`,
          totalTimeoutMs: 10_000,
        },
        async (prepared) => {
          await record(
            `AI provider request suppressed; capability=${prepared.capability}; messages=${prepared.messages.length}; model-candidates=${prepared.models.length}`
          );
          return { recorded: true };
        }
      );
      return;
    }
    case "razorpay_new_order": {
      await executeRazorpayNewOrderOrchestration<{ id: string }, { id: string }>(
        {
          checkout: {
            totalAmount: 125_000,
            trip: { id: "trip-redacted", name: "Recorded itinerary" },
            user: {
              email: "recording-boundary@example.invalid",
              id: "account-redacted",
              name: "Account owner",
            },
          },
          currency: "INR",
          receipt: "rcpt_recording1234",
          travelers: 1,
        },
        {
          createPendingBooking: async (providerOrder) => {
            await record(
              `Pending booking write suppressed; provider-order=${providerOrder.id}; travelers=1; in-flight completion unchanged`
            );
            return { id: "recorded-booking" };
          },
          createProviderOrder: async (prepared) => {
            await record(
              `Razorpay new-order request suppressed; currency=${prepared.currency}; amount=positive; receipt=redacted`
            );
            return { id: "recorded-provider-order" };
          },
        }
      );
      return;
    }
    case "document_preview": {
      const preparation = planDocumentPreviewPreparation({
        existing: null,
        fileName: "production-test.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        retryUnavailable: false,
        sourceStorageIdentity: "recorded-source",
      });
      if (
        preparation.operation !== "create" ||
        !isDocumentPreviewRolloutAllowed("commercialFile", preparation.previewKind, "all")
      ) {
        throw new Error("DOCUMENT_PREVIEW_PREPARATION_FAILED");
      }
      await recordAll(record, [
        `Preview conversion suppressed; source=authorized fixture; format=${preparation.previewKind}; operation=${preparation.operation}`,
        "Preview operation and artifact writes suppressed; content=redacted",
      ]);
      return;
    }
    case "sacred_bharat_publication": {
      assertEdition001EventPayload({ event: "edition_restarted" });
      await recordAll(record, [
        "Sacred Bharat / 001 event write suppressed; payload=validated",
        "Player activity and aggregate writes suppressed",
      ]);
      return;
    }
    case "scheduled_job": {
      if (!recipe.scheduledJob) {
        throw new Error("SCHEDULED_JOB_SELECTION_REQUIRED");
      }
      const controlKey = scheduledJobControlKey(recipe.scheduledJob);
      await executeScheduledJobBoundary(recipe.scheduledJob, async (target) => {
        await record(
          `Scheduled job execution suppressed; job=${target.job}; mutation=${target.mutationName}; control=${controlKey}; writes=none`
        );
      });
      return;
    }
    default:
      throw new Error("UNKNOWN_PRODUCTION_TEST_RECIPE");
  }
}
