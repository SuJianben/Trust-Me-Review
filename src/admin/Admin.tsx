import { AppProvider, Banner, Layout, Page, Tabs, Text } from "@shopify/polaris";
import { useCallback, useState } from "react";
import { useAuthenticatedApi } from "./api";
import "./product-management.css";
import { ProductNavigation } from "./components/ProductNavigation";
import { TestDeliveriesPanel } from "./features/deliveries/TestDeliveriesPanel";
import { ProductDetailPanel } from "./features/products/ProductDetailPanel";
import { ProductManagementPanel } from "./features/products/ProductManagementPanel";
import { ReviewsPanel } from "./features/reviews/ReviewsPanel";
import { SettingsPanel } from "./features/settings/SettingsPanel";

type WorkspaceView = "reviews" | "products" | "product-detail";

const tabs = [
  { id: "reviews", content: "Reviews" },
  { id: "deliveries", content: "Review requests" },
  { id: "settings", content: "Settings" },
];

export function Admin() {
  const [tab, setTab] = useState(0);
  const [view, setView] = useState<WorkspaceView>("reviews");
  const [productId, setProductId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const request = useAuthenticatedApi();
  const clearError = useCallback(() => setError(""), []);

  const openProduct = useCallback((id: string) => {
    setTab(0);
    setProductId(id);
    setView("product-detail");
  }, []);

  const openReviews = useCallback(() => {
    setTab(0);
    setView("reviews");
  }, []);

  const openProducts = useCallback(() => {
    setTab(0);
    setView("products");
  }, []);

  const selectTab = useCallback((index: number) => {
    setTab(index);
    if (index === 0) setView("reviews");
  }, []);

  return (
    <AppProvider i18n={{}}>
      <div className="tmr-admin-shell">
        <Page>
          <header className="tmr-app-header">
            <div>
              <div className="tmr-app-kicker">TRUST ME REVIEW</div>
              <div className="tmr-app-title">
                <span className="tmr-app-mark">T</span>
                <Text as="h1" variant="headingLg">Trust Me Review</Text>
              </div>
            </div>
            <Text as="p" tone="subdued">Review management</Text>
          </header>

          <Layout>
            <Layout.Section>
              <div className="tmr-app-tabs"><Tabs tabs={tabs} selected={tab} onSelect={selectTab} /></div>
            </Layout.Section>
            {error && <Layout.Section><Banner tone="critical" onDismiss={clearError}>{error}</Banner></Layout.Section>}
            {tab === 0 && (
              <Layout.Section>
                <div className="tmr-workspace-layout">
                  <ProductNavigation
                    active={view === "reviews" ? "reviews" : "products"}
                    onProducts={openProducts}
                    onReviews={openReviews}
                  />
                  <main className="tmr-workspace-main">
                    {view === "reviews" && (
                      <ReviewsPanel
                        request={request}
                        onClearError={clearError}
                        onError={setError}
                        onOpenProduct={openProduct}
                      />
                    )}
                    {view === "products" && (
                      <ProductManagementPanel request={request} onError={setError} onOpenProduct={openProduct} />
                    )}
                    {view === "product-detail" && productId && (
                      <ProductDetailPanel
                        productId={productId}
                        request={request}
                        onBack={openProducts}
                        onError={setError}
                      />
                    )}
                  </main>
                </div>
              </Layout.Section>
            )}
            {tab === 1 && <Layout.Section><TestDeliveriesPanel request={request} onError={setError} /></Layout.Section>}
            {tab === 2 && <Layout.Section><SettingsPanel request={request} onError={setError} /></Layout.Section>}
          </Layout>
        </Page>
      </div>
    </AppProvider>
  );
}
