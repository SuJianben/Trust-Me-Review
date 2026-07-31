import { Badge, Button, Card, Popover, Text, TextField } from "@shopify/polaris";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PRODUCT_TREND_PRESETS,
  formatProductTrendSelectionLabel,
  resolveProductTrendSelection,
  type ProductTrendPoint,
  type ProductTrendPreset,
  type ProductTrendSelection,
} from "../../../features/products/trend-range";
import type { AuthenticatedRequest } from "../../api";
import { ReviewsPanel } from "../reviews/ReviewsPanel";
import type { ManagedProduct } from "../settings/types";
import "./product-detail.css";

type ProductDetail = ManagedProduct & {
  handle_snapshot: string;
  trendRangeLabel: string;
  trendRangePreset: ProductTrendPreset;
  trendReviewCount: number;
  trendMediaReviewCount: number;
  trendAverageRating: number;
  trendPoints: ProductTrendPoint[];
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

function initialTrendSelection() {
  if (typeof window === "undefined") return resolveProductTrendSelection({});
  const params = new URLSearchParams(window.location.search);
  return resolveProductTrendSelection({
    range: params.get("range"),
    startDate: params.get("start"),
    endDate: params.get("end"),
  });
}

function trendQuery(selection: ProductTrendSelection) {
  const query = new URLSearchParams();
  query.set("range", selection.preset);
  if (selection.preset === "custom" && selection.startDate && selection.endDate) {
    query.set("start", selection.startDate);
    query.set("end", selection.endDate);
  }
  return query.toString();
}

function syncTrendUrl(selection: ProductTrendSelection) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (selection.preset === "12m") {
    url.searchParams.delete("range");
    url.searchParams.delete("start");
    url.searchParams.delete("end");
  } else {
    url.searchParams.set("range", selection.preset);
    if (selection.preset === "custom" && selection.startDate && selection.endDate) {
      url.searchParams.set("start", selection.startDate);
      url.searchParams.set("end", selection.endDate);
    } else {
      url.searchParams.delete("start");
      url.searchParams.delete("end");
    }
  }
  window.history.replaceState(null, "", url);
}

function ProductTrendRangePicker({ selection, onChange }: { selection: ProductTrendSelection; onChange: (selection: ProductTrendSelection) => void }) {
  const [active, setActive] = useState(false);
  const [customOpen, setCustomOpen] = useState(selection.preset === "custom");
  const [customStart, setCustomStart] = useState(selection.startDate ?? "");
  const [customEnd, setCustomEnd] = useState(selection.endDate ?? "");

  useEffect(() => {
    if (selection.preset === "custom") {
      setCustomOpen(true);
      setCustomStart(selection.startDate ?? "");
      setCustomEnd(selection.endDate ?? "");
    }
  }, [selection.endDate, selection.preset, selection.startDate]);

  const choosePreset = (preset: ProductTrendPreset) => {
    if (preset === "custom") {
      setCustomOpen(true);
      return;
    }
    onChange(resolveProductTrendSelection({ range: preset }));
    setActive(false);
  };

  const applyCustom = () => {
    onChange(resolveProductTrendSelection({ range: "custom", startDate: customStart, endDate: customEnd }));
    setActive(false);
  };

  const customDisabled = !customStart || !customEnd || customStart > customEnd;
  const activator = <Button disclosure onClick={() => setActive((value) => !value)}>{formatProductTrendSelectionLabel(selection)}</Button>;

  return <Popover active={active} activator={activator} autofocusTarget="container" onClose={() => setActive(false)} preferredAlignment="right">
    <div className="tmr-product-range-popover">
      <div className="tmr-product-range-options" role="menu">
        {PRODUCT_TREND_PRESETS.map((option) => <button className={selection.preset === option.value ? "is-active" : ""} key={option.value} onClick={() => choosePreset(option.value)} role="menuitemradio" type="button" aria-checked={selection.preset === option.value}>
          <span className="tmr-product-range-radio" aria-hidden="true" />
          <span>{option.label}</span>
        </button>)}
      </div>
      {customOpen && <div className="tmr-product-range-custom">
        <TextField autoComplete="off" label="Start date" onChange={setCustomStart} type="date" value={customStart} />
        <TextField autoComplete="off" label="End date" onChange={setCustomEnd} type="date" value={customEnd} />
        <div className="tmr-product-range-actions"><Button disabled={customDisabled} onClick={applyCustom} size="slim" variant="primary">Apply</Button></div>
      </div>}
    </div>
  </Popover>;
}

