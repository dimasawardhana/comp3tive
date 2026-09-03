import { type Page, type Locator } from "@playwright/test";

export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("http://localhost:4173/");
    await this.page.waitForLoadState("networkidle");
  }

  get heading(): Locator {
    return this.page.getByRole("heading", { level: 1 });
  }

  get toast(): Locator {
    return this.page.getByRole("status");
  }
}
