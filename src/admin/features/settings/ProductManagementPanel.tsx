import { Badge, Button, Card, Text } from "@shopify/polaris";
import { useCallback, useEffect, useState } from "react";
import type { AuthenticatedRequest } from "../../api";
import type { ManagedProduct, ManagedProductList } from "./types";

type ProductFilter = "all" | "active" | "inactive";

type ProductManagementPanelProps = {
  request: AuthenticatedRequest;
  onError: (message: string) => void;
};

function lastActivity(value: string | null) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)) : "—";
}

function productLabel(product: ManagedProduct) {
  return product.title_snapshot || `Product #${product.shopify_product_id}`;
}

export function ProductManagementPanel({ request, onError }: ProductManagementPanelProps) {
  const [data, setData] = useState<ManagedProductList>({ products: [], total: 0, activeCount: 0, inactiveCount: 0 });
  const [filter, setFilter] = useState<ProductFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async (nextFilter = filter, nextPage = page, nextSearch = search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ filter: nextFilter, page: String(nextPage) });
      if (nextSearch.trim()) params.set("search", nextSearch.trim());
      setData(await request<ManagedProductList>(`/api/admin/products?${params}`));
    } catch (issue) {
      onError((issue as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filter, onError, page, request, search]);

  useEffect(() => { void load(); }, [load]);

  const changeFilter = (nextFilter: ProductFilter) => {
    setFilter(nextFilter); setPage(1); void load(nextFilter, 1, search);
  };

  const changeSearch = (nextSearch: string) => {
    setSearch(nextSearch); setPage(1); void load(filter, 1, nextSearch);
  };

  const syncCatalog = async () => {
    setSyncing(true);
    try {
      let cursor: string | null | undefined;
      do {
        const result = await request<{ hasNextPage: boolean; nextCursor: string | null }>("/api/admin/products/sync", { method: "POST", body: JSON.stringify({ cursor }) });
        cursor = result.hasNextPage ? result.nextCursor : null;
      } while (cursor);
      await load(filter, page, search);
    } catch (issue) {
      onError((issue as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const changeRequestStatus = async (product: ManagedProduct) => {
    setToggling(product.shopify_product_id);
    try {
      await request(`/api/admin/products/${encodeURIComponent(product.shopify_product_id)}`, { method: "PATCH", body: JSON.stringify({ requestEnabled: !product.request_enabled }) });
      await load(filter, page, search);
    } catch (issue) {
      onError((issue as Error).message);
    } finally {
      setToggling(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(data.total / 50));

  return (
    <div className="tmr-settings-content tmr-product-management" aria-busy={loading || syncing}>
      <div className="tmr-settings-content-heading">
        <div>
          <Text as="h1" variant="headingLg">Product management</Text>
          <Text as="p" tone="subdued">Control which products can receive review requests after fulfilment.</Text>
        </div>
        <Button loading={syncing} onClick={() => void syncCatalog()}>Sync products</Button>
      </div>

      <Card padding="0">
        <div className="tmr-product-tabs" role="tablist" aria-label="Product request status">
          <button className={filter === "all" ? "is-active" : ""} onClick={() => changeFilter("all")} role="tab" type="button">All products ({data.total})</button>
          <button className={filter === "active" ? "is-active" : ""} onClick={() => changeFilter("active")} role="tab" type="button">Request active ({data.activeCount})</button>
          <button className={filter === "inactive" ? "is-active" : ""} onClick={() => changeFilter("inactive")} role="tab" type="button">Request inactive ({data.inactiveCount})</button>
        </div>
        <div className="tmr-product-controls">
          <input aria-label="Search products" onChange={(event) => changeSearch(event.currentTarget.value)} placeholder="Search products" value={search} />
          <Button loading={loading} onClick={() => void load()}>Refresh</Button>
        </div>
        <div className="tmr-product-table" role="table" aria-label="Store products">
          <div className="tmr-product-table-head" role="row">
            <span>Product</span><span>Rating</span><span>Reviews</span><span>Requests</span><span>Last review</span><span>Actions</span>
          </div>
          {data.products.map((product) => (
            <div className="tmr-product-table-row" role="row" key={product.shopify_product_id}>
              <div className="tmr-product-identity">
                {product.image_url ? <img alt="" src={product.image_url} /> : <span className="tmr-product-image-placeholder" aria-hidden="true" />}
                <div><Text as="p" fontWeight="semibold">{productLabel(product)}</Text><Text as="p" tone="subdued">{product.catalog_status.toLowerCase()}</Text></div>
              </div>
              <Text as="p">{product.average_rating ? `${product.average_rating.toFixed(1)} / 5` : "—"}</Text>
              <Text as="p">{product.review_count}</Text>
              <Badge tone={product.request_enabled ? "success" : "critical"}>{product.request_enabled ? "Active" : "Inactive"}</Badge>
              <Text as="p" tone="subdued">{lastActivity(product.last_reviewed_at)}</Text>
              <div className="tmr-product-actions">
                <Button size="slim" url={`/reviews?product=${encodeURIComponent(product.shopify_product_id)}`}>Reviews</Button>
                <Button loading={toggling === product.shopify_product_id} onClick={() => void changeRequestStatus(product)} size="slim">{product.request_enabled ? "Disable" : "Enable"}</Button>
              </div>
            </div>
          ))}
          {!loading && !data.products.length && <div className="tmr-settings-empty"><Text as="p">No products found. Sync products to load your Shopify catalogue.</Text></div>}
        </div>
        <div className="tmr-product-pagination">
          <Text as="p" tone="subdued">Page {page} of {totalPages}</Text>
          <div><Button disabled={page <= 1 || loading} onClick={() => { const next = page - 1; setPage(next); void load(filter, next, search); }} size="slim">Previous</Button><Button disabled={page >= totalPages || loading} onClick={() => { const next = page + 1; setPage(next); void load(filter, next, search); }} size="slim">Next</Button></div>
        </div>
      </Card>
    </div>
  );
}
