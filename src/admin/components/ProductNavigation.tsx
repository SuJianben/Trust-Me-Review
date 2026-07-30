type ProductNavigationProps = {
  active: "reviews" | "products";
  onReviews: () => void;
  onProducts: () => void;
};

const navigationSections = [
  {
    title: "REVIEW COLLECTION",
    items: [
      "Import reviews",
      "Request reviews",
      "Request scheduling",
      "Email templates",
      "Product management",
      "Bundles",
      "Collection flow",
      "Optimize collection",
      "Publishing and moderation",
    ],
  },
  {
    title: "REVIEW DISPLAY",
    items: ["Widgets", "Product groups", "Social sharing", "Google, SEO and AI"],
  },
  {
    title: "DISCOUNT AND REWARDS",
    items: ["Coupons", "Referrals"],
  },
  {
    title: "INTEGRATIONS",
    items: ["Integrations"],
  },
  {
    title: "GENERAL",
    items: ["Plan", "Branding", "Language", "Admin notifications", "Advanced"],
  },
];

export function ProductNavigation({ active, onProducts, onReviews }: ProductNavigationProps) {
  return (
    <aside className="tmr-product-navigation" aria-label="Review tools">
      <div className="tmr-nav-search">⌕ <span>Search</span></div>
      {navigationSections.map((section) => (
        <section className="tmr-nav-section" key={section.title}>
          <h2>{section.title}</h2>
          {section.items.map((item) => {
            const isProducts = item === "Product management";
            const isReviews = item === "Publishing and moderation";
            const isActive = (isProducts && active === "products") || (isReviews && active === "reviews");

            if (isProducts || isReviews) {
              return (
                <button
                  className={isActive ? "is-active" : undefined}
                  key={item}
                  onClick={isProducts ? onProducts : onReviews}
                  type="button"
                >
                  {item}
                </button>
              );
            }

            return <span key={item}>{item}</span>;
          })}
        </section>
      ))}
    </aside>
  );
}
