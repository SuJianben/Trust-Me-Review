import { Banner, Button, Card, Select, Text, TextField } from "@shopify/polaris";
import type { AuthenticatedRequest } from "../../api";
import { RequestBlocklistPanel } from "./RequestBlocklistPanel";
import { useShopSettings } from "./useShopSettings";
import "./review-requests.css";

type Props = { request: AuthenticatedRequest; onError: (message: string) => void };

export function RequestSchedulingPanel({ request, onError }: Props) {
  const { settings, setSettings, loading, saving, saved, save } = useShopSettings({ request, onError });
  return <div className="tmr-settings-content">
    <div className="tmr-settings-content-heading"><div><Text as="h1" variant="headingLg">Request scheduling</Text><Text as="p" tone="subdued">Control when fulfilled orders create test review invitations.</Text></div></div>
    <Card>
      <div className="tmr-schedule-section-heading"><Text as="h2" variant="headingMd">Timing</Text><Text as="p" tone="subdued">Create invitations after an order is fulfilled. The same timing applies to all order types in V1.</Text></div>
      {saved && <Banner tone="success">Request schedule saved.</Banner>}
      <div className="tmr-schedule-form-grid"><TextField label="Delay after fulfillment (days)" type="number" min={0} max={90} value={String(settings.request_delay_days)} onChange={(value) => setSettings((current) => ({ ...current, request_delay_days: Math.min(90, Math.max(0, Number(value) || 0)) }))} autoComplete="off" helpText="Use 0 in the development store to make a request due immediately after fulfillment." disabled={loading} /></div>
      <div className="tmr-schedule-rule-separator" />
      <div className="tmr-schedule-section-heading"><Text as="h2" variant="headingMd">Multi-product orders</Text><Text as="p" tone="subdued">Limit how many product invitations an order can create and spread them out over time.</Text></div>
      <div className="tmr-schedule-form-grid tmr-schedule-form-grid-three">
        <TextField label="Maximum products per order" type="number" min={1} max={10} value={String(settings.max_products_per_order)} onChange={(value) => setSettings((current) => ({ ...current, max_products_per_order: Math.min(10, Math.max(1, Number(value) || 1)) }))} autoComplete="off" disabled={loading} />
        <Select label="Select products" options={[{ label: "Highest-priced products first", value: "highest_price" }, { label: "Keep Shopify order item order", value: "all_items" }]} value={settings.product_selection_strategy} onChange={(value) => setSettings((current) => ({ ...current, product_selection_strategy: value as typeof current.product_selection_strategy }))} disabled={loading} />
        <TextField label="Days between invitations" type="number" min={0} max={90} value={String(settings.request_spacing_days)} onChange={(value) => setSettings((current) => ({ ...current, request_spacing_days: Math.min(90, Math.max(0, Number(value) || 0)) }))} autoComplete="off" helpText="Use 0 to schedule selected items on the same day." disabled={loading} />
      </div>
      <div className="tmr-schedule-rule-separator" />
      <div className="tmr-schedule-section-heading"><Text as="h2" variant="headingMd">Customer request limit</Text><Text as="p" tone="subdued">Prevent the same customer from being invited too often across different orders.</Text></div>
      <div className="tmr-schedule-form-grid"><TextField label="Minimum days between requests to the same customer" type="number" min={0} max={365} value={String(settings.customer_request_cooldown_days)} onChange={(value) => setSettings((current) => ({ ...current, customer_request_cooldown_days: Math.min(365, Math.max(0, Number(value) || 0)) }))} autoComplete="off" helpText="Use 0 for no limit. The default is 30 days." disabled={loading} /></div>
      <Button variant="primary" loading={saving} disabled={loading} onClick={() => void save()}>Save schedule</Button>
    </Card>
    <Card><RequestBlocklistPanel request={request} onError={onError} /></Card>
  </div>;
}
