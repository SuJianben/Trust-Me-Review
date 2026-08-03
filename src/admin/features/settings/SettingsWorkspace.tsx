import { useState } from "react";
import type { AuthenticatedRequest } from "../../api";
import { ProductManagementPanel } from "./ProductManagementPanel";
import { EmailTemplatesPanel } from "./EmailTemplatesPanel";
import { RequestSchedulingPanel } from "./RequestSchedulingPanel";
import { ReviewRequestsPanel } from "./ReviewRequestsPanel";
import { SettingsNavigation } from "./SettingsNavigation";
import { SettingsPanel } from "./SettingsPanel";
import type { SettingsSection } from "./types";
import { ProductDetailPanel } from "../products/ProductDetailPanel";
import "./settings.css";

type SettingsWorkspaceProps = {
  request: AuthenticatedRequest;
  onError: (message: string) => void;
  onClearError?: () => void;
  productId?: string;
};

export function SettingsWorkspace({ request, onError, onClearError = () => undefined, productId }: SettingsWorkspaceProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>(() => productId || new URLSearchParams(location.search).get("section") === "product-management" ? "product-management" : "review-requests");
  const [showProductDetail, setShowProductDetail] = useState(Boolean(productId));

  const selectSection = (section: SettingsSection) => {
    setActiveSection(section);
    setShowProductDetail(false);
  };

  return (
    <div className="tmr-settings-workspace">
      <SettingsNavigation activeSection={activeSection} onSelect={selectSection} />
      {showProductDetail && productId ? (
        <ProductDetailPanel productId={productId} request={request} onError={onError} onClearError={onClearError} />
      ) : activeSection === "review-requests" ? (
        <ReviewRequestsPanel request={request} onError={onError} />
      ) : activeSection === "request-scheduling" ? (
        <RequestSchedulingPanel request={request} onError={onError} />
      ) : activeSection === "templates" ? (
        <EmailTemplatesPanel request={request} onError={onError} />
      ) : activeSection === "product-management" ? (
        <ProductManagementPanel request={request} onError={onError} />
      ) : (
        <SettingsPanel request={request} onError={onError} section={activeSection} />
      )}
    </div>
  );
}
