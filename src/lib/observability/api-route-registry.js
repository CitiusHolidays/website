const ROUTE_DEFINITIONS = {
  "/api/account/confirmed-trips": {
    family: "account",
    methods: ["GET"],
    responseMode: "json",
  },
  "/api/account/journeys/[bookingId]": {
    family: "account",
    methods: ["GET"],
    responseMode: "json",
  },
  "/api/auth/[...all]": {
    family: "auth",
    methods: ["GET", "POST"],
    responseMode: "delegated",
  },
  "/api/chat": {
    family: "ai",
    methods: ["POST"],
    responseMode: "stream",
  },
  "/api/contact": {
    family: "contact",
    methods: ["POST"],
    responseMode: "json",
  },
  "/api/create-order": {
    family: "payments",
    methods: ["OPTIONS", "POST"],
    responseMode: "json",
  },
  "/api/e2e/identity": {
    family: "e2e",
    methods: ["GET"],
    responseMode: "json",
  },
  "/api/inbound-intents": {
    family: "inbound",
    methods: ["POST"],
    responseMode: "json",
  },
  "/api/portal/exports/[operationId]": {
    family: "staff-files",
    methods: ["GET"],
    responseMode: "binary",
  },
  "/api/portal/files/commercial/[fileId]": {
    family: "staff-files",
    methods: ["GET"],
    responseMode: "binary",
  },
  "/api/portal/files/expense/[attachmentId]": {
    family: "staff-files",
    methods: ["GET"],
    responseMode: "binary",
  },
  "/api/portal/files/passport/[travellerId]": {
    family: "staff-files",
    methods: ["GET"],
    responseMode: "binary",
  },
  "/api/portal/files/proposal-finalized/[proposalId]": {
    family: "staff-files",
    methods: ["GET"],
    responseMode: "binary",
  },
  "/api/portal/files/proposal/[attachmentId]": {
    family: "staff-files",
    methods: ["GET"],
    responseMode: "binary",
  },
  "/api/portal/files/query/[attachmentId]": {
    family: "staff-files",
    methods: ["GET"],
    responseMode: "binary",
  },
  "/api/profile": {
    family: "account",
    methods: ["PUT"],
    responseMode: "json",
  },
  "/api/revalidate": {
    family: "content",
    methods: ["POST"],
    responseMode: "json",
  },
  "/api/sacred-bharat/events": {
    family: "engagement",
    methods: ["POST"],
    responseMode: "json",
  },
  "/api/sacred-bharat/journey-planner": {
    family: "ai",
    methods: ["POST"],
    responseMode: "stream",
  },
  "/api/verify-payment": {
    family: "payments",
    methods: ["POST"],
    responseMode: "json",
  },
  "/api/webhooks/razorpay": {
    family: "payments",
    methods: ["POST"],
    responseMode: "json",
  },
};

export const API_ROUTE_OBSERVABILITY = Object.freeze(
  Object.fromEntries(
    Object.entries(ROUTE_DEFINITIONS).map(([route, definition]) => [
      route,
      Object.freeze({
        ...definition,
        methods: Object.freeze([...definition.methods]),
      }),
    ])
  )
);

export function getApiRouteObservability(route, method) {
  const definition = API_ROUTE_OBSERVABILITY[route];
  if (!definition) {
    throw new Error(`Unregistered API observability route: ${route}`);
  }
  const normalizedMethod = String(method || "").toUpperCase();
  if (!definition.methods.includes(normalizedMethod)) {
    throw new Error(`Unregistered API observability method: ${normalizedMethod || "missing"}`);
  }
  return { ...definition, method: normalizedMethod, route };
}
