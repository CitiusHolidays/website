/** Convex copy of leave matrix seed (see `src/lib/portal/leaveMatrix.js`). */

export const LEAVE_ALERT_NAME_TOKENS = {
  monika: "monika",
  rosy: "rosy",
  oliviya: "olyvia",
  olyvia: "olyvia",
  vicky: "vicky",
  swati: "swati",
  sree: "sree",
  divyanshu: "divyanshu",
  directors: "directors",
  kalyan: "kalyan",
  surajit: "surajit",
} as const;

export const LEAVE_MATRIX_ALERT_BY_EMAIL: Record<string, string> = {
  "aditya@citius.in": "Monika",
  "ajay@citius.in": "Rosy",
  "anamika@citius.in": "Oliviya",
  "anup@citius.in": "Vicky",
  "aritra@citius.in": "Oliviya",
  "dipankar@citius.in": "Rosy",
  "divyanshu@citius.in": "Directors",
  "kalyan@citius.in": "Surajit",
  "koushik@citius.in": "Kalyan",
  "kushmesh@citius.in": "Directors",
  "manthan@citius.in": "Swati",
  "mithu@citius.in": "Rosy",
  "monika@citius.in": "Divyanshu",
  "ticketing@citius.in": "Rosy",
  "olyvia@citius.in": "Directors",
  "partha@citius.in": "Rosy",
  "pratyush@citius.in": "Monika",
  "radhagobinda@citius.in": "Rosy",
  "rosy@citius.in": "Directors",
  "rujuta@citius.in": "Sree",
  "sanjay@citius.in": "Rosy",
  "satyaki@citius.in": "Kalyan",
  "bookings@citius.in": "Rosy",
  "sourav@citius.in": "Sree",
  "subhajit@citius.in": "Sree",
  "ops@citius.in": "Rosy",
  "sudeshna@citius.in": "Rosy",
  "suhatro@citius.in": "Rosy",
  "sumit.k@citius.in": "Swati",
  "sumit@citius.in": "Vicky",
  "accounts.kolkata@citius.in": "Kalyan",
  "surajit@citius.in": "Rosy",
  "booking@citius.in": "Rosy",
  "swati@citius.in": "Divyanshu",
  "upanita@citius.in": "Rosy",
  "vicky@citius.in": "Monika",
  "sree@citius.in": "Oliviya",
};

export function leaveAlertToken(alertLabel: string) {
  const normalized = String(alertLabel ?? "")
    .trim()
    .toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("director")) return LEAVE_ALERT_NAME_TOKENS.directors;
  for (const [key, token] of Object.entries(LEAVE_ALERT_NAME_TOKENS)) {
    if (key === "directors") continue;
    if (normalized === key || normalized.startsWith(`${key} `)) {
      return token;
    }
  }
  return normalized.split(/\s+/)[0] ?? "";
}
