import { useEffect, useRef, useState } from "react";
import type { Community, Id } from "../domain/types";
import type { HubMode, View } from "./useNavigation";
import { NAV_ITEMS, SETTINGS_ITEM, screenTitle } from "./nav-items";
import type { IconName } from "./nav-items";
import { Toasts } from "../ui/Toasts";
import { ConfirmButton } from "../ui/ConfirmButton";
import { Icon } from "../ui/Icon";
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
