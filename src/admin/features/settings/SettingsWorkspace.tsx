import { useState } from "react";
import type { AuthenticatedRequest } from "../../api";
import { ProductManagementPanel } from "./ProductManagementPanel";
import { SettingsNavigation } from "./SettingsNavigation";
import { SettingsPanel } from "./SettingsPanel";
import type { SettingsSection } from "./types";
import "./settings.css";

type SettingsWorkspaceProps = {
  request: AuthenticatedRequest;
  onError: (message: string) => void;
};

export function SettingsWorkspace({ request, onError }: SettingsWorkspaceProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("review-requests");

  return (
    <div className="tmr-settings-workspace">
      <SettingsNavigation activeSection={activeSection} onSelect={setActiveSection} />
      {activeSection === "product-management" ? (
        <ProductManagementPanel request={request} onError={onError} />
      ) : (
        <SettingsPanel request={request} onError={onError} section={activeSection} />
      )}
    </div>
  );
}
