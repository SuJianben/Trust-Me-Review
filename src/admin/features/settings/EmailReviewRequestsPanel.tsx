import { Banner, Button, Card, Checkbox, Text } from "@shopify/polaris";
import type { AuthenticatedRequest } from "../../api";
import { TestDeliveriesPanel } from "../deliveries/TestDeliveriesPanel";
import { useShopSettings } from "./useShopSettings";
import "./review-requests.css";

type Props = {
  request: AuthenticatedRequest;
  onError: (message: string) => void;
  onBack: () => void;
};

export function EmailReviewRequestsPanel({ request, onError, onBack }: Props) {
  const { settings, setSettings, loading, saving, saved, save } = useShopSettings({ request, onError });

  return <div className="tmr-settings-content">
    <div className="tmr-settings-content-heading tmr-email-requests-heading">
      <div>
        <Button variant="plain" onClick={onBack}>← Review requests</Button>
        <Text as="h1" variant="headingLg">Manage email review requests</Text>
        <Text as="p" tone="subdued">Control automatic invitations and inspect test delivery records.</Text>
      </div>
    </div>
    <Card>
      <div className="tmr-settings-form-heading">
        <Text as="h2" variant="headingMd">Automatic requests</Text>
        <Text as="p" tone="subdued">When enabled, each fulfilled order can create one invitation containing a review link for every eligible product.</Text>
      </div>
      {saved && <Banner tone="success">Email review request settings saved.</Banner>}
      <div className="tmr-settings-form-control">
        <Checkbox label="Enable automatic email review requests" checked={settings.request_enabled} disabled={loading} onChange={(value) => setSettings((current) => ({ ...current, request_enabled: value }))} />
      </div>
      <Button variant="primary" loading={saving} disabled={loading} onClick={() => void save()}>Save email request setting</Button>
    </Card>
    <TestDeliveriesPanel request={request} onError={onError} />
  </div>;
}
