import { Badge, Button, Card, Text } from "@shopify/polaris";
import { useCallback, useEffect, useState } from "react";
import type { AuthenticatedRequest } from "../../api";
import type { ManagedProduct } from "./types";

type ProductManagementPanelProps = {
  request: AuthenticatedRequest;
  onError: (message: string) => void;
};

function lastActivity(value: string | null) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)) : "No reviews yet";
}

export function ProductManagementPanel({ request, onError }: ProductManagementPanelProps) {
  const [products, setProducts] = useState<ManagedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProducts(await request<ManagedProduct[]>("/api/admin/products"));
    } catch (issue) {
      onError((issue as Error).message);
    } finally {
      setLoading(false);
    }
  }, [onError, request]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="tmr-settings-content" aria-busy={loading}>
      <div className="tmr-settings-content-heading">
        <div>
          <Text as="h1" variant="headingLg">Product management</Text>
          <Text as="p" tone="subdued">Review activity for products that have been seen by Trust Me Review.</Text>
        </div>
        <Button loading={loading} onClick={() => void load()}>Refresh</Button>
      </div>

      <Card padding="0">
        <div className="tmr-product-table" role="table" aria-label="Products with review activity">
          <div className="tmr-product-table-head" role="row">
            <span>Product</span><span>Reviews</span><span>Rating</span><span>Invitations</span><span>Last activity</span><span />
          </div>
          {products.map((product) => (
            <div className="tmr-product-table-row" role="row" key={product.shopify_product_id}>
              <div><Text as="p" fontWeight="semibold">{product.title_snapshot || `Product #${product.shopify_product_id}`}</Text><Text as="p" tone="subdued">Shopify product #{product.shopify_product_id}</Text></div>
              <div><Text as="p">{product.review_count}</Text>{product.pending_count > 0 && <Badge tone="attention">{`${product.pending_count} pending`}</Badge>}</div>
              <Text as="p">{product.average_rating ? `${product.average_rating.toFixed(1)} / 5` : "—"}</Text>
              <Text as="p">{product.invitation_count}</Text>
              <Text as="p" tone="subdued">{lastActivity(product.last_reviewed_at)}</Text>
              <Button size="slim" url={`/reviews?product=${encodeURIComponent(product.shopify_product_id)}`}>View reviews</Button>
            </div>
          ))}
          {!loading && !products.length && <div className="tmr-settings-empty"><Text as="p">No products have review activity yet.</Text></div>}
        </div>
      </Card>
    </div>
  );
}
