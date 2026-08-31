import { SACRED_BHARAT_EDITION_001 } from "./edition001";

const SACRED_BHARAT_EVENT_NAMES = Object.freeze([
  "edition_started",
  "question_answered",
  "edition_completed",
  "share_clicked",
  "share_link_copied",
  "result_downloaded",
  "journey_cta_clicked",
  "edition_restarted",
]);

const EVENT_NAMES = new Set(SACRED_BHARAT_EVENT_NAMES);
const SHARE_STYLE_IDS = new Set(["archive", "temple-red", "monsoon"]);
const EDITION_ID_PATTERN = /^\d{3}$/;
const HTTPS_URL_PATTERN = /^https:\/\//;
const REVIEW_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const IMAGE_ROOT = "/images/sacred-bharat";
const objectToString = Object.prototype.toString;

function invariant(condition, message) {
  if (!condition) {
    throw new Error(`Invalid Sacred Bharat edition registry: ${message}`);
  }
}

function isNonEmptyString(value) {
  return (
    objectToString.call(value) === "[object String]" &&
    Object.is(value, String(value)) &&
    value.trim().length > 0
  );
}

function validateQuestion(editionId, question, questionIds) {
  invariant(isNonEmptyString(question.id), `${editionId} has a question without an id`);
  invariant(!questionIds.has(question.id), `${editionId} repeats question ${question.id}`);
  questionIds.add(question.id);

  invariant(
    Array.isArray(question.choices) && question.choices.length >= 2,
    `${question.id} needs choices`
  );
  invariant(
    question.choices.every(
      (choice) => isNonEmptyString(choice.id) && isNonEmptyString(choice.label)
    ),
    `${question.id} choices need ids and labels`
  );
  const choiceIds = new Set(question.choices.map((choice) => choice.id));
  invariant(choiceIds.size === question.choices.length, `${question.id} repeats a choice id`);
  invariant(choiceIds.has(question.answer), `${question.id} answer is not an allowlisted choice`);

  invariant(isNonEmptyString(question.image), `${question.id} needs an edition image`);
  invariant(
    question.image.startsWith(`${IMAGE_ROOT}/${editionId}/`) && question.image.endsWith(".webp"),
    `${question.id} image is outside its edition directory`
  );
  invariant(isNonEmptyString(question.imageAlt), `${question.id} needs an image alt`);
  invariant(isNonEmptyString(question.clueAlt), `${question.id} needs a clue-safe alt`);
  invariant(isNonEmptyString(question.prompt), `${question.id} needs a prompt`);
  invariant(isNonEmptyString(question.reveal), `${question.id} needs a reveal`);
  invariant(isNonEmptyString(question.fact), `${question.id} needs a sourced fact`);
  invariant(isNonEmptyString(question.location), `${question.id} needs a location`);
  invariant(isNonEmptyString(question.region), `${question.id} needs a region`);
  invariant(isNonEmptyString(question.theme), `${question.id} needs a theme`);
  invariant(
    question.clueAlt !== question.imageAlt,
    `${question.id} must separate clue and reveal alt`
  );
  invariant(
    HTTPS_URL_PATTERN.test(question.factSource),
    `${question.id} needs an HTTPS fact source`
  );
  invariant(isNonEmptyString(question.credit?.author), `${question.id} needs an image creator`);
  invariant(isNonEmptyString(question.credit?.license), `${question.id} needs an image licence`);
  invariant(
    HTTPS_URL_PATTERN.test(question.credit?.source),
    `${question.id} needs an HTTPS image source`
  );
  invariant(question.asset?.format === "webp", `${question.id} derivative must be WebP`);
  invariant(
    question.asset?.crop?.width > 0 && question.asset?.crop?.height > 0,
    `${question.id} needs bounded crop dimensions`
  );
  invariant(
    question.asset.crop.width * 5 === question.asset.crop.height * 4,
    `${question.id} crop must use the reviewed 4:5 contract`
  );
  invariant(
    JSON.stringify(question.asset.transformations) === JSON.stringify(["crop", "webp"]),
    `${question.id} may only record crop and WebP conversion`
  );
}

