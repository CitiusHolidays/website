import type { Page } from "@playwright/test";

export class PortalPage {
  constructor(protected readonly page: Page) {}

  async gotoPortalView(path: string) {
    await this.page.goto(path);
  }

  toolbarAction(name: string | RegExp) {
    return this.page.getByTestId("portal-list-toolbar-actions").getByRole("button", { name });
  }

  rowContaining(text: string) {
    return this.page.locator("tr").filter({ hasText: text });
  }
}
