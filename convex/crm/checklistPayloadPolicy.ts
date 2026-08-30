import { ConvexError } from "convex/values";
import type { PreDepartureChecklist } from "./jobCardConstants";

export const PRE_DEPARTURE_CHECKLIST_ITEM_LIMIT = 100;
export const PRE_DEPARTURE_CHECKLIST_FIELD_CHAR_LIMIT = 500;
export const PRE_DEPARTURE_CHECKLIST_TOTAL_CHAR_LIMIT = 64_000;

export function assertBoundedPreDepartureChecklist(checklist: PreDepartureChecklist) {
  if (checklist.length > PRE_DEPARTURE_CHECKLIST_ITEM_LIMIT) {
    throw new ConvexError(
      `Pre-departure checklist cannot exceed ${PRE_DEPARTURE_CHECKLIST_ITEM_LIMIT} items`
    );
  }

  let totalCharacters = 0;
  for (const item of checklist) {
    const textFields = [
      item.category,
      item.dueDate,
      item.key,
      item.label,
      item.owner,
      item.status,
      item.title,
    ];
    for (const value of textFields) {
      if (value === undefined) {
        continue;
      }
      if (value.length > PRE_DEPARTURE_CHECKLIST_FIELD_CHAR_LIMIT) {
        throw new ConvexError(
          `Pre-departure checklist fields cannot exceed ${PRE_DEPARTURE_CHECKLIST_FIELD_CHAR_LIMIT} characters`
        );
      }
      totalCharacters += value.length;
    }
  }

  if (totalCharacters > PRE_DEPARTURE_CHECKLIST_TOTAL_CHAR_LIMIT) {
    throw new ConvexError(
      `Pre-departure checklist text cannot exceed ${PRE_DEPARTURE_CHECKLIST_TOTAL_CHAR_LIMIT} characters`
    );
  }
}
