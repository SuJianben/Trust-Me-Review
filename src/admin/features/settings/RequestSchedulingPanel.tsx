import { Banner, Button, Card, Text, TextField } from "@shopify/polaris";
import type { AuthenticatedRequest } from "../../api";
import { useShopSettings } from "./useShopSettings";

type Props = {
  request: AuthenticatedRequest;
  onError: (message: string) => void;
};

export function RequestSchedulingPanel({ request, onError }: Props) {
  const { settings, setSettings, loading, saving, saved, save } = useShopSettings({ request, onError });

  return (
    <div className="tmr-settings-content">
      <div className="tmr-settings-content-heading">
        <div>
          <Text as="h1" variant="headingLg">Request scheduling</Text>
          <Text as="p" tone="subdued">Choose when a fulfilled order becomes eligible for a test review invitation.</Text>
        </div>
      </div>

      <Card>
        <div className="tmr-settings-form-heading">
          <Text as="h2" variant="headingMd">Fulfillment delay</Text>
          <Text as="p" tone="subdued">The delay applies to all products that have review requests enabled.</Text>
        </div>
        {saved && <Banner tone="success">Request schedule saved.</Banner>}
        <div className="tmr-settings-form-control">
          <TextField label="Delay after fulfillment (days)" type="number" min={0} max={90} value={String(settings.request_delay_days)} onChange={(value) => setSettings((current) => ({ ...current, request_delay_days: Math.min(90, Math.max(0, Number(value) || 0)) }))} autoComplete="off" helpText="Use 0 in the development store to make a request due immediately after fulfillment." disabled={loading} />
        </div>
        <Button variant="primary" loading={saving} disabled={loading} onClick={() => void save()}>Save schedule</Button>
      </Card>
    </div>
  );
}
