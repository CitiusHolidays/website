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
};

/** Normalized staff email -> leave alert label from the matrix. */
export const LEAVE_MATRIX_ALERT_BY_EMAIL = {
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

export function normalizeLeaveAlertLabel(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function leaveAlertToken(alertLabel) {
  const normalized = normalizeLeaveAlertLabel(alertLabel);
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
