import type { Community, Discipline, Player } from "../domain/types";
import type { AccountSync } from "../account/useAccount";
import type { PushController } from "../account/useSync";
import type { IconName } from "../ui/Icon";
import { AccountPanel } from "../account/AccountPanel";
import { JoinPanel } from "./JoinPanel";
import { PageHeader } from "../ui/PageHeader";
import { Screen } from "../ui/Screen";
import { Icon } from "../ui/Icon";

interface Props {
  themePref: string;
  layoutPref: string;
  onThemeChange: (v: string) => void;
  onLayoutChange: (v: string) => void;
  accountSync: AccountSync;
  pushController: PushController;
  communities: Community[];
  activeCommunity: Community | null;
  disciplines: Discipline[];
  savePlayer: (player: Player) => Promise<void>;
  notify: (text: string, type?: "success" | "error" | "info") => void;
}

/**
 * One choice in the segmented rows: its stored value, its written label and
 * its glyph. The label is what tests and screen readers read; the icon is
 * aria-hidden decoration that only speeds up the eye (TASK-139).
 */
interface ChipOption {
  value: string;
  label: string;
  icon: IconName;
}

/** Light and dark, plus the auto that defers to the OS each visit. */
const THEME_OPTIONS: ChipOption[] = [
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "auto", label: "Auto", icon: "half" },
];

/** Phone, desktop, or the auto that asks the viewport. */
const LAYOUT_OPTIONS: ChipOption[] = [
  { value: "auto", label: "Auto", icon: "devices" },
  { value: "mobile", label: "Mobile", icon: "phone" },
  { value: "desktop", label: "Desktop", icon: "monitor" },
];

/**
 * One settings row, data-driven: the label block and a wrapped row of chips.
 * Nothing about the previous three-copies-per-section markup is lost —
 * same test ids by text, same click targets, same active state — the chips
 * just arrive from a list instead of from three hand-copied blocks, which is
 * how the third copy drifts from the first two.
 */
function SettingsRow({
  label,
  options,
  current,
  onChange,
}: {
  label: string;
  options: ChipOption[];
  current: string;
  onChange: (v: string) => void;
}) {
  return (
    <section className="settings-section" aria-label={label}>
      <div className="settings-label">{label}</div>
      <div className="settings-options">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`settings-chip ${current === option.value ? "active" : ""}`}
            onClick={() => onChange(option.value)}
          >
            <Icon name={option.icon} size={16} />
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/**
 * Settings, as a hub destination. The theme and layout chips moved here from
 * the topbar popover (which is gone), and the Account panel moved here from
 * the Dashboard: the Dashboard is the daily flow, and sign-in is a
 * set-it-once concern. A Guest reaches this screen and finds every control
 * still optional, in the Account panel's own words.
 *
 * The chips carry glyphs (sun / moon / half, devices / phone / monitor) so a
 * choice can be recognised before it is read — the same trick the shell's
 * rail uses. They stopped stretching on the desktop's 990px row (TASK-139):
 * a 300px "Auto" chip read as three wide slabs, not one choice in three
 * parts, and the stretch is what a segmented control must never say.
 */
export function SettingsScreen({
  themePref,
  layoutPref,
  onThemeChange,
  onLayoutChange,
  accountSync,
  pushController,
  communities,
  activeCommunity,
  disciplines,
  savePlayer,
  notify,
}: Props) {
  return (
    <Screen>
      <PageHeader
        title="Settings"
        lede="How the app looks, and where your data lives."
      />

      <SettingsRow
        label="Theme"
        options={THEME_OPTIONS}
        current={themePref}
        onChange={onThemeChange}
      />

      <SettingsRow
        label="Layout"
        options={LAYOUT_OPTIONS}
        current={layoutPref}
        onChange={onLayoutChange}
      />

      <JoinPanel
        community={activeCommunity}
        communities={communities}
        disciplines={disciplines}
        savePlayer={savePlayer}
        notify={notify}
      />

      <AccountPanel accountSync={accountSync} onSyncNow={() => pushController.syncAll()} />

    </Screen>
  );
}
