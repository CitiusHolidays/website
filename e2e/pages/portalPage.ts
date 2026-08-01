import type { Page } from "@playwright/test";

export class PortalPage {
  protected readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

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
