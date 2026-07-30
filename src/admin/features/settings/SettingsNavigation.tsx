import type { SettingsSection } from "./types";

type SettingsNavigationProps = {
  activeSection: SettingsSection;
  onSelect: (section: SettingsSection) => void;
};

type NavigationItem = {
  label: string;
  section?: SettingsSection;
};

const sections: Array<{ heading: string; items: NavigationItem[] }> = [
  {
    heading: "REVIEW COLLECTION",
    items: [
      { label: "Import reviews" },
      { label: "Review requests", section: "requests" },
      { label: "Request scheduling", section: "requests" },
      { label: "Email templates", section: "templates" },
      { label: "Product management", section: "product-management" },
      { label: "Bundles" },
      { label: "Collection flow" },
      { label: "Publishing and moderation" },
    ],
  },
  {
    heading: "REVIEW DISPLAY",
    items: [
      { label: "Storefront display", section: "display" },
      { label: "Widgets" },
      { label: "Product groups" },
      { label: "Social sharing" },
    ],
  },
  {
    heading: "GENERAL",
    items: [
      { label: "Language & notifications", section: "language" },
      { label: "Advanced" },
    ],
  },
];

export function SettingsNavigation({ activeSection, onSelect }: SettingsNavigationProps) {
  return (
    <aside className="tmr-settings-nav" aria-label="Settings navigation">
      {sections.map((group) => (
        <section className="tmr-settings-nav-group" key={group.heading}>
          <p>{group.heading}</p>
          {group.items.map((item) => item.section ? (
            <button
              className={activeSection === item.section ? "is-active" : ""}
              key={item.label}
              onClick={() => onSelect(item.section!)}
              type="button"
            >
              {item.label}
            </button>
          ) : <span key={item.label}>{item.label}</span>)}
        </section>
      ))}
    </aside>
  );
}
