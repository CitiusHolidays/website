import type { Locator } from "@playwright/test";

function isPlaceholderOption(text: string) {
  const normalized = text.trim().toLowerCase();
  return !normalized || normalized.includes("select");
}

/** Wait until async Convex team/job-card options have rendered in a native `<select>`. */
export async function waitForSelectableOptions(select: Locator, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  let lastOptions: string[] = [];

  while (Date.now() < deadline) {
    lastOptions = await select.locator("option").allTextContents();
    if (lastOptions.some((option) => !isPlaceholderOption(option))) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(
    `Timed out waiting for select options (${timeout}ms). Last options: ${lastOptions.join(", ")}`
  );
}

export async function selectOptionByMatchingLabel(select: Locator, labelMatch: string | RegExp) {
  await waitForSelectableOptions(select);
  const options = await select.locator("option").allTextContents();
  const matched = options.find((option) => {
    const text = option.trim();
    if (isPlaceholderOption(text)) {
      return false;
    }
    if (typeof labelMatch === "string") {
      return text.includes(labelMatch);
    }
    labelMatch.lastIndex = 0;
    return labelMatch.test(text);
  });

  if (!matched) {
    throw new Error(`No option matching ${String(labelMatch)}`);
  }

  await select.selectOption({ label: matched.trim() });
}

export async function firstSelectableOptionLabel(select: Locator) {
  const options = await select.locator("option").allTextContents();
  const matched = options.find((option) => !isPlaceholderOption(option));
  return matched?.trim() ?? null;
}
