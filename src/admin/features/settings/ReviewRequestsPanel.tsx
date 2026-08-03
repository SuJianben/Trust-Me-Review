import { Banner, Button, Card, Checkbox, Text } from "@shopify/polaris";
import type { AuthenticatedRequest } from "../../api";
import { TestDeliveriesPanel } from "../deliveries/TestDeliveriesPanel";
import { useShopSettings } from "./useShopSettings";

type Props = {
  request: AuthenticatedRequest;
  onError: (message: string) => void;
};

export function ReviewRequestsPanel({ request, onError }: Props) {
  const { settings, setSettings, loading, saving, saved, save } = useShopSettings({ request, onError });

  return (
    <div className="tmr-settings-content">
      <div className="tmr-settings-content-heading">
        <div>
          <Text as="h1" variant="headingLg">Review requests</Text>
          <Text as="p" tone="subdued">Manage the test review invitations created after an order is fulfilled.</Text>
        </div>
      </div>

      <Card>
        <div className="tmr-settings-form-heading">
          <Text as="h2" variant="headingMd">Automatic requests</Text>
          <Text as="p" tone="subdued">When enabled, fulfilled orders can create one review request for each eligible product.</Text>
        </div>
        {saved && <Banner tone="success">Review request settings saved.</Banner>}
        <div className="tmr-settings-form-control">
          <Checkbox label="Enable automatic review requests" checked={settings.request_enabled} disabled={loading} onChange={(value) => setSettings((current) => ({ ...current, request_enabled: value }))} />
        </div>
        <Button variant="primary" loading={saving} disabled={loading} onClick={() => void save()}>Save request setting</Button>
      </Card>

      <TestDeliveriesPanel request={request} onError={onError} />
    </div>
  );
}
