import { AppProvider, Banner, Layout, Page, Tabs, Text } from "@shopify/polaris";
import { useCallback, useState } from "react";
import { useAuthenticatedApi } from "./api";
import "./dashboard.css";
import { DashboardPanel } from "./features/dashboard/DashboardPanel";
import { TestDeliveriesPanel } from "./features/deliveries/TestDeliveriesPanel";
import { ReviewsPanel } from "./features/reviews/ReviewsPanel";
import { SettingsPanel } from "./features/settings/SettingsPanel";

const tabs = [
  { id: "dashboard", content: "Dashboard" },
  { id: "reviews", content: "Reviews" },
  { id: "deliveries", content: "Review requests" },
  { id: "settings", content: "Settings" },
];

export function Admin() {
  const [tab, setTab] = useState(0);
  const [error, setError] = useState("");
  const request = useAuthenticatedApi();
  const clearError = useCallback(() => setError(""), []);
  const openReviews = useCallback(() => setTab(1), []);
  const openDeliveries = useCallback(() => setTab(2), []);

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
              <div className="tmr-app-tabs"><Tabs tabs={tabs} selected={tab} onSelect={setTab} /></div>
            </Layout.Section>
            {error && <Layout.Section><Banner tone="critical" onDismiss={clearError}>{error}</Banner></Layout.Section>}
            {tab === 0 && <Layout.Section><DashboardPanel request={request} onError={setError} onOpenReviews={openReviews} onOpenDeliveries={openDeliveries} /></Layout.Section>}
            {tab === 1 && <Layout.Section><ReviewsPanel request={request} onError={setError} onClearError={clearError} /></Layout.Section>}
            {tab === 2 && <Layout.Section><TestDeliveriesPanel request={request} onError={setError} /></Layout.Section>}
            {tab === 3 && <Layout.Section><SettingsPanel request={request} onError={setError} /></Layout.Section>}
          </Layout>
        </Page>
      </div>
    </AppProvider>
  );
}
