const MONEY_READINESS_LABELS = {
  awaiting_payment: "Awaiting payment",
  not_started: "Payment setup not started",
  partially_outstanding: "Partially outstanding",
  ready: "Payment ready",
  review_required: "Payment needs Finance review",
};

export function buildJobCardCommandCenter(payload = {}) {
  const moneyReadiness = payload.money?.readiness ?? "not_started";
  return {
    actions: payload.actions ?? [],
    blockers: payload.blockers ?? [],
    money: {
      exact: payload.money?.exact ?? null,
      label: MONEY_READINESS_LABELS[moneyReadiness] ?? "Payment status unavailable",
      readiness: moneyReadiness,
    },
    openingEvidence: payload.openingEvidence ?? {
      current: { variances: [] },
      status: "unknown",
      variances: [],
    },
    readinessSections: payload.readiness ?? [],
  };
}
