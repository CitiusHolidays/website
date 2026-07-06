/**
 * @param {{ displayName?: string | null, now?: Date }} options
 */
export function getDashboardGreeting({ displayName, now = new Date() } = {}) {
  const hours = now.getHours();
  let timeOfDay;
  if (hours < 12) {
    timeOfDay = "morning";
  } else if (hours <= 16) {
    timeOfDay = "afternoon";
  } else {
    timeOfDay = "evening";
  }

  const greeting = `Good ${timeOfDay}`;
  const firstName = displayName?.split(" ")[0];
  return firstName ? `${greeting}, ${firstName}` : greeting;
}
