import { prepareAuthEmailMessage } from "../../lib/authEmailHtml";
import { scheduledJobControlKey } from "../../operationalScheduledJobs";
import { assertEdition001EventPayload } from "../../sacredBharatEditionEvents";
import { classifyDocumentPreview, isOfficeDocumentPreview } from "../documentPreviewContract";
import { isDocumentPreviewRolloutAllowed } from "../documentPreviewRollout";
import {
  buildInboundListSearchText,
  type InboundIntentInput,
  validateInboundIntentInput,
} from "./inboundIntentPreparation";
import {
  prepareAiProviderBoundary,
  prepareRazorpayNewOrderBoundary,
} from "./majorCapabilityPreparation";
import { prepareWorkflowNotificationBoundary } from "./notifications";
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
      const prepared = validateInboundIntentInput(input);
      const searchText = buildInboundListSearchText({ ...input, ...prepared });
      if (!searchText.includes(prepared.clientName)) {
        throw new Error("INBOUND_PREPARATION_MISSING_SEARCH_TEXT");
      }
      await recordAll(record, [
        "CRM lead write suppressed; source=Website; contact=redacted",
        "Sales bell suppressed; routing=Sales roles",
        "Sales email suppressed; routing=Sales roles; template=inbound enquiry",
        "Mailbox copy suppressed; routing=information mailbox",
      ]);
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
      await recordAll(record, [
        `Verification email suppressed; recipient=${REDACTED_RECIPIENT}; subject=validated`,
        `Password reset email suppressed; recipient=${REDACTED_RECIPIENT}; subject=validated`,
        `Staff setup email suppressed; recipient=${REDACTED_RECIPIENT}; intent=trusted`,
      ]);
      return;
    }
    case "crm_notifications": {
      const prepared = prepareWorkflowNotificationBoundary({
        bellTargets: { kind: "roles", roles: ["Sales"] },
        content: {
          body: "A production test reached the workflow notification boundary.",
          entityType: "productionTest",
          title: "Production Test notification",
        },
        emailTargets: { kind: "roles", roles: ["Sales"] },
      });
      await recordAll(record, [
        `CRM bell suppressed; routing=${prepared.bellRouting}; control=${prepared.bellControlKey}`,
        `Workflow email suppressed; routing=${prepared.emailRouting}; control=${prepared.emailControlKey}`,
      ]);
      return;
    }
    case "concierge":
    case "journey_planner": {
      const capability = recipe.kind === "concierge" ? "concierge" : "journeyPlanner";
      const prepared = prepareAiProviderBoundary({
        capability,
        maxOutputTokens: 512,
        messages: [{ content: "Redacted production-test prompt", role: "user" }],
        models: ["recording-provider/model"],
        system: `Validated ${capability} production prompt`,
        totalTimeoutMs: 10_000,
      });
      await record(
        `AI provider request suppressed; capability=${prepared.capability}; messages=${prepared.messages.length}; model-candidates=${prepared.models.length}`
      );
      return;
    }
    case "razorpay_new_order": {
      const prepared = prepareRazorpayNewOrderBoundary({
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
      });
      await recordAll(record, [
        `Razorpay new-order request suppressed; currency=${prepared.currency}; amount=positive; receipt=redacted`,
        "Pending booking write suppressed; travelers=1; in-flight completion unchanged",
      ]);
      return;
    }
    case "document_preview": {
      const previewKind = classifyDocumentPreview(
        "production-test.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      if (
        !(
          isOfficeDocumentPreview(previewKind) &&
          isDocumentPreviewRolloutAllowed("commercialFile", previewKind, "all")
        )
      ) {
        throw new Error("DOCUMENT_PREVIEW_PREPARATION_FAILED");
      }
      await recordAll(record, [
        `Preview conversion suppressed; source=authorized fixture; format=${previewKind}`,
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
      await record(
        `Scheduled job execution suppressed; job=${recipe.scheduledJob}; control=${controlKey}; writes=none`
      );
      return;
    }
    default:
      throw new Error("UNKNOWN_PRODUCTION_TEST_RECIPE");
  }
}
