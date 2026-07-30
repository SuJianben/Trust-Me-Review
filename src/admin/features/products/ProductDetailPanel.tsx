import { Badge, Button, Card, Text } from "@shopify/polaris";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AuthenticatedRequest } from "../../api";
import { ReviewsPanel } from "../reviews/ReviewsPanel";
import type { ManagedProduct } from "../settings/types";
import "./product-detail.css";

type ProductDetail = ManagedProduct & {
  handle_snapshot: string;
  monthlyRatings: Array<{ month: string; average_rating: number; review_count: number }>;
};

type ProductDetailPanelProps = {
  productId: string;
  request: AuthenticatedRequest;
  onError: (message: string) => void;
  onClearError: () => void;
};

function productLabel(product: ProductDetail) {
  return product.title_snapshot || `Product #${product.shopify_product_id}`;
}

function monthLabel(value: string) {
  const [, month] = value.split("-");
  return month ? new Intl.DateTimeFormat(undefined, { month: "short" }).format(new Date(2026, Number(month) - 1, 1)) : value;
}

function ReviewVolumeTrend({ points, totalReviews }: { points: ProductDetail["monthlyRatings"]; totalReviews: number }) {
  const [hoveredPoint, setHoveredPoint] = useState<{ point: ProductDetail["monthlyRatings"][number]; index: number } | null>(null);
  const maxReviews = useMemo(() => Math.max(1.2, Math.ceil(Math.max(...points.map((point) => point.review_count), 0) * 1.2 * 5) / 5), [points]);
  const path = useMemo(() => {
    const width = 720;
    const height = 190;
    const xPadding = 30;
    const yPadding = 20;
    const chartHeight = height - (yPadding * 2);
    const chartWidth = width - (xPadding * 2);
    return points.map((point, index) => {
      const x = xPadding + ((chartWidth * index) / Math.max(1, points.length - 1));
      const y = height - yPadding - ((point.review_count / maxReviews) * chartHeight);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(" ");
  }, [maxReviews, points]);

  const tooltipPosition = hoveredPoint ? {
    left: `${(hoveredPoint.index / Math.max(1, points.length - 1)) * 100}%`,
    top: `${(170 - ((hoveredPoint.point.review_count / maxReviews) * 150)) / 190 * 100}%`,
  } : undefined;

  return <div className="tmr-product-trend" aria-label="Monthly review count over the last 12 months" onMouseLeave={() => setHoveredPoint(null)}>
    <svg viewBox="0 0 720 190" role="img">
      {Array.from({ length: 7 }, (_, index) => index).map((index) => {
        const value = (maxReviews / 6) * index;
        const y = 170 - ((value / maxReviews) * 150);
        return <g key={value}><line x1="30" x2="690" y1={y} y2={y} /><text x="8" y={y + 4}>{Number.isInteger(value) ? value : value.toFixed(1)}</text></g>;
      })}
      {path && <path d={path} />}
      {points.map((point, index) => {
        const x = 30 + ((660 * index) / Math.max(1, points.length - 1));
        const y = 170 - ((point.review_count / maxReviews) * 150);
        return <g className="tmr-product-trend-point" key={point.month} onBlur={() => setHoveredPoint(null)} onFocus={() => setHoveredPoint({ point, index })} onMouseEnter={() => setHoveredPoint({ point, index })} tabIndex={0}><circle cx={x} cy={y} r="5" /><text className="tmr-product-trend-month" x={x} y="187" textAnchor="middle">{monthLabel(point.month)}</text></g>;
      })}
    </svg>
    {hoveredPoint && <div className="tmr-product-trend-tooltip" role="status" style={tooltipPosition}>
      <strong>{hoveredPoint.point.review_count} review(s)</strong>
      <span>{totalReviews ? `${Math.round((hoveredPoint.point.review_count / totalReviews) * 100)}%` : "0%"}</span>
    </div>}
  </div>;
}

export function ProductDetailPanel({ productId, request, onError, onClearError }: ProductDetailPanelProps) {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await request<ProductDetail>(`/api/admin/products/${encodeURIComponent(productId)}`);
      setProduct(response);
      onClearError();
    } catch (issue) {
      onError((issue as Error).message);
    } finally {
      setLoading(false);
    }
  }, [onClearError, onError, productId, request]);

  useEffect(() => { void load(); }, [load]);

  if (!product && loading) return <div className="tmr-product-detail-loading"><Text as="p" tone="subdued">Loading product details…</Text></div>;
  if (!product) return <div className="tmr-product-detail-loading"><Button url="/settings?section=product-management">Back to Product management</Button></div>;

  return <div className="tmr-product-detail-page">
    <header className="tmr-product-detail-header">
      <Button accessibilityLabel="Back to Product management" icon={() => <span aria-hidden="true">←</span>} url="/settings?section=product-management" />
      {product.image_url ? <img alt="" className="tmr-product-detail-image" src={product.image_url} /> : <span className="tmr-product-detail-image tmr-product-detail-placeholder" aria-hidden="true" />}
      <div><Text as="h1" variant="headingLg">{productLabel(product)}</Text><Text as="p" tone="subdued">Shopify product #{product.shopify_product_id}</Text></div>
      <Badge tone={product.request_enabled ? "success" : "critical"}>{product.request_enabled ? "Requests active" : "Requests inactive"}</Badge>
    </header>

    <Card>
      <div className="tmr-product-detail-facts">
        <div><Text as="p" fontWeight="semibold">Product ID</Text><Text as="p">{product.shopify_product_id}</Text><Text as="p" fontWeight="semibold">Product handle</Text><Text as="p">{product.handle_snapshot || "Not available"}</Text></div>
        <div><Text as="p" fontWeight="semibold">Review requests</Text><Text as="p">{product.request_enabled ? "Active" : "Inactive"}</Text><Text as="p" fontWeight="semibold">Product status</Text><Text as="p">{product.catalog_status}</Text></div>
        <div><Text as="p" fontWeight="semibold">Invitation records</Text><Text as="p">{product.invitation_count}</Text><Text as="p" fontWeight="semibold">Published reviews</Text><Text as="p">{product.published_count}</Text></div>
      </div>
    </Card>

    <Card>
      <div className="tmr-product-stat-heading"><Text as="h2" variant="headingMd">Product statistics</Text><Text as="p" tone="subdued">Last 12 months</Text></div>
      <div className="tmr-product-stat-cards">
        <div><Text as="p" tone="subdued">Total reviews</Text><Text as="p" variant="headingLg">{product.review_count}</Text></div>
        <div><Text as="p" tone="subdued">Reviews with media</Text><Text as="p" variant="headingLg">0</Text></div>
        <div><Text as="p" tone="subdued">Average rating</Text><Text as="p" variant="headingLg">{product.average_rating ? product.average_rating.toFixed(1) : "—"}</Text></div>
      </div>
      <ReviewVolumeTrend points={product.monthlyRatings} totalReviews={product.review_count} />
    </Card>

    <ReviewsPanel compact productId={productId} request={request} onError={onError} onClearError={onClearError} />
  </div>;
}
