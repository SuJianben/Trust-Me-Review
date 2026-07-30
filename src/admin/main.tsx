import "@shopify/polaris/build/esm/styles.css";
import "./admin.css";
import { AppProvider, Banner, Layout, Page, Tabs, Text } from "@shopify/polaris";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { useAuthenticatedApi } from "./api";
import { SettingsPanel } from "./features/settings/SettingsPanel";
import { TestDeliveriesPanel } from "./features/deliveries/TestDeliveriesPanel";
import { InvitationReviewPage } from "../invitations/InvitationReviewPage";
import { ReviewsPanel } from "./features/reviews/ReviewsPanel";

const copy = { en:{reviews:"Reviews",settings:"Settings",deliveries:"Review requests"}, zh:{reviews:"评价管理",settings:"设置",deliveries:"邀评任务"} };

function Admin() {
  const [language] = useState<"en"|"zh">("en"); const [tab,setTab]=useState(0); const [error,setError]=useState(""); const c=copy[language];
  const request=useAuthenticatedApi();
  return <AppProvider i18n={{}}><div className="tmr-admin-shell"><Page><header className="tmr-app-header"><div><div className="tmr-app-kicker">TRUST ME REVIEW</div><div className="tmr-app-title"><span className="tmr-app-mark">T</span><Text as="h1" variant="headingLg">Trust Me Review</Text></div></div><Text as="p" tone="subdued">Review management</Text></header><Layout><Layout.Section><div className="tmr-app-tabs"><Tabs tabs={[{id:"reviews",content:c.reviews},{id:"deliveries",content:c.deliveries},{id:"settings",content:c.settings}]} selected={tab} onSelect={setTab}/></div></Layout.Section>{error&&<Layout.Section><Banner tone="critical" onDismiss={()=>setError("")}>{error}</Banner></Layout.Section>}{tab===0&&<Layout.Section><ReviewsPanel request={request} onError={setError}/></Layout.Section>}{tab===1&&<Layout.Section><TestDeliveriesPanel request={request} onError={setError}/></Layout.Section>}{tab===2&&<Layout.Section><SettingsPanel request={request} onError={setError}/></Layout.Section>}</Layout></Page></div></AppProvider>;
}
createRoot(document.getElementById("root")!).render(location.pathname.startsWith("/review/") ? <InvitationReviewPage token={location.pathname.split("/").pop() ?? ""} /> : <Admin/>);
