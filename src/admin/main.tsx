import "@shopify/polaris/build/esm/styles.css";
import { AppProvider, Card, Layout, Page, Tabs, Text } from "@shopify/polaris";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { useAuthenticatedApi } from "./api";
import { SettingsPanel } from "./features/settings/SettingsPanel";
import { TestDeliveriesPanel } from "./features/deliveries/TestDeliveriesPanel";
import { InvitationReviewPage } from "../invitations/InvitationReviewPage";
import { ReviewsPanel } from "./features/reviews/ReviewsPanel";

const copy = { en:{reviews:"Reviews",settings:"Settings",deliveries:"Test deliveries"}, zh:{reviews:"评价管理",settings:"设置",deliveries:"测试邀评"} };

function Admin() {
  const [language] = useState<"en"|"zh">("en"); const [tab,setTab]=useState(0); const [error,setError]=useState(""); const c=copy[language];
  const request=useAuthenticatedApi();
  return <AppProvider i18n={{}}><Page title="Trust Me Review" subtitle="Shopify review management"><Layout><Layout.Section><Tabs tabs={[{id:"reviews",content:c.reviews},{id:"settings",content:c.settings},{id:"deliveries",content:c.deliveries}]} selected={tab} onSelect={setTab}/></Layout.Section>{error&&<Layout.Section><Card><Text as="p" tone="critical">{error}</Text></Card></Layout.Section>}{tab===0&&<Layout.Section><ReviewsPanel request={request} onError={setError}/></Layout.Section>}{tab===1&&<Layout.Section><SettingsPanel request={request} onError={setError}/></Layout.Section>}{tab===2&&<Layout.Section><TestDeliveriesPanel request={request} onError={setError}/></Layout.Section>}</Layout></Page></AppProvider>;
}
createRoot(document.getElementById("root")!).render(location.pathname.startsWith("/review/") ? <InvitationReviewPage token={location.pathname.split("/").pop() ?? ""} /> : <Admin/>);
