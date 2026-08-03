import { Button, Card, DataTable, Text } from "@shopify/polaris";
import { useCallback, useEffect, useState } from "react";
import type { AuthenticatedRequest } from "../../api";

type TestDelivery = {
  id: string;
  shopify_order_id: string;
  shopify_product_id: string;
  status: string;
  scheduled_at: string;
  sent_at: string | null;
  attempt_count: number;
  failure_reason: string | null;
  test_email_payload: { reviewUrl?: string; note?: string } | null;
};

type Props = {
  request: AuthenticatedRequest;
  onError: (message: string) => void;
};

function formattedDate(value: string | null) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
}

export function TestDeliveriesPanel({ request, onError }: Props) {
  const [deliveries, setDeliveries] = useState<TestDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState("");

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
  const processDueDeliveries = async () => {
    setProcessing(true);
    setNotice("");
    try {
      const result = await request<{ queued: number }>("/api/admin/test-deliveries/process-due", { method: "POST" });
      setNotice(result.queued ? `Queued ${result.queued} due test delivery. Refresh in a moment to get the review link.` : "There are no due test deliveries to run.");
    } catch (issue) {
      onError((issue as Error).message);
    } finally {
      setProcessing(false);
    }
  };
  const retry = async (id: string) => {
    try {
      await request(`/api/admin/test-deliveries/${id}/retry`, { method: "POST" });
      setNotice("The failed test delivery was queued again. Refresh in a moment to check its status.");
      await load();
    } catch (issue) {
      onError((issue as Error).message);
    }
  };
  const rows = deliveries.map((delivery) => [
    delivery.shopify_order_id,
    delivery.shopify_product_id,
    delivery.status,
    formattedDate(delivery.scheduled_at),
    formattedDate(delivery.sent_at),
    delivery.failure_reason ? `${delivery.failure_reason} (attempts: ${delivery.attempt_count})` : "—",
    delivery.test_email_payload?.reviewUrl ? <Button size="slim" url={delivery.test_email_payload.reviewUrl} target="_blank">Open review link</Button> : "—",
    delivery.status === "failed" ? <Button size="slim" onClick={() => void retry(delivery.id)}>Retry</Button> : "—",
  ]);

  return <Card>
    <div className="tmr-section-heading">
      <div className="tmr-panel-note"><Text as="h2" variant="headingLg">Test delivery records</Text><Text as="p" tone="subdued">V1 records a test invitation and secure review link. It does not send a real customer email.</Text></div>
      <div style={{ display: "flex", gap: 8 }}><Button onClick={() => void processDueDeliveries()} loading={processing}>Run due deliveries</Button><Button onClick={() => void load()} loading={loading}>Refresh</Button></div>
    </div>
    {notice && <Text as="p">{notice}</Text>}
    <DataTable columnContentTypes={["text", "text", "text", "text", "text", "text", "text", "text"]} headings={["Order", "Product", "Status", "Scheduled", "Sent", "Last issue", "Review link", "Actions"]} rows={rows} />
    {!loading && !rows.length && <Text as="p">No test deliveries yet. Fulfill a development-store order after setting the delay to 0 days.</Text>}
  </Card>;
}
