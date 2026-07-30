import { AppProvider, Banner, Layout, Page, Text } from "@shopify/polaris";
import { useCallback, useState } from "react";
import { useAuthenticatedApi } from "./api";
import "./dashboard.css";
import { AppNavigation } from "./components/AppNavigation";
import { DashboardPanel } from "./features/dashboard/DashboardPanel";
import { ReviewsWorkspace } from "./features/reviews/ReviewsWorkspace";
import { SettingsWorkspace } from "./features/settings/SettingsWorkspace";

type AppPage = "dashboard" | "reviews" | "settings";

function currentPage(): AppPage {
  if (location.pathname === "/reviews") return "reviews";
  if (location.pathname === "/settings") return "settings";
  return "dashboard";
}

export function Admin() {
  const [error, setError] = useState("");
  const request = useAuthenticatedApi();
  const clearError = useCallback(() => setError(""), []);
  const page = currentPage();

  return (
    <AppProvider i18n={{}}>
      <AppNavigation />
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
            {error && <Layout.Section><Banner tone="critical" onDismiss={clearError}>{error}</Banner></Layout.Section>}
            {page === "dashboard" && <Layout.Section><DashboardPanel request={request} onError={setError} /></Layout.Section>}
            {page === "reviews" && <Layout.Section><ReviewsWorkspace request={request} onError={setError} onClearError={clearError} /></Layout.Section>}
            {page === "settings" && <Layout.Section><SettingsWorkspace request={request} onError={setError} /></Layout.Section>}
          </Layout>
        </Page>
      </div>
    </AppProvider>
  );
}
