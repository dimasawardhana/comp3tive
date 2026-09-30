import { useState } from "react";
import type { Community, Id } from "../domain/types";
import type { HubMode, View } from "./useNavigation";
import { NAV_ITEMS } from "./nav-items";
import { Toasts } from "../ui/Toasts";
import { ConfirmButton } from "../ui/ConfirmButton";
import type { ToastType } from "./useToasts";

export interface AppChromeProps {
  railPref: string;
  onToggleRail: () => void;
  viewStack: View[];
  onGotoHub: (mode: HubMode) => void;
  communities: Community[];
  activeCommunity: Community | null;
  onSelectCommunity: (id: Id) => void;
  onDeleteCommunity: (id: Id) => void;
  communityDeleteWarning: (id: Id) => string;
  /** The ✚ form lives in App's `<main>`, so its visibility is App's to toggle. */
  showAddCommunity: boolean;
  onToggleAddCommunity: () => void;
  themePref: string;
  layoutPref: string;
  onThemeChange: (v: string) => void;
  onLayoutChange: (v: string) => void;
  toasts: Array<{ id: string; text: string; type: ToastType }>;
  /** The screen switch, rendered inside `<main className="shell-main">`. */
  children: React.ReactNode;
}

/**
 * The shell around every screen: skip link, desktop rail, topbar (community
 * switcher with its delete confirm, ✚, settings popover), the live region and
 * the handheld bottom nav. It owns the two menus that open and close inside the
 * chrome itself — the community menu and the settings popover — and nothing
 * outside the chrome reads either.
 */
export function AppChrome(props: AppChromeProps) {
  const [showCommunityMenu, setShowCommunityMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const {
    railPref,
    viewStack,
    activeCommunity,
    communityDeleteWarning,
    themePref,
    layoutPref,
  } = props;
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>

      <aside className="rail" aria-label="Primary">
        <div className="wordmark rail-brand">
          <span className="sq" aria-hidden="true">●</span>
          <span>comp3tive</span>
        </div>
        <nav className="rail-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.mode}
              type="button"
              className={`rail-link ${viewStack[0].mode === item.mode ? "nav-active" : ""}`}
              onClick={() => props.onGotoHub(item.mode)}
              aria-current={viewStack[0].mode === item.mode ? "page" : undefined}
              title={railPref === "collapsed" ? item.label : undefined}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="rail-link-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <button
          type="button"
          className="rail-toggle"
          onClick={props.onToggleRail}
          aria-expanded={railPref === "expanded"}
          aria-label={railPref === "collapsed" ? "Show menu labels" : "Hide menu labels"}
          title={railPref === "collapsed" ? "Show menu labels" : "Hide menu labels"}
        >
          <span className="nav-icon" aria-hidden="true">{railPref === "collapsed" ? "»" : "«"}</span>
          <span className="rail-link-label">Hide labels</span>
        </button>
      </aside>

        <div className="shell">
        <header className="topbar-wrap topbar">
          <div className="wordmark">
            <span className="sq">●</span>
            <span>comp3tive</span>
          </div>
          <div className="topbar-tools">
            <div className="squad-switcher">
              <span className="kicker">Community</span>
              <div className="squad-dropdown">
                <button
                  type="button"
                  className="squad-select"
                  onClick={() => setShowCommunityMenu((s) => !s)}
                  aria-haspopup="listbox"
                  aria-expanded={showCommunityMenu}
                  aria-label="Active community"
                >
                  <span className="squad-select-value">{activeCommunity?.name ?? "— No community —"}</span>
                  <span className="squad-select-caret" aria-hidden="true">▾</span>
                </button>
                {showCommunityMenu && (
                  <>
                    <div className="squad-menu-backdrop" onClick={() => setShowCommunityMenu(false)} />
                    <div className="squad-menu">
                      <div className="squad-menu-heading">Community</div>
                      <ul className="squad-menu-list" role="listbox" aria-label="Communities">
                        {props.communities.map((c) => {
                          const isActive = activeCommunity?.id === c.id;
                          return (
                            <li key={c.id}>
                              <button
                                type="button"
                                className="squad-menu-item"
                                onClick={() => { props.onSelectCommunity(c.id); setShowCommunityMenu(false); }}
                                role="option"
                                aria-selected={isActive}
                              >
                                <span className="squad-menu-name">{c.name}</span>
                                {isActive && <span className="squad-menu-check" aria-hidden="true">✓</span>}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      {activeCommunity && props.communities.length > 1 && (
                        <div className="squad-menu-footer">
                          <ConfirmButton
                            className="squad-menu-danger"
                            label={`Delete ${activeCommunity.name}`}
                            confirmLabel="Delete community"
                            message={`Delete "${activeCommunity.name}"?${communityDeleteWarning(activeCommunity.id)}`}
                            onConfirm={() => {
                              setShowCommunityMenu(false);
                              void props.onDeleteCommunity(activeCommunity.id);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
            <button
              type="button"
              className="icon-btn"
              aria-label="New community"
              title="New community"
              onClick={() => { props.onToggleAddCommunity(); setShowCommunityMenu(false); }}
            >
              ✚
            </button>
          <div className="settings-trigger">
            <button
              type="button"
              className="icon-btn"
              aria-label="Settings"
              title="Settings"
              onClick={() => setShowSettings((s) => !s)}
            >
              ⚙
            </button>
            {showSettings && (
              <div className="settings-popover" role="dialog" aria-label="Settings">
                <div className="settings-section">
                  <div className="settings-label">Theme</div>
                  <div className="settings-options">
                    <button type="button" className={`settings-chip ${themePref === "light" ? "active" : ""}`} onClick={() => props.onThemeChange("light")}>Light</button>
                    <button type="button" className={`settings-chip ${themePref === "dark" ? "active" : ""}`} onClick={() => props.onThemeChange("dark")}>Dark</button>
                    <button type="button" className={`settings-chip ${themePref === "auto" ? "active" : ""}`} onClick={() => props.onThemeChange("auto")}>Auto</button>
                  </div>
                </div>
                <div className="settings-section">
                  <div className="settings-label">Layout</div>
                  <div className="settings-options">
                    <button type="button" className={`settings-chip ${layoutPref === "auto" ? "active" : ""}`} onClick={() => props.onLayoutChange("auto")}>Auto</button>
                    <button type="button" className={`settings-chip ${layoutPref === "mobile" ? "active" : ""}`} onClick={() => props.onLayoutChange("mobile")}>Mobile</button>
                    <button type="button" className={`settings-chip ${layoutPref === "desktop" ? "active" : ""}`} onClick={() => props.onLayoutChange("desktop")}>Desktop</button>
                  </div>
                </div>
              </div>
            )}
          </div>
          </div>
        </header>
        <main id="main" className="shell-main">
          {props.children}
        </main>
      </div>
      <Toasts toasts={props.toasts} />
      <nav className="bottom-nav" aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.mode}
            type="button"
            className={`nav-link ${viewStack[0].mode === item.mode ? "nav-active" : ""}`}
            onClick={() => props.onGotoHub(item.mode)}
            aria-current={viewStack[0].mode === item.mode ? "page" : undefined}
          >
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
