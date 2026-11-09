/**
 * Clamp an operator-supplied migration batch size to a whole number between 1
 * and `maxLimit`, using `defaultLimit` when the caller omits it.
 */
export function boundedMigrationLimit(
  limit: number | undefined,
  defaultLimit: number,
  maxLimit = defaultLimit
) {
  return Math.min(Math.max(Math.trunc(limit ?? defaultLimit), 1), maxLimit);
}
