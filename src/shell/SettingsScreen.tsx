import type { AccountSync } from "../account/useAccount";
import type { PushController } from "../account/useSync";
import { AccountPanel } from "../account/AccountPanel";
import { PageHeader } from "../ui/PageHeader";
import { Screen } from "../ui/Screen";

interface Props {
  themePref: string;
  layoutPref: string;
  onThemeChange: (v: string) => void;
  onLayoutChange: (v: string) => void;
  accountSync: AccountSync;
  pushController: PushController;
}

/**
 * Settings, as a hub destination. The theme and layout chips moved here from
 * the topbar popover (which is gone), and the Account panel moved here from
 * the Dashboard: the Dashboard is the daily flow, and sign-in is a
 * set-it-once concern. A Guest reaches this screen and finds every control
 * still optional, in the Account panel's own words.
 */
export function SettingsScreen({
  themePref,
  layoutPref,
  onThemeChange,
  onLayoutChange,
  accountSync,
  pushController,
}: Props) {
  return (
    <Screen>
      <PageHeader
        kicker="Preferences"
        title="Settings"
        lede="How the app looks, and where your data lives."
      />

      <section className="settings-section" aria-label="Theme">
        <div className="settings-label">Theme</div>
        <div className="settings-options">
          <button
            type="button"
            className={`settings-chip ${themePref === "light" ? "active" : ""}`}
            onClick={() => onThemeChange("light")}
          >
            Light
          </button>
          <button
            type="button"
            className={`settings-chip ${themePref === "dark" ? "active" : ""}`}
            onClick={() => onThemeChange("dark")}
          >
            Dark
          </button>
          <button
            type="button"
            className={`settings-chip ${themePref === "auto" ? "active" : ""}`}
            onClick={() => onThemeChange("auto")}
          >
            Auto
          </button>
        </div>
      </section>

      <section className="settings-section" aria-label="Layout">
        <div className="settings-label">Layout</div>
        <div className="settings-options">
          <button
            type="button"
            className={`settings-chip ${layoutPref === "auto" ? "active" : ""}`}
            onClick={() => onLayoutChange("auto")}
          >
            Auto
          </button>
          <button
            type="button"
            className={`settings-chip ${layoutPref === "mobile" ? "active" : ""}`}
            onClick={() => onLayoutChange("mobile")}
          >
            Mobile
          </button>
          <button
            type="button"
            className={`settings-chip ${layoutPref === "desktop" ? "active" : ""}`}
            onClick={() => onLayoutChange("desktop")}
          >
            Desktop
          </button>
        </div>
      </section>

      <AccountPanel accountSync={accountSync} onSyncNow={() => pushController.syncAll()} />
    </Screen>
  );
}
