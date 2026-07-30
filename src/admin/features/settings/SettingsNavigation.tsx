import { useMemo, useState } from "react";
import type { SettingsSection } from "./types";

type SettingsNavigationProps = { activeSection: SettingsSection; onSelect: (section: SettingsSection) => void };
type NavigationItem = { label: string; icon: string; section?: SettingsSection };

const sections: Array<{ heading: string; items: NavigationItem[] }> = [
  { heading: "REVIEW COLLECTION", items: [
    { label: "Import reviews", icon: "↓" }, { label: "Review requests", icon: "➤", section: "review-requests" },
    { label: "Request scheduling", icon: "◷", section: "request-scheduling" }, { label: "Email templates", icon: "✉", section: "templates" },
    { label: "Product management", icon: "◇", section: "product-management" }, { label: "Bundles", icon: "♙" },
    { label: "Collection flow", icon: "⇄" }, { label: "Optimize collection", icon: "✦" }, { label: "Publishing and moderation", icon: "♧" },
  ] },
  { heading: "REVIEW DISPLAY", items: [
    { label: "Storefront display", icon: "▣", section: "display" }, { label: "Widgets", icon: "☆" },
    { label: "Product groups", icon: "⌁" }, { label: "Social sharing", icon: "◌" }, { label: "Google, SEO and AI", icon: "▤" },
  ] },
  { heading: "DISCOUNT AND REWARDS", items: [{ label: "Coupons", icon: "✿" }, { label: "Referrals", icon: "⌘" }] },
  { heading: "INTEGRATIONS", items: [{ label: "Integrations", icon: "⌁" }] },
  { heading: "GENERAL", items: [
    { label: "Plan", icon: "⌂" }, { label: "Branding", icon: "✎" },
    { label: "Language & notifications", icon: "☼", section: "language" }, { label: "Advanced", icon: "⚙" },
  ] },
];

export function SettingsNavigation({ activeSection, onSelect }: SettingsNavigationProps) {
  const [query, setQuery] = useState("");
  const visibleSections = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized ? sections.map((group) => ({ ...group, items: group.items.filter((item) => item.label.toLowerCase().includes(normalized)) })).filter((group) => group.items.length) : sections;
  }, [query]);

  return <aside className="tmr-settings-nav" aria-label="Settings navigation">
    <label className="tmr-settings-nav-search"><span>⌕</span><input onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search settings" value={query} /></label>
    {visibleSections.map((group) => <section className="tmr-settings-nav-group" key={group.heading}>
      <p>{group.heading}</p>
      {group.items.map((item) => item.section ? <button className={activeSection === item.section ? "is-active" : ""} key={item.label} onClick={() => onSelect(item.section!)} type="button"><span className="tmr-settings-nav-icon" aria-hidden="true">{item.icon}</span>{item.label}</button> : <span className="is-muted" key={item.label}><span className="tmr-settings-nav-icon" aria-hidden="true">{item.icon}</span>{item.label}</span>)}
    </section>)}
  </aside>;
}
