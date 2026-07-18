import { join } from "node:path";
import { test as base, expect } from "@playwright/test";
import type { E2eRoleProfileKey } from "../fixtures/staffProfiles";

export const test = base.extend<{ role: E2eRoleProfileKey }>({
  role: ["admin", { option: true }],
  storageState: async ({ role }, use) => {
    const authPath = join(process.cwd(), "e2e", ".auth", `${role}.json`);
    await use(authPath);
  },
});

export { expect };
