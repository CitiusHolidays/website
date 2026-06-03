/**
 * Leave head-approver defaults from "Employess Details - Leave Matrix.xlsx".
 * Column "Leave Application Alert" is the first-line approver (not HR).
 * HR is always the second approval stage in the portal.
 */

/** Roles eligible to be picked as an employee's leave head approver. */
export const LEAVE_HEAD_APPROVER_PICKER_ROLES = [
  "Directors",
  "Sales Head",
  "Contracting Head",
  "Operations Head",
  "Head of Ticketing",
];

/**
 * Maps spreadsheet alert labels (first name or "Directors") to a search token
 * matched against active staff names (case-insensitive).
 */
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
};

/** Normalized staff email -> leave alert label from the matrix. */
export const LEAVE_MATRIX_ALERT_BY_EMAIL = {
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

export function normalizeLeaveAlertLabel(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function leaveAlertToken(alertLabel) {
  const normalized = normalizeLeaveAlertLabel(alertLabel);
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
