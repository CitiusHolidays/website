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
        clientName: "Production Test Contact",
        consent: true,
        contactEmail: "recording-boundary@example.invalid",
        destination: "Kolkata",
        paxCount: 2,
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
      const executeDelivery = async (
        controlKey: AuthEmailControlKey,
        purpose: AuthEmailPurpose,
        label: string,
        message: typeof verification
      ) => {
        let outcome: AuthEmailDeliveryOutcome | null = null;
        await executeAuthEmailDeliveryOrchestration(
          {
            controlKey,
            correlationSecret: `${controlKey}:recording-correlation`,
            deliveryConfig: { maxAttempts: 1, minIntervalMs: 0 },
            expiresAt: Date.now() + 60_000,
            html: message.html,
            purpose,
            recipient: "recording-boundary@example.invalid",
            subject: message.subject,
            text: message.text,
          },
          {
            getOutcome: () => Promise.resolve(outcome),
            now: Date.now,
            providerConfigured: true,
            recordStatus: async (statusInput, event) => {
              outcome = {
                attempts: event.attempts,
                correlationDigest: statusInput.correlationDigest,
                expiresAt: statusInput.expiresAt,
                purpose: statusInput.purpose,
                status: event.status,
                updatedAt: Date.now(),
              };
              await record(`Auth delivery status isolated; kind=${label}; status=${event.status}`);
              return outcome;
            },
            resolveControl: async (resolvedKey) => {
              await record(`Auth routing validated; kind=${label}; control=${resolvedKey}`);
              return true;
            },
            sendEmail: async () => {
              await record(
                `${label} email suppressed; recipient=${REDACTED_RECIPIENT}; subject=validated`
              );
              return { error: null };
            },
          }
        );
      };
      await executeDelivery(
        "email.auth.verification",
        "verification",
        "Verification",
        verification
      );
      await executeDelivery("email.auth.password_reset", "password_reset", "Password reset", reset);
      await executeDelivery("email.auth.staff_setup", "password_reset", "Staff setup", reset);
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
