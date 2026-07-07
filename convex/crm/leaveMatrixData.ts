/** Convex copy of leave matrix seed (see `src/lib/portal/leaveMatrix.js`). */

export const LEAVE_ALERT_NAME_TOKENS = {
  directors: "directors",
  divyanshu: "divyanshu",
  kalyan: "kalyan",
  monika: "monika",
  oliviya: "olyvia",
  olyvia: "olyvia",
  rosy: "rosy",
  sree: "sree",
  surajit: "surajit",
  swati: "swati",
  vicky: "vicky",
} as const;

export const LEAVE_MATRIX_ALERT_BY_EMAIL: Record<string, string> = {
  "accounts.kolkata@citius.in": "Kalyan",
  "aditya@citius.in": "Monika",
  "ajay@citius.in": "Rosy",
  "anamika@citius.in": "Oliviya",
  "anup@citius.in": "Vicky",
  "aritra@citius.in": "Oliviya",
  "booking@citius.in": "Rosy",
  "bookings@citius.in": "Rosy",
  "dipankar@citius.in": "Rosy",
  "divyanshu@citius.in": "Directors",
  "kalyan@citius.in": "Surajit",
  "koushik@citius.in": "Kalyan",
  "kushmesh@citius.in": "Directors",
  "manthan@citius.in": "Swati",
  "mithu@citius.in": "Rosy",
  "monika@citius.in": "Divyanshu",
  "olyvia@citius.in": "Directors",
  "ops@citius.in": "Rosy",
  "partha@citius.in": "Rosy",
  "pratyush@citius.in": "Monika",
  "radhagobinda@citius.in": "Rosy",
  "rosy@citius.in": "Directors",
  "rujuta@citius.in": "Sree",
  "sanjay@citius.in": "Rosy",
  "satyaki@citius.in": "Kalyan",
  "sourav@citius.in": "Sree",
  "sree@citius.in": "Oliviya",
  "subhajit@citius.in": "Sree",
  "sudeshna@citius.in": "Rosy",
  "suhatro@citius.in": "Rosy",
  "sumit.k@citius.in": "Swati",
  "sumit@citius.in": "Vicky",
  "surajit@citius.in": "Rosy",
  "swati@citius.in": "Divyanshu",
  "ticketing@citius.in": "Rosy",
  "upanita@citius.in": "Rosy",
  "vicky@citius.in": "Monika",
};

export function leaveAlertToken(alertLabel: string) {
  const normalized = String(alertLabel ?? "")
    .trim()
    .toLowerCase();
  if (!normalized) {
    return "";
  }
  if (normalized.includes("director")) {
    return LEAVE_ALERT_NAME_TOKENS.directors;
  }
  for (const [key, token] of Object.entries(LEAVE_ALERT_NAME_TOKENS)) {
    if (key === "directors") {
      continue;
    }
    if (normalized === key || normalized.startsWith(`${key} `)) {
      return token;
    }
  }
  return normalized.split(/\s+/)[0] ?? "";
}