function ReviewVolumeTrend({ points, totalReviews, rangeLabel, metric = "reviews" }: { points: ProductDetail["trendPoints"]; totalReviews: number; rangeLabel: string; metric?: "reviews" | "average" }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{ point: ProductDetail["trendPoints"][number]; index: number; x: number; y: number; alignLeft: boolean } | null>(null);
  const maxValue = useMemo(() => metric === "average" ? 5 : Math.max(1.2, Math.ceil(Math.max(...points.map((point) => point.review_count), 0) * 1.2 * 5) / 5), [metric, points]);
  const majorTickStep = useMemo(() => Math.max(1, Math.ceil(points.length / 12)), [points.length]);
  const path = useMemo(() => {
    const width = 720;
    const height = 190;
    const xPadding = 30;
    const yPadding = 20;
    const chartHeight = height - (yPadding * 2);
    const chartWidth = width - (xPadding * 2);
    return points.map((point, index) => {
      const x = xPadding + ((chartWidth * index) / Math.max(1, points.length - 1));
      const value = metric === "average" ? point.average_rating : point.review_count;
      const y = height - yPadding - ((value / maxValue) * chartHeight);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(" ");
  }, [maxValue, metric, points]);

  const showTooltip = useCallback((point: ProductDetail["trendPoints"][number], index: number, target: SVGCircleElement) => {
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const x = targetRect.left - containerRect.left + (targetRect.width / 2);
    const y = targetRect.top - containerRect.top + (targetRect.height / 2);
    setHoveredPoint({
      point,
      index,
      x,
      y: Math.max(14, Math.min(containerRect.height - 14, y)),
      alignLeft: x > containerRect.width - 150,
    });
  }, []);

  return <div ref={containerRef} className="tmr-product-trend" aria-label={`Review count trend for ${rangeLabel}`} onMouseLeave={() => setHoveredPoint(null)}>
    <div className="tmr-product-trend-scroll">
      <svg viewBox="0 0 720 190" role="img">
        <rect className="tmr-product-trend-panel" x="30" y="20" width="660" height="150" rx="4" />
        {Array.from({ length: 7 }, (_, index) => index).map((index) => {
          const value = (maxValue / 6) * index;
          const y = 170 - ((value / maxValue) * 150);
          return <g key={value}><line x1="30" x2="690" y1={y} y2={y} /><text x="8" y={y + 4}>{Number.isInteger(value) ? value : value.toFixed(1)}</text></g>;
        })}
        {points.map((point, index) => {
          const x = 30 + ((660 * index) / Math.max(1, points.length - 1));
          return (index % majorTickStep === 0 || index === points.length - 1) ? <line key={point.key} className="tmr-product-trend-vertical" x1={x} x2={x} y1="20" y2="170" /> : null;
        })}
        {path && <path d={path} />}
        {points.map((point, index) => {
          const x = 30 + ((660 * index) / Math.max(1, points.length - 1));
          const value = metric === "average" ? point.average_rating : point.review_count;
          const y = 170 - ((value / maxValue) * 150);
          return <g className="tmr-product-trend-point" key={point.key}>
            <circle aria-label={`${point.label}: ${point.review_count} review(s)`} cx={x} cy={y} onBlur={() => setHoveredPoint(null)} onFocus={(event) => showTooltip(point, index, event.currentTarget)} onMouseEnter={(event) => showTooltip(point, index, event.currentTarget)} r="5" tabIndex={0} />
            {(index % majorTickStep === 0 || index === points.length - 1) && <text className="tmr-product-trend-month" pointerEvents="none" x={x} y="187" textAnchor="middle">{point.label}</text>}
          </g>;
        })}
      </svg>
    </div>
    {hoveredPoint && <div className={`tmr-product-trend-tooltip${hoveredPoint.alignLeft ? " tmr-product-trend-tooltip--left" : ""}`} role="status" style={{ left: `${hoveredPoint.x}px`, top: `${hoveredPoint.y}px` }}>
      <strong>{metric === "average" ? `${hoveredPoint.point.average_rating.toFixed(1)} average rating` : `${hoveredPoint.point.review_count} review(s)`}</strong>
      <span>{metric === "average" ? hoveredPoint.point.label : (totalReviews ? `${Math.round((hoveredPoint.point.review_count / totalReviews) * 100)}%` : "0%")}</span>
    </div>}
  </div>;
}

export function ProductDetailPanel({ productId, request, onError, onClearError }: ProductDetailPanelProps) {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [trendSelection, setTrendSelection] = useState<ProductTrendSelection>(() => initialTrendSelection());
  const [activeStat, setActiveStat] = useState<"total" | "media" | "average">("total");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = trendQuery(trendSelection);
      const response = await request<ProductDetail>(`/api/admin/products/${encodeURIComponent(productId)}?${query}`);
      setProduct(response);
      onClearError();
    } catch (issue) {
      onError((issue as Error).message);
    } finally {
      setLoading(false);
    }
  }, [onClearError, onError, productId, request, trendSelection]);

  useEffect(() => { void load(); }, [load]);

  const changeTrendSelection = (selection: ProductTrendSelection) => {
    setTrendSelection(selection);
    syncTrendUrl(selection);
  };

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
      <div className="tmr-product-stat-heading">
        <Text as="h2" variant="headingMd">Product statistics</Text>
        <ProductTrendRangePicker selection={trendSelection} onChange={changeTrendSelection} />
      </div>
      <div className="tmr-product-stat-cards" role="tablist" aria-label="Product statistics views">
        <button type="button" className={activeStat === "total" ? "is-active" : ""} onClick={() => setActiveStat("total")} role="tab" aria-selected={activeStat === "total"}><Text as="p" tone="subdued">Total reviews</Text><Text as="p" variant="headingLg">{product.trendReviewCount}</Text></button>
        <button type="button" className={activeStat === "media" ? "is-active" : ""} onClick={() => setActiveStat("media")} role="tab" aria-selected={activeStat === "media"}><Text as="p" tone="subdued">Reviews with media</Text><Text as="p" variant="headingLg">{product.trendMediaReviewCount}</Text></button>
        <button type="button" className={activeStat === "average" ? "is-active" : ""} onClick={() => setActiveStat("average")} role="tab" aria-selected={activeStat === "average"}><Text as="p" tone="subdued">Average rating</Text><Text as="p" variant="headingLg">{product.trendAverageRating ? product.trendAverageRating.toFixed(1) : "—"}</Text></button>
      </div>
      {activeStat === "total" && product.trendReviewCount > 0 && <ReviewVolumeTrend points={product.trendPoints} totalReviews={product.trendReviewCount} rangeLabel={formatProductTrendSelectionLabel(trendSelection)} />}
      {activeStat === "average" && product.trendReviewCount > 0 && <ReviewVolumeTrend metric="average" points={product.trendPoints} totalReviews={product.trendReviewCount} rangeLabel={formatProductTrendSelectionLabel(trendSelection)} />}
      {activeStat === "average" && !product.trendReviewCount && <div className="tmr-product-stat-empty"><Text as="p" tone="subdued">No rating data in this date range.</Text></div>}
      {activeStat === "media" && !product.trendMediaReviewCount && <div className="tmr-product-stat-empty"><Text as="p" tone="subdued">No reviews with media in this date range.</Text></div>}
    </Card>

    {activeStat === "total" && <ReviewsPanel compact productId={productId} request={request} onError={onError} onClearError={onClearError} />}
    {activeStat === "media" && product.trendMediaReviewCount > 0 && <ReviewsPanel compact productId={productId} request={request} onError={onError} onClearError={onClearError} />}
  </div>;
}
