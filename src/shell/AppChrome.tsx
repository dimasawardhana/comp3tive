import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Community, Id } from "../domain/types";
import type { HubMode, View } from "./useNavigation";
import { NAV_ITEMS, SETTINGS_ITEM, screenTitle } from "./nav-items";
import type { IconName } from "./nav-items";
import { Toasts } from "../ui/Toasts";
import { ConfirmButton } from "../ui/ConfirmButton";
import AiAssistant from "./AiAssistant";
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
  /**
   * The new-community form lives in App's `<main>`, so its visibility is App's
   * to toggle. This is the chrome's half of that gate and nothing more: the
   * button asks App to flip the flag and the chrome never learns the answer,
   * which is why the button carries no `aria-expanded`.
   */
  onToggleAddCommunity: () => void;

  toasts: Array<{ id: string; text: string; type: ToastType }>;
  /** The screen switch, rendered inside `<main className="shell-main">`. */
  children: React.ReactNode;
}

/**
 * The shell's icons, drawn here rather than imported. Sixteen-pixel outline
 * shapes on a 24-unit grid at 1.5 stroke, so every one of them shares a weight
 * with the two faces and none of them arrives from a library that would give
 * the app someone else's look.
 */
const ICONS: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="M4 10.4 12 4l8 6.4" />
      <path d="M6.2 9.6V19a1 1 0 0 0 1 1h9.6a1 1 0 0 0 1-1V9.6" />
      <path d="M9.8 20v-5.2h4.4V20" />
    </>
  ),
  roster: (
    <>
      <circle cx="9.2" cy="8.4" r="2.7" />
      <path d="M4 19.4a5.2 5.2 0 0 1 10.4 0" />
      <path d="M15.8 6.1a2.6 2.6 0 0 1 0 4.9" />
      <path d="M16.6 14.4a4.6 4.6 0 0 1 3.4 4.4" />
    </>
  ),
  games: (
    <>
      <path d="M8.2 4h7.6v4.4a3.8 3.8 0 0 1-7.6 0Z" />
      <path d="M8.2 5.4H5.4v1.4a3.2 3.2 0 0 0 3.1 3.2" />
      <path d="M15.8 5.4h2.8v1.4a3.2 3.2 0 0 1-3.1 3.2" />
      <path d="M12 12.2v3.6" />
      <path d="M8.6 19.6h6.8" />
    </>
  ),
  history: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.4V12l3.1 1.9" />
    </>
  ),
  squads: (
    <>
      <path d="M12 4 20 8.4 12 12.8 4 8.4Z" />
      <path d="M4 12.2 12 16.6 20 12.2" />
      <path d="M4 16 12 20.4 20 16" />
    </>
  ),
  settings: (
    <>
      <path d="M3.8 8.4h7.4" />
      <path d="M15.6 8.4h4.6" />
      <circle cx="13.4" cy="8.4" r="2.2" />
      <path d="M3.8 15.6h4.6" />
      <path d="M12.8 15.6h7.4" />
      <circle cx="10.6" cy="15.6" r="2.2" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5.2v13.6" />
      <path d="M5.2 12h13.6" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>
  ),
  close: (
    <>
      <path d="M6.4 6.4 17.6 17.6" />
      <path d="M17.6 6.4 6.4 17.6" />
    </>
  ),
  check: <path d="M5.2 12.4 10 17.2 18.8 7.2" />,
  caret: <path d="M7.6 10.2 12 14.6l4.4-4.4" />,
  panel: (
    <>
      <rect x="3.6" y="4.6" width="16.8" height="14.8" rx="2" />
      <path d="M9.4 4.6v14.8" />
    </>
  ),
};

function Icon({ name }: { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name]}
    </svg>
  );
}

/**
 * The product's mark: two team columns with the gap needle between them, one
 * bar shorter than the other because that is what a split looks like. The bars
 * are ink and the needle is the accent, which is the only place the shell
 * spends the hue.
 */
