/**
 * The roster editor's refusal (TASK-107).
 *
 * `PlayerEditModal.save` builds the draft, calls `validatePlayer`, and **returns
 * before `onSave`** when the draft is invalid, rendering the messages in
 * `.field-errors` (`src/roster/PlayerEditModal.tsx:141-146`). That branch was met
 * in code and pinned by nothing: `PlayerEditModal.test.ts` covers the rating
 * controls through `renderToStaticMarkup`, which runs no event handlers, so the
 * refusal was unreachable from it — and no e2e drove it either.
 *
 * **Why this spec is a browser case and not a unit case.** The other seven
 * `validatePlayer` rules are already unit-tested in
 * `src/domain/validation.test.ts`; what is *not* unit-testable is whether the
 * component wires the verdict to a refusal. That requires a click, and this
 * repo's convention is that a `.tsx` screen is proven in a real browser
 * (`README.md`: "the `.tsx` screens have no component tests by design; anything
 * that needs a real browser goes through `npm run e2e`").
 *
 * **The path below is the only one a user can reach, and that is a finding.**
 * Five of the six rules cannot be broken from the shipped UI:
 *
 * - A **missing rating** cannot happen: every attribute renders a control that
 *   always carries a value (`attributeScale`, or `middleOf` for the number field).
 * - An **out-of-range rating** cannot happen: the buttons are bounded by the
 *   attribute's own scale, and `DisciplineEditModal.addAttribute` hardcodes
 *   `{min: 1, max: 5}` with no bounds input, so a scale wide or fractional enough
 *   to render a free number field is unreachable through the UI.
 * - A **preferred role outside the list** is healed before it is sent:
 *   `buildCapabilities` nulls any preferred role not in `eligibleRoles`.
 * - An **empty eligibility list on an existing capability** is healed the same
 *   way: unticking every role falls back to *all* the discipline's roles.
 * - A **duplicate discipline** cannot be added: `availableDisciplines` filters out
 *   the ones already held.
 *
 * What is left is a capability in a discipline that declares **no roles at all**.
 * `DisciplineEditModal` will happily save one — untick "Roles are required", add
 * an attribute, save — and `validateCapability` then demands at least one
 * eligible role, of which the discipline has none. The dialog therefore refuses
 * **with no control that can clear the refusal**: the eligible-roles strip renders
 * zero chips, because it maps the discipline's own (empty) role list. A player
 * cannot be given a capability in a role-less discipline, ever, and the message
 * names a rule the user has no way to satisfy.
 *
 * That dead end is recorded rather than fixed: closing it means either refusing
 * the *discipline* at creation or relaxing the player rule, and both are product
 * decisions outside a test ticket's scope. What this spec does is make the
 * refusal itself observable, so the branch cannot be deleted or short-circuited
 * without a red run.
 */
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoHubSeeded, hubButton, type SeedWorld } from "../../support/seed";

const world = (): SeedWorld => ({
  communities: [{ id: "comm-refuse", name: "Refusal Crew", createdAt: 100 }],
  players: [],
  sessions: [],
  tournaments: [],
  squads: [],
  activeCommunityId: "comm-refuse",
});

/**
 * Create a discipline with one attribute and no roles, through the shipped
 * dialog. The dialog permits this: the "Roles are required" box is the only
 * gate, and it is unchecked here, so `buildRoles` returns `[]` and the record
 * saves.
 */
async function createRolelessDiscipline(page: Page, name: string, shortName: string): Promise<void> {
  await page.getByRole("button", { name: "Disciplines" }).click();
  await expect(page.locator(".screen h1")).toHaveText("Disciplines");

  await page.getByRole("button", { name: /New Discipline/ }).click();
  const modal = page.locator(".modal-card");
  await expect(modal).toBeVisible();

  await modal.getByRole("textbox", { name: "Name", exact: true }).fill(name);
  await modal.getByRole("textbox", { name: /Short name/ }).fill(shortName);
  await modal.getByRole("button", { name: /Add attribute/ }).click();
  await modal.getByPlaceholder("e.g. Skill").fill("Skill");
  // The one control that decides whether this discipline has any roles at all.
  await modal.getByRole("checkbox", { name: /Roles are required/ }).uncheck();

  const save = modal.getByRole("button", { name: /Add discipline/ });
  await expect(save).toBeEnabled({ timeout: 3000 });
  await save.click();
  await expect(modal).not.toBeVisible({ timeout: 5000 });
  await expect(page.locator(".roster .row", { hasText: name })).toHaveCount(1);
}

/** Open the Add-player dialog on the Roster and add a capability in `shortName`. */
async function openAddPlayerWithCapability(page: Page, playerName: string, shortName: string) {
  await hubButton(page, "Roster").click();
  await expect(page.locator(".screen h1")).toHaveText("comp3tive");

  await page.getByRole("button", { name: "+ Add Player" }).click();
  const modal = page.locator(".modal-card");
  await expect(modal).toBeVisible();
  await expect(modal.locator(".modal-title")).toHaveText("Add player");

  await modal.locator("#player-name").fill(playerName);
  // The capability chip's accessible name is `+ {shortName}`.
  await modal.getByRole("button", { name: `+ ${shortName}` }).click();
  return modal;
}

test("adding a capability in a role-less discipline is refused, and says why", async ({ page }) => {
  await gotoHubSeeded(page, world(), "Games");
  await createRolelessDiscipline(page, "Silent Sport", "SSPT");

  const modal = await openAddPlayerWithCapability(page, "Refused Player", "SSPT");

  // The refusal is only a refusal if the write never happened. `save()` calls
  // `onSave` and then `onClose()` on the valid path, so a modal that is still
  // open after the click is this assertion's whole content — and deleting the
  // early `return` in `PlayerEditModal.save` turns it red, because the dialog
  // would close on a player it should not have written.
  await modal.getByRole("button", { name: "Add player", exact: true }).click();
  await expect(modal).toBeVisible();

  // The message names the missing thing, and the thing is the discipline's own
  // lack of roles rather than anything about the player.
  const errors = modal.locator(".field-errors");
  await expect(errors).toBeVisible();
  await expect(errors).toContainText('At least one eligible role is required for "Silent Sport".');

  // And the dead end is real: the strip the message points at offers nothing to
  // tick, because it maps the discipline's own empty role list.
  await expect(modal.locator(".cap-roles .chips .chip")).toHaveCount(0);

  // Nothing was written. Closing the dialog is what makes the roster readable
  // again, and the roster is the evidence that the store is untouched.
  await modal.locator(".modal-close").click();
  await expect(modal).not.toBeVisible();
  await expect(page.locator(".roster .row", { hasText: "Refused Player" })).toHaveCount(0);
  await expect(page.locator(".roster .row")).toHaveCount(0);
});

test("the same dialog saves once nothing is in the way", async ({ page }) => {
  // The control: the refusal above is specific to the invalid capability, not a
  // dialog that cannot save at all. Same surface, same session shape, one
  // difference — no capability is added.
  await gotoHubSeeded(page, world(), "Games");
  await createRolelessDiscipline(page, "Silent Sport", "SSPT");

  await hubButton(page, "Roster").click();
  await page.getByRole("button", { name: "+ Add Player" }).click();
  const modal = page.locator(".modal-card");
  await expect(modal).toBeVisible();
  await modal.locator("#player-name").fill("Accepted Player");

  await modal.getByRole("button", { name: "Add player", exact: true }).click();
  await expect(modal).not.toBeVisible({ timeout: 5000 });
  await expect(page.locator(".roster .row", { hasText: "Accepted Player" })).toHaveCount(1);
});
