import { Button, Card, DataTable, Text } from "@shopify/polaris";
import { useCallback, useEffect, useState } from "react";

type TestDelivery = {
  id: string;
  shopify_order_id: string;
  shopify_product_id: string;
  status: string;
  scheduled_at: string;
  sent_at: string | null;
  test_email_payload: { reviewUrl?: string; note?: string } | null;
};

type Props = {
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  onError: (message: string) => void;
};

function formattedDate(value: string | null) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
}

export function TestDeliveriesPanel({ request, onError }: Props) {
  const [deliveries, setDeliveries] = useState<TestDelivery[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDeliveries(await request<TestDelivery[]>("/api/admin/test-deliveries"));
    } catch (issue) {
      onError((issue as Error).message);
    } finally {
      setLoading(false);
    }
  }, [onError, request]);

  useEffect(() => { void load(); }, [load]);
  const rows = deliveries.map((delivery) => [
    delivery.shopify_order_id,
    delivery.shopify_product_id,
    delivery.status,
    formattedDate(delivery.scheduled_at),
    formattedDate(delivery.sent_at),
    delivery.test_email_payload?.reviewUrl ? <Button size="slim" url={delivery.test_email_payload.reviewUrl} target="_blank">Open review link</Button> : "—",
  ]);

  return <Card>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 16 }}>
      <div><Text as="h2" variant="headingMd">Test deliveries</Text><Text as="p" tone="subdued">V1 records a test invitation here and does not send a real customer email.</Text></div>
      <Button onClick={() => void load()} loading={loading}>Refresh</Button>
    </div>
    <DataTable columnContentTypes={["text", "text", "text", "text", "text", "text"]} headings={["Order", "Product", "Status", "Scheduled", "Sent", "Review link"]} rows={rows} />
    {!loading && !rows.length && <Text as="p">No test deliveries yet. Fulfill a development-store order after setting the delay to 0 days.</Text>}
  </Card>;
}