function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 16 16" fill="none" focusable="false">
        <path d="M4 5.4v5.2" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M12 3.4v9.2" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <path className="brand-needle" d="M5.8 8.4h4.4" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function Brand() {
  return (
    <div className="wordmark rail-brand">
      <BrandMark />
      <span>comp3tive</span>
    </div>
  );
}

/** One row of the navigation, in the sidebar and in the phone sheet alike. */
function NavRow({
  icon,
  label,
  active,
  onClick,
}: {
  icon: IconName;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? "rail-link nav-active" : "rail-link"}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
    >
      <span className="nav-icon"><Icon name={icon} /></span>
      <span className="rail-link-label">{label}</span>
    </button>
  );
}

/**
 * The five destinations. Settings is not one of them; it is a utility.
 * `navId` is only passed in the sidebar: the sheet renders the same list, and a
 * duplicated id would make the collapse button's `aria-controls` ambiguous.
 */
function NavRows({
  rootMode,
  onGotoHub,
  onNavigate,
  navId,
}: {
  rootMode: string;
  onGotoHub: (mode: HubMode) => void;
  onNavigate: () => void;
  navId?: string;
}) {
  return (
    <nav className="rail-nav" id={navId} aria-label="Screens">
      {NAV_ITEMS.map((item) => (
        <NavRow
          key={item.mode}
          icon={item.icon}
          label={item.label}
          active={rootMode === item.mode}
          onClick={() => { onGotoHub(item.mode); onNavigate(); }}
        />
      ))}
    </nav>
  );
}

/**
 * The community switcher, with its delete confirm. Rendered twice (sidebar and
 * sheet), so it owns its open state rather than sharing one hidden elsewhere.
 * The trigger is labelled "Active community" because that is what it shows, and
 * the menu is a listbox so a screen reader reads the choices as a set.
 */
