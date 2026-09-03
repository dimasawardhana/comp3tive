import { type Page, type Locator } from "@playwright/test";
import { BasePage } from "./base.page";

export class SplitPage extends BasePage {
  readonly splitButton: Locator;

  constructor(page: Page) {
    super(page);
    this.splitButton = page.getByTestId("split-button");
  }

  async selectPlayer(playerName: string): Promise<void> {
    await this.page.getByRole("button", { name: new RegExp(playerName, "i") }).click();
  }

  async clickSplit(): Promise<void> {
    await this.splitButton.click();
  }
}
