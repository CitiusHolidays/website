import type { Locator } from "@playwright/test";
import { isRuntimeString } from "../../src/lib/runtimeValues";

function isPlaceholderOption(text: string) {
  const normalized = text.trim().toLowerCase();
  return !normalized || normalized.includes("select");
}

function isNativeSelect(select: Locator) {
  return select.evaluate((element) => element.tagName === "SELECT");
}

async function optionLabels(select: Locator, openCustomSelect: boolean) {
  if (await isNativeSelect(select)) {
    return select.locator("option").allTextContents();
  }

  if (openCustomSelect && (await select.getAttribute("aria-expanded")) !== "true") {
    await select.click();
  }

  return select.page().getByRole("option").allTextContents();
}

/** Wait until async Convex options have rendered in a native or Base UI select. */
export async function waitForSelectableOptions(select: Locator, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  let lastOptions: string[] = [];

  while (Date.now() < deadline) {
    lastOptions = await optionLabels(select, true);
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
  const deadline = Date.now() + 15_000;
  let matched: string | undefined;
  let options: string[] = [];
  while (Date.now() < deadline) {
    options = await optionLabels(select, true);
    matched = options.find((option) => {
      const text = option.trim();
      if (isPlaceholderOption(text)) {
        return false;
      }
      if (isRuntimeString(labelMatch)) {
        return text.includes(labelMatch);
      }
      labelMatch.lastIndex = 0;
      return labelMatch.test(text);
    });
    if (matched) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (!matched) {
    throw new Error(
      `Timed out waiting for option matching ${String(labelMatch)}. Last options: ${options.join(", ")}`
    );
  }

  const label = matched.trim();
  if (await isNativeSelect(select)) {
    await select.selectOption({ label });
    return;
  }

  await select.page().getByRole("option", { exact: true, name: label }).click();
}

export async function firstSelectableOptionLabel(select: Locator) {
  await waitForSelectableOptions(select);
  const options = await optionLabels(select, false);
  const matched = options.find((option) => !isPlaceholderOption(option));
  return matched?.trim() ?? null;
}

export async function selectedOptionLabel(select: Locator) {
  if (await isNativeSelect(select)) {
    if (!(await select.inputValue())) {
      return null;
    }
    return (await select.locator("option:checked").textContent())?.trim() || null;
  }

  const label = (await select.textContent())?.trim() ?? "";
  return label && !isPlaceholderOption(label) ? label : null;
}

export async function selectFirstSelectableOption(select: Locator) {
  const label = await firstSelectableOptionLabel(select);
  if (!label) {
    throw new Error("No selectable option available");
  }
  await selectOptionByMatchingLabel(select, label);
}