function CommunitySwitcher(props: {
  communities: Community[];
  active: Community | null;
  onSelect: (id: Id) => void;
  onDelete: (id: Id) => void;
  deleteWarning: (id: Id) => string;
  onToggleAddCommunity: () => void;
  onNavigate: () => void;
}) {
  const [showCommunityMenu, setShowCommunityMenu] = useState(false);
  const { active } = props;
  return (
    <div className="squad-switcher">
      <div className="squad-dropdown">
        <button
          type="button"
          className="squad-select"
          onClick={() => setShowCommunityMenu((s) => !s)}
          aria-haspopup="listbox"
          aria-expanded={showCommunityMenu}
          aria-label="Active community"
        >
          <span className="squad-select-value">{active?.name ?? "— No community —"}</span>
          <span className="squad-select-caret" aria-hidden="true"><Icon name="caret" /></span>
        </button>
        {showCommunityMenu && (
          <>
            <div className="squad-menu-backdrop" onClick={() => setShowCommunityMenu(false)} />
            <div className="squad-menu">
              <div className="squad-menu-heading">Community</div>
              <ul className="squad-menu-list" role="listbox" aria-label="Communities">
                {props.communities.map((c) => {
                  const isActive = active?.id === c.id;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="squad-menu-item"
                        onClick={() => { props.onSelect(c.id); setShowCommunityMenu(false); }}
                        role="option"
                        aria-selected={isActive}
                      >
                        <span className="squad-menu-name">{c.name}</span>
                        {isActive && <span className="squad-menu-check" aria-hidden="true"><Icon name="check" /></span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {active && props.communities.length > 1 && (
                <div className="squad-menu-footer">
                  <ConfirmButton
                    className="squad-menu-danger"
                    label={`Delete ${active.name}`}
                    confirmLabel="Delete"
                    message={`Delete "${active.name}"?${props.deleteWarning(active.id)}`}
                    onConfirm={() => {
                      setShowCommunityMenu(false);
                      void props.onDelete(active.id);
                    }}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <button
        type="button"
        className="icon-btn"
        aria-label="New community"
        title="New community"
        onClick={() => { props.onToggleAddCommunity(); props.onNavigate(); }}
      >
        <Icon name="plus" />
      </button>
    </div>
  );
}

/**
 * The shell around every screen: skip link, the Open-plane sidebar (product,
 * community switcher, five destinations, utilities), the phone's 48px top bar
 * with its full-screen menu sheet, the handheld tab bar, the live region, and the
 * assistant's balloon. It owns the two things that open and close inside the
 * chrome, the phone menu sheet and the assistant panel, and nothing outside the
 * chrome reads either.
 */
export function AppChrome(props: AppChromeProps) {
  const { railPref, viewStack, activeCommunity, communityDeleteWarning } = props;
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const rootMode = viewStack[0].mode;
  const view = viewStack[viewStack.length - 1];

  // A sheet that covers the screen has to be a real dialog: Escape closes it,
  // and focus starts inside it rather than on whatever the scroll happened to
  // leave behind.
  useEffect(() => {
    if (!sheetOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);


  const closeSheet = () => setSheetOpen(false);
  const switcherProps = {
    communities: props.communities,
    active: activeCommunity,
    onSelect: props.onSelectCommunity,
    onDelete: props.onDeleteCommunity,
    deleteWarning: communityDeleteWarning,
    onToggleAddCommunity: props.onToggleAddCommunity,
  };

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>

      <aside className="rail" aria-label="Primary">
        <div className="rail-head"><Brand /></div>

        <CommunitySwitcher {...switcherProps} onNavigate={closeSheet} />

        <NavRows navId="rail-screens" rootMode={rootMode} onGotoHub={props.onGotoHub} onNavigate={closeSheet} />

        <div className="rail-foot">
          <NavRow
            icon={SETTINGS_ITEM.icon}
            label={SETTINGS_ITEM.label}
            active={rootMode === SETTINGS_ITEM.mode}
            onClick={() => props.onGotoHub(SETTINGS_ITEM.mode)}
          />
          <button
            type="button"
            className="rail-link rail-utility"
            onClick={props.onToggleRail}
            aria-expanded={railPref === "expanded"}
            aria-controls="rail-screens"
            aria-label={railPref === "collapsed" ? "Show menu labels" : "Hide menu labels"}
          >
            <span className="nav-icon"><Icon name="panel" /></span>
            <span className="rail-link-label">Hide labels</span>
          </button>
        </div>
      </aside>

      <div className="shell">
        <header className="topbar-wrap">
          <div className="topbar">
            <span className="topbar-title">{screenTitle(view)}</span>
            <button
              type="button"
              className="topbar-menu"
              onClick={() => setSheetOpen((s) => !s)}
              aria-expanded={sheetOpen}
              aria-controls="phone-menu"
            >
              <span className="nav-icon"><Icon name="menu" /></span>
              <span>Menu</span>
            </button>
          </div>
        </header>

        <main id="main" className="shell-main">
          {props.children}
        </main>
      </div>

      <Toasts toasts={props.toasts} />
      <AiAssistant />
      <nav className="bottom-nav" aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const isActive = rootMode === item.mode;
          return (
            <button
              key={item.mode}
              type="button"
              className={`nav-link ${isActive ? "nav-active" : ""}`}
              onClick={() => props.onGotoHub(item.mode)}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="nav-icon" aria-hidden="true"><Icon name={item.icon} /></span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {sheetOpen && (
        <div className="menu-sheet" id="phone-menu" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="menu-sheet-head">
            <Brand />
            <button ref={closeRef} type="button" className="menu-sheet-close" onClick={closeSheet} aria-label="Close menu">
              <Icon name="close" />
            </button>
          </div>

          <CommunitySwitcher {...switcherProps} onNavigate={closeSheet} />

          <NavRows rootMode={rootMode} onGotoHub={props.onGotoHub} onNavigate={closeSheet} />

          <div className="menu-sheet-foot">
            <NavRow
              icon={SETTINGS_ITEM.icon}
              label={SETTINGS_ITEM.label}
              active={rootMode === SETTINGS_ITEM.mode}
              onClick={() => { props.onGotoHub(SETTINGS_ITEM.mode); closeSheet(); }}
            />
          </div>
        </div>
      )}
    </>
  );
}
