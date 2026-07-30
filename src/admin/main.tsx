import "@shopify/polaris/build/esm/styles.css";
import "./admin.css";
import { createRoot } from "react-dom/client";
import { Admin } from "./Admin";
import { InvitationReviewPage } from "../invitations/InvitationReviewPage";
createRoot(document.getElementById("root")!).render(location.pathname.startsWith("/review/") ? <InvitationReviewPage token={location.pathname.split("/").pop() ?? ""} /> : <Admin/>);
