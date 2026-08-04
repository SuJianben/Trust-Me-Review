export type TestDeliveryProductView = {
  shopify_product_id: string;
  title_snapshot: string;
  reviewUrl?: string;
};

export type TestDeliveryView = {
  id: string;
  shopify_order_id: string;
  status: string;
  scheduled_at: string;
  sent_at: string | null;
  attempt_count: number;
  failure_reason: string | null;
  test_email_payload: {
    mode?: string;
    reviewUrl?: string;
    reviewUrls?: Array<{ requestId?: string; productId?: string; productTitle?: string; reviewUrl?: string }>;
    note?: string;
  } | null;
  products: TestDeliveryProductView[];
};

type RawTestDeliveryRow = {
  id: string;
  shopify_order_id: string;
  status: string;
  scheduled_at: string;
  sent_at: string | null;
  attempt_count: number;
  failure_reason: string | null;
  test_email_payload: TestDeliveryView["test_email_payload"] | string | null;
  shopify_product_id: string;
  title_snapshot: string;
};

function readPayload(value: RawTestDeliveryRow["test_email_payload"] | undefined): NonNullable<TestDeliveryView["test_email_payload"]> | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as NonNullable<TestDeliveryView["test_email_payload"]>;
    } catch {
      return null;
    }
  }
  return value;
}

function statusPriority(status: string) {
  if (status === "failed") return 5;
  if (status === "scheduled") return 4;
  if (status === "submitted") return 3;
  if (status === "sent") return 2;
  return 1;
}

function selectOrderStatus(rows: RawTestDeliveryRow[]) {
  return rows.reduce((current, row) => statusPriority(row.status) > statusPriority(current) ? row.status : current, rows[0]?.status ?? "scheduled");
}

function earliestDate(rows: RawTestDeliveryRow[], key: "scheduled_at") {
  return rows.map((row) => row[key]).sort()[0] ?? "";
}

function latestDate(rows: RawTestDeliveryRow[], key: "sent_at") {
  return rows.map((row) => row[key]).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
}

/** Convert product-level database rows into one order-level admin delivery record. */
export function groupTestDeliveryRows(rows: RawTestDeliveryRow[]): TestDeliveryView[] {
  const grouped = new Map<string, RawTestDeliveryRow[]>();
  for (const row of rows) {
    const existing = grouped.get(row.shopify_order_id) ?? [];
    existing.push(row);
    grouped.set(row.shopify_order_id, existing);
  }

  return [...grouped.values()].map((orderRows) => {
    const first = orderRows[0];
    const products = new Map<string, TestDeliveryProductView>();
    for (const row of orderRows) {
      const payload = readPayload(row.test_email_payload);
      const link = payload?.reviewUrls?.find((candidate) => candidate.productId === row.shopify_product_id)?.reviewUrl
        ?? (payload?.reviewUrls?.length === 1 ? payload.reviewUrls[0].reviewUrl : undefined)
        ?? payload?.reviewUrl;
      if (!products.has(row.shopify_product_id)) {
        products.set(row.shopify_product_id, { shopify_product_id: row.shopify_product_id, title_snapshot: row.title_snapshot, reviewUrl: link });
      } else if (!products.get(row.shopify_product_id)?.reviewUrl && link) {
        products.get(row.shopify_product_id)!.reviewUrl = link;
      }
    }
    const payload = readPayload(orderRows.find((row) => row.test_email_payload)?.test_email_payload);
    return {
      id: first.id,
      shopify_order_id: first.shopify_order_id,
      status: selectOrderStatus(orderRows),
      scheduled_at: earliestDate(orderRows, "scheduled_at"),
      sent_at: latestDate(orderRows, "sent_at"),
      attempt_count: Math.max(...orderRows.map((row) => row.attempt_count)),
      failure_reason: orderRows.find((row) => row.failure_reason)?.failure_reason ?? null,
      test_email_payload: payload,
      products: [...products.values()],
    };
  });
}
