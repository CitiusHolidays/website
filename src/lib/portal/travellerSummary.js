import { FOOD_PREFERENCES } from "@/lib/portal/constants";

export function normalizeTravellerGender(value) {
  const key = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  if (!key) {
    return "";
  }
  if (key === "m" || key.startsWith("male")) {
    return "Male";
  }
  if (key === "f" || key.startsWith("female")) {
    return "Female";
  }
  return String(value ?? "").trim();
}

function isMaleGender(value) {
  const normalized = normalizeTravellerGender(value).toLowerCase();
  return normalized === "male";
}

function isFemaleGender(value) {
  const normalized = normalizeTravellerGender(value).toLowerCase();
  return normalized === "female";
}

export function buildTravellerCountSummary(rows = []) {
  const foodCounts = new Map(FOOD_PREFERENCES.map((food) => [food, 0]));
  let male = 0;
  let female = 0;

  for (const row of rows || []) {
    if (isMaleGender(row.gender)) {
      male += 1;
    }
    if (isFemaleGender(row.gender)) {
      female += 1;
    }

    const food = row.foodPreference || "Unassigned";
    foodCounts.set(food, (foodCounts.get(food) ?? 0) + 1);
  }

  return {
    female,
    foodRows: Array.from(foodCounts, ([label, value]) => ({ label, value })),
    male,
  };
}
