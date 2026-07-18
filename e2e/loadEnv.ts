import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Strip inline `#` comments that are outside quoted values. */
export function parseEnvLineValue(raw: string) {
  let value = raw.trim();
  let inQuote: '"' | "'" | null = null;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (inQuote) {
      if (character === inQuote) {
        inQuote = null;
      }
      continue;
    }
    if (character === '"' || character === "'") {
      inQuote = character;
      continue;
    }
    if (character === "#") {
      value = value.slice(0, index).trim();
      break;
    }
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function applyEnvFile(path: string, override: boolean) {
  if (!existsSync(path)) {
    return;
  }

  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = parseEnvLineValue(trimmed.slice(separator + 1));
    if (!key) {
      continue;
    }

    if (override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/** Load `.env` then `.env.local` so Playwright sees the same vars as Next/Convex dev. */
export function loadE2eEnv(root = process.cwd()) {
  applyEnvFile(join(root, ".env"), false);
  applyEnvFile(join(root, ".env.local"), true);
}
