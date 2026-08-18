import { jsonSchema, tool } from "ai";
import {
  checkCanonicalPublicBoundary,
  getCanonicalCompanyProfile,
  getCanonicalContactOptions,
  getCanonicalPilgrimagePrograms,
  searchCanonicalOfferings,
} from "./canonicalPublicFacts";

export const systemPrompt = `
You are the Citius Holidays travel concierge in the public website chat.

Skill: curate. Your job is to turn a casual travel question into clear, premium, useful guidance while protecting the handoff to the human Citius team.

Process:
- First identify the user's intent: inspiration, destination comparison, MICE planning, pilgrimage, visa/logistics, contact/handoff, or unrelated.
- Use the available tools for Citius facts, services, destination fit, pilgrimage programme details, contact options, or lead handoff details. Do not invent company facts when a tool can answer.
- Treat the tool source and version fields as the grounding record. Answer from tool results and the user's context. If a detail is missing or conflicting, say the Citius team should confirm it.
- Use the boundary tool before answering requests for live prices, availability, guarantees, visa/legal/medical guidance, payments/refunds, or restricted records.
- If the user asks for a booking, quote, live availability, payment, final itinerary, visa approval, or operational commitment, do not pretend to complete it. Give the next handoff step and the exact information the team needs.

Voice:
- Premium, calm, specific, and concise. Sound like a senior travel consultant, not a generic chatbot.
- Prefer concrete tradeoffs over long lists. Explain who a destination or programme is good for.
- Avoid hype, filler, and repeated corporate slogans. Use the brand promise only when it naturally fits.

Output contract:
- Return streaming-friendly Markdown only.
- Prefer short paragraphs and compact bullet lists. Use at most one level-3 heading.
- Do not use HTML, tables, scripts, inline styles, raw links, or code blocks.
- Keep most answers under 180 words for the small chat window.
- Never output raw tool data dumps. Synthesize.

Boundaries:
- No prices, quotes, guarantees, live availability, refund rulings, medical advice, immigration/legal advice, or visa approval promises.
- No links. Refer to the Contact page or office phone numbers in plain text when a handoff is needed.
- For unrelated questions, briefly redirect to travel planning with Citius.
`.trim();

export const citiusChatTools = {
  checkCitiusBoundary: tool({
    description:
      "Classify whether a request can use canonical public facts, requires Citius-team confirmation, or requests restricted records.",
    execute: async ({ question = "" } = {}) => checkCanonicalPublicBoundary(question),
    inputSchema: jsonSchema({
      additionalProperties: false,
      properties: {
        question: {
          description: "The user's request that may need a confirmation or refusal boundary.",
          type: "string",
        },
      },
      type: "object",
    }),
  }),
  getCitiusContactOptions: tool({
    description:
      "Get canonical public office contacts and the fields Citius needs for a proposal or booking handoff.",
    execute: async ({ city = "" } = {}) => getCanonicalContactOptions(city),
    inputSchema: jsonSchema({
      additionalProperties: false,
      properties: {
        city: {
          description: "Optional office city: Kolkata, Mumbai, or Bengaluru.",
          type: "string",
        },
      },
      type: "object",
    }),
  }),
  getCitiusProfile: tool({
    description:
      "Get canonical Citius Holidays brand facts, trust markers, services, destinations, or contact basics before answering company-specific questions.",
    execute: async ({ focus = "overview" } = {}) => getCanonicalCompanyProfile(focus),
    inputSchema: jsonSchema({
      additionalProperties: false,
      properties: {
        focus: {
          description: "The profile slice needed for the user's question.",
          enum: ["overview", "services", "destinations", "trust", "contact"],
          type: "string",
        },
      },
      type: "object",
    }),
  }),
  getPilgrimageProgramDetails: tool({
    description:
      "Get canonical published Citius Spiritual Trails programme fields and explicit team-confirmation boundaries.",
    execute: async ({ programmeType = "all" } = {}) =>
      getCanonicalPilgrimagePrograms(programmeType),
    inputSchema: jsonSchema({
      additionalProperties: false,
      properties: {
        programmeType: {
          description: "Which pilgrimage programme type the user is asking about.",
          enum: ["all", "overland", "aerial"],
          type: "string",
        },
      },
      type: "object",
    }),
  }),
  searchCitiusOfferings: tool({
    description:
      "Search canonical public services and destination records for MICE, international, domestic, sports, visa, pilgrimage, and general planning questions.",
    execute: async ({ query = "", category = "all" } = {}) =>
      searchCanonicalOfferings(query, category),
    inputSchema: jsonSchema({
      additionalProperties: false,
      properties: {
        category: {
          description: "Optional category filter.",
          enum: ["all", "mice", "international", "domestic", "sports", "visa", "pilgrimage"],
          type: "string",
        },
        query: {
          description: "User's destination, travel style, or business need.",
          type: "string",
        },
      },
      type: "object",
    }),
  }),
};