export function validateSacredBharatEdition(edition) {
  invariant(EDITION_ID_PATTERN.test(edition?.edition), "edition ids must be three digits");
  invariant(
    edition.publication?.status === "published" || edition.publication?.status === "archived",
    `${edition.edition} needs an explicit publication status`
  );
  invariant(
    REVIEW_DATE_PATTERN.test(edition.publication.reviewedOn),
    `${edition.edition} needs a review date`
  );
  invariant(
    isNonEmptyString(edition.operationalControlKey),
    `${edition.edition} needs a control key`
  );
  invariant(isNonEmptyString(edition.title), `${edition.edition} needs a title`);
  invariant(isNonEmptyString(edition.eyebrow), `${edition.edition} needs an eyebrow`);
  invariant(
    isNonEmptyString(edition.cta?.body) &&
      isNonEmptyString(edition.cta?.href) &&
      edition.cta.href.startsWith("/") &&
      isNonEmptyString(edition.cta?.label),
    `${edition.edition} needs a local journey CTA`
  );
  invariant(
    isNonEmptyString(edition.contentRecord?.revision) &&
      REVIEW_DATE_PATTERN.test(edition.contentRecord?.lastReviewedOn) &&
      Array.isArray(edition.contentRecord?.changes) &&
      Array.isArray(edition.contentRecord?.corrections),
    `${edition.edition} needs a dated content record`
  );
  invariant(
    [...edition.contentRecord.changes, ...edition.contentRecord.corrections].every(
      (change) => REVIEW_DATE_PATTERN.test(change.date) && isNonEmptyString(change.summary)
    ),
    `${edition.edition} content record entries need dates and summaries`
  );
  invariant(
    Array.isArray(edition.questions) && edition.questions.length === 5,
    `${edition.edition} must contain five questions`
  );

  const questionIds = new Set();
  for (const question of edition.questions) {
    validateQuestion(edition.edition, question, questionIds);
  }

  const shareQuestion = edition.questions.find(
    (question) => question.image === edition.share?.image
  );
  invariant(shareQuestion, `${edition.edition} share image must be a reviewed edition asset`);
  invariant(
    shareQuestion?.credit?.license === "CC0 1.0",
    `${edition.edition} share image must be CC0`
  );
  invariant(
    edition.share.credit === `${shareQuestion.credit.author} / CC0`,
    `${edition.edition} share credit must match its CC0 asset`
  );

  const eventNames = edition.eventPolicy?.events;
  invariant(
    Array.isArray(eventNames) && eventNames.length > 0,
    `${edition.edition} needs an event allowlist`
  );
  invariant(new Set(eventNames).size === eventNames.length, `${edition.edition} repeats an event`);
  invariant(
    eventNames.length === EVENT_NAMES.size && eventNames.every((event) => EVENT_NAMES.has(event)),
    `${edition.edition} event policy must match the reviewed client vocabulary`
  );
  invariant(
    Array.isArray(edition.eventPolicy.shareStyles) && edition.eventPolicy.shareStyles.length > 0,
    `${edition.edition} needs share styles`
  );
  invariant(
    new Set(edition.eventPolicy.shareStyles).size === edition.eventPolicy.shareStyles.length &&
      edition.eventPolicy.shareStyles.length === SHARE_STYLE_IDS.size &&
      edition.eventPolicy.shareStyles.every((style) => SHARE_STYLE_IDS.has(style)),
    `${edition.edition} share styles must match the reviewed renderer vocabulary`
  );
  invariant(isNonEmptyString(edition.metadata?.title), `${edition.edition} needs a metadata title`);
  invariant(
    isNonEmptyString(edition.metadata?.description),
    `${edition.edition} needs metadata copy`
  );
  invariant(
    isNonEmptyString(edition.metadata?.imageAlt),
    `${edition.edition} needs metadata image alt`
  );
  return edition;
}

export function createSacredBharatEditionRegistry({
  activeEditionId,
  editions,
  legacyUnversionedShareEditionId,
}) {
  invariant(Array.isArray(editions) && editions.length > 0, "at least one edition is required");
  const editionsById = new Map();
  for (const edition of editions) {
    validateSacredBharatEdition(edition);
    invariant(!editionsById.has(edition.edition), `edition ${edition.edition} is registered twice`);
    editionsById.set(edition.edition, edition);
  }
  invariant(
    editionsById.has(activeEditionId),
    `active edition ${activeEditionId} is not registered`
  );
  invariant(
    editionsById.get(activeEditionId).publication.status === "published",
    `active edition ${activeEditionId} is not published`
  );
  invariant(
    editionsById.has(legacyUnversionedShareEditionId),
    `legacy share edition ${legacyUnversionedShareEditionId} is not registered`
  );
  return Object.freeze({
    activeEditionId,
    editions: Object.freeze([...editions]),
    legacyUnversionedShareEditionId,
  });
}

export const SACRED_BHARAT_EDITION_REGISTRY = createSacredBharatEditionRegistry({
  activeEditionId: "001",
  editions: [SACRED_BHARAT_EDITION_001],
  legacyUnversionedShareEditionId: "001",
});

export function getSacredBharatEdition(editionId, registry = SACRED_BHARAT_EDITION_REGISTRY) {
  return registry.editions.find((edition) => edition.edition === editionId) ?? null;
}

/**
 * @param {{ hasLegacyShareToken?: boolean; requestedEditionId?: string }} [selection]
 * @param {ReturnType<typeof createSacredBharatEditionRegistry>} [registry]
 */
export function resolveSacredBharatEdition(
  selection = {},
  registry = SACRED_BHARAT_EDITION_REGISTRY
) {
  const { hasLegacyShareToken = false, requestedEditionId } = selection;
  if (requestedEditionId !== undefined) {
    return getSacredBharatEdition(requestedEditionId, registry);
  }
  const editionId = hasLegacyShareToken
    ? registry.legacyUnversionedShareEditionId
    : registry.activeEditionId;
  return getSacredBharatEdition(editionId, registry);
}

export function isAllowedSacredBharatEventEnvelope(
  body,
  registry = SACRED_BHARAT_EDITION_REGISTRY
) {
  const edition = getSacredBharatEdition(body?.edition, registry);
  if (!edition?.eventPolicy.events.includes(body.event)) {
    return false;
  }
  if (
    body.questionId !== undefined &&
    !edition.questions.some(({ id }) => id === body.questionId)
  ) {
    return false;
  }
  if (body.style !== undefined && !edition.eventPolicy.shareStyles.includes(body.style)) {
    return false;
  }
  return !(
    body.score !== undefined &&
    (!Number.isInteger(body.score) || body.score < 0 || body.score > edition.questions.length)
  );
}
