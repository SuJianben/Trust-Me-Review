import { Badge, Button, Card, Text } from "@shopify/polaris";
import { useCallback, useEffect, useState } from "react";
import type { AuthenticatedRequest } from "../../api";
import type { DashboardData, DashboardMetric, DashboardReview } from "./types";

type DashboardPanelProps = {
  request: AuthenticatedRequest;
  onError: (message: string) => void;
  onOpenReviews: () => void;
};

const emptyMetrics: DashboardMetric = {
  total_reviews: 0,
  published_reviews: 0,
  pending_reviews: 0,
  average_rating: 0,
  sent_requests: 0,
  scheduled_requests: 0,
};

const reviewStars = (rating: number) => "★".repeat(rating) + "☆".repeat(5 - rating);

function displayDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function reviewPreview(review: DashboardReview) {
  const text = review.title || review.body;
  return text.length > 74 ? `${text.slice(0, 74)}…` : text;
}

export function DashboardPanel({ request, onError, onOpenReviews }: DashboardPanelProps) {
  const [data, setData] = useState<DashboardData>({ metrics: emptyMetrics, topProducts: [], recentReviews: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await request<DashboardData>("/api/admin/dashboard"));
    } catch (issue) {
      onError((issue as Error).message);
    } finally {
      setLoading(false);
    }
  }, [onError, request]);

  useEffect(() => { void load(); }, [load]);

  const { metrics } = data;
  const metricsToDisplay = [
    { label: "Reviews", value: metrics.total_reviews },
    { label: "Average rating", value: metrics.average_rating ? `${metrics.average_rating.toFixed(1)} / 5` : "—" },
    { label: "Pending", value: metrics.pending_reviews },
    { label: "Published", value: metrics.published_reviews },
    { label: "Invitations sent", value: metrics.sent_requests },
    { label: "Queued invitations", value: metrics.scheduled_requests },
  ];

  return (
    <div className="tmr-dashboard" aria-busy={loading}>
      <header className="tmr-dashboard-header">
        <div>
          <div className="tmr-eyebrow">OVERVIEW</div>
          <Text as="h1" variant="headingLg">Dashboard</Text>
          <Text as="p" tone="subdued">All-time review activity for this store.</Text>
        </div>
        <Button loading={loading} onClick={() => void load()}>Refresh</Button>
      </header>

      <section className="tmr-dashboard-metrics" aria-label="Review metrics">
        {metricsToDisplay.map((metric) => (
          <div className="tmr-dashboard-metric" key={metric.label}>
            <Text as="p" tone="subdued">{metric.label}</Text>
            <Text as="p" variant="headingLg">{String(metric.value)}</Text>
          </div>
        ))}
      </section>

      <Card padding="0">
        <div className="tmr-dashboard-status">
          <div>
            <Text as="h2" variant="headingMd">Review status</Text>
            <Text as="p" tone="subdued">Keep new customer feedback moving through moderation.</Text>
          </div>
          {metrics.pending_reviews > 0 ? (
            <Badge tone="attention">{`${metrics.pending_reviews} review${metrics.pending_reviews === 1 ? "" : "s"} need review`}</Badge>
          ) : (
            <Badge tone="success">You&apos;re all caught up</Badge>
          )}
          <Button onClick={onOpenReviews}>Manage reviews</Button>
        </div>
      </Card>

      <div className="tmr-dashboard-columns">
        <Card padding="0">
          <div className="tmr-dashboard-panel-heading">
            <div><Text as="h2" variant="headingMd">Top products</Text><Text as="p" tone="subdued">Ranked by non-deleted reviews.</Text></div>
          </div>
          <div className="tmr-dashboard-table" role="table" aria-label="Top products">
            <div className="tmr-dashboard-table-head" role="row"><span>Product</span><span>Reviews</span><span>Rating</span></div>
            {data.topProducts.map((product) => (
              <div className="tmr-dashboard-table-row" role="row" key={product.shopify_product_id}>
                <span>{product.title_snapshot || `Product #${product.shopify_product_id}`}</span>
                <span>{product.review_count}</span>
                <span>{product.average_rating ? product.average_rating.toFixed(1) : "—"}</span>
              </div>
            ))}
            {!loading && !data.topProducts.length && <div className="tmr-dashboard-empty">No product review data yet.</div>}
          </div>
        </Card>

        <Card padding="0">
          <div className="tmr-dashboard-panel-heading">
            <div><Text as="h2" variant="headingMd">Recent reviews</Text><Text as="p" tone="subdued">Latest customer feedback from this store.</Text></div>
            <Button variant="plain" onClick={onOpenReviews}>View all</Button>
          </div>
          <div className="tmr-dashboard-recent-list">
            {data.recentReviews.map((review) => (
              <article className="tmr-dashboard-review" key={review.id}>
                <div className="tmr-dashboard-review-meta"><span className="tmr-rating">{reviewStars(review.rating)}</span><span>{displayDate(review.created_at)}</span><Badge tone={review.status === "published" ? "success" : review.status === "pending" ? "attention" : "critical"}>{review.status}</Badge></div>
                <Text as="p" fontWeight="semibold">{review.author_name}</Text>
                <Text as="p" tone="subdued">{reviewPreview(review)}</Text>
                <Text as="p" tone="subdued">{review.title_snapshot || "Unknown product"}{review.verified_purchase ? " · Verified purchase" : ""}</Text>
              </article>
            ))}
            {!loading && !data.recentReviews.length && <div className="tmr-dashboard-empty">No reviews have been received yet.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
