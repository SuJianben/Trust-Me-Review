import { Badge, Button, Card, Text } from "@shopify/polaris";
import { useCallback, useEffect, useState } from "react";
import type { AuthenticatedRequest } from "../../api";
import type { ProductSummary } from "./types";

type Props = { request: AuthenticatedRequest; onError: (message: string) => void; onOpenProduct: (productId: string) => void };

export function ProductManagementPanel({ request, onError, onOpenProduct }: Props) {
  const [products, setProducts] = useState<ProductSummary[]>([]); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); try { setProducts(await request<ProductSummary[]>("/api/admin/products")); } catch (issue) { onError((issue as Error).message); } finally { setLoading(false); } }, [onError, request]);
  useEffect(() => { void load(); }, [load]);
  return <div className="tmr-product-workspace"><div className="tmr-admin-heading"><div><div className="tmr-eyebrow">PRODUCT MANAGEMENT</div><Text as="h1" variant="headingLg">Products</Text><Text as="p" tone="subdued">View the review health of every product.</Text></div><Button onClick={() => void load()} loading={loading}>Refresh</Button></div><Card padding="0"><div className="tmr-product-table-head"><span>Product</span><span>Reviews</span><span>Published</span><span>Average rating</span><span></span></div>{products.map((product) => <div className="tmr-product-row" key={product.shopify_product_id}><div><button className="tmr-product-link" type="button" onClick={() => onOpenProduct(product.shopify_product_id)}>{product.title_snapshot || `Product #${product.shopify_product_id}`}</button><Text as="p" tone="subdued">Product ID: {product.shopify_product_id}</Text></div><Badge tone="info">{String(product.review_count)}</Badge><Text as="p">{product.published_count}</Text><Text as="p">{product.average_rating ? `${product.average_rating.toFixed(1)} / 5` : "—"}</Text><Button size="slim" onClick={() => onOpenProduct(product.shopify_product_id)}>View product</Button></div>)}{!loading && !products.length && <div className="tmr-empty-state"><Text as="p">No products have reviews yet.</Text></div>}</Card></div>;
}
