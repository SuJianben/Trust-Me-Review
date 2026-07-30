import { Badge, Button, Text } from "@shopify/polaris";
import { useCallback, useEffect, useState } from "react";
import type { AuthenticatedRequest } from "../../api";
import type { DashboardData, DashboardMetric, DashboardReview } from "./types";

type DashboardPanelProps = {
  request: AuthenticatedRequest;
  onError: (message: string) => void;
  onOpenReviews: () => void;
  onOpenDeliveries: () => void;
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

function statusCopy(metrics: DashboardMetric) {
  if (metrics.pending_reviews === 0) {
    return "No reviews are waiting for moderation.";
  }

  return `${metrics.pending_reviews} review${metrics.pending_reviews === 1 ? " is" : "s are"} waiting for moderation.`;
}

export function DashboardPanel({
  request,
  onError,
  onOpenReviews,
  onOpenDeliveries,
}: DashboardPanelProps) {
  const [data, setData] = useState<DashboardData>({
    metrics: emptyMetrics,
    topProducts: [],
    recentReviews: [],
  });
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

  useEffect(() => {
    void load();
  }, [load]);

  const { metrics } = data;
  const overviewMetrics = [
    { label: "Reviews", value: metrics.total_reviews },
    {
      label: "Average rating",
      value: metrics.average_rating ? `${metrics.average_rating.toFixed(1)} / 5` : "—",
    },
    { label: "Invitations sent", value: metrics.sent_requests },
    { label: "Published", value: metrics.published_reviews },
    { label: "Pending", value: metrics.pending_reviews },
  ];

  return (
    <div className="tmr-dashboard" aria-busy={loading}>
      <section className="tmr-dashboard-hero" aria-labelledby="dashboard-title">
        <div>
          <Text as="h1" variant="headingLg" id="dashboard-title">
            Review overview
          </Text>
          <Text as="p">Monitor customer feedback, moderation, and invitation activity for this store.</Text>
        </div>
        <div className="tmr-dashboard-hero-stars" aria-hidden="true">☆ ☆ ☆ ☆ ☆</div>
      </section>

      <section className="tmr-dashboard-summary" aria-label="Review summary">
        <div className="tmr-dashboard-section-heading">
          <div>
            <Text as="h2" variant="headingMd">Review activity</Text>
            <Text as="p" tone="subdued">All-time activity for this store.</Text>
          </div>
          <div className="tmr-dashboard-heading-actions">
            <span>All time</span>
            <Button loading={loading} onClick={() => void load()}>Refresh</Button>
          </div>
        </div>

        <div className="tmr-dashboard-metrics">
          {overviewMetrics.map((metric) => (
            <div className="tmr-dashboard-metric" key={metric.label}>
              <Text as="p" fontWeight="semibold">{metric.label}</Text>
              <Text as="p" variant="headingLg">{String(metric.value)}</Text>
            </div>
          ))}
        </div>

        <div className="tmr-dashboard-status-grid" aria-label="Operational status">
          <div className="tmr-dashboard-status-item">
            <Text as="h3" fontWeight="semibold">Moderation</Text>
            {metrics.pending_reviews > 0 ? (
              <Badge tone="attention">{`${metrics.pending_reviews} pending`}</Badge>
            ) : (
              <Badge tone="success">All caught up</Badge>
            )}
            <Text as="p" tone="subdued">{statusCopy(metrics)}</Text>
          </div>
          <div className="tmr-dashboard-status-item">
            <Text as="h3" fontWeight="semibold">Storefront</Text>
            <Badge tone="success">{`${metrics.published_reviews} published`}</Badge>
            <Text as="p" tone="subdued">Only published reviews are visible to shoppers.</Text>
          </div>
          <div className="tmr-dashboard-status-item">
            <Text as="h3" fontWeight="semibold">Invitations</Text>
            <Badge tone={metrics.scheduled_requests > 0 ? "attention" : "success"}>
              {metrics.scheduled_requests > 0 ? `${metrics.scheduled_requests} queued` : "No queued invitations"}
            </Badge>
            <Text as="p" tone="subdued">{`${metrics.sent_requests} test invitation${metrics.sent_requests === 1 ? " has" : "s have"} been sent.`}</Text>
          </div>
        </div>
      </section>

      <section className="tmr-dashboard-work-list" aria-label="Review operations">
        <article className="tmr-dashboard-work-card tmr-dashboard-work-card--reviews">
          <div className="tmr-dashboard-work-content">
            <Text as="h2" variant="headingMd">Moderate customer feedback</Text>
            <Text as="p">Review pending feedback, publish approved reviews, and reply to customers from one place.</Text>
            <Button onClick={onOpenReviews}>Manage reviews</Button>
          </div>
          <div className="tmr-dashboard-work-visual" aria-hidden="true">
            <span>{metrics.pending_reviews}</span>
            <small>pending</small>
          </div>
        </article>

        <article className="tmr-dashboard-work-card tmr-dashboard-work-card--requests">
          <div className="tmr-dashboard-work-content">
            <Text as="h2" variant="headingMd">Collect verified reviews</Text>
            <Text as="p">Track generated test invitations and open the secure review links created after fulfilment.</Text>
            <Button onClick={onOpenDeliveries}>Review requests</Button>
          </div>
          <div className="tmr-dashboard-work-visual" aria-hidden="true">
            <span>{metrics.sent_requests}</span>
            <small>sent</small>
          </div>
        </article>
      </section>

      <div className="tmr-dashboard-columns">
        <section className="tmr-dashboard-data-panel" aria-labelledby="top-products-title">
          <div className="tmr-dashboard-panel-heading">
            <div>
              <Text as="h2" variant="headingMd" id="top-products-title">Top products</Text>
              <Text as="p" tone="subdued">Ranked by non-deleted reviews.</Text>
            </div>
          </div>
          <div className="tmr-dashboard-table" role="table" aria-label="Top products">
            <div className="tmr-dashboard-table-head" role="row">
              <span>Product</span><span>Reviews</span><span>Rating</span>
            </div>
            {data.topProducts.map((product) => (
              <div className="tmr-dashboard-table-row" role="row" key={product.shopify_product_id}>
                <span>{product.title_snapshot || `Product #${product.shopify_product_id}`}</span>
                <span>{product.review_count}</span>
                <span>{product.average_rating ? product.average_rating.toFixed(1) : "—"}</span>
              </div>
            ))}
            {!loading && !data.topProducts.length && <div className="tmr-dashboard-empty">No product review data yet.</div>}
          </div>
          <button className="tmr-dashboard-panel-link" type="button" onClick={onOpenReviews}>View reviews</button>
        </section>

        <section className="tmr-dashboard-data-panel" aria-labelledby="recent-reviews-title">
          <div className="tmr-dashboard-panel-heading">
            <div>
              <Text as="h2" variant="headingMd" id="recent-reviews-title">Recent activity</Text>
              <Text as="p" tone="subdued">Latest customer feedback from this store.</Text>
            </div>
          </div>
          <div className="tmr-dashboard-recent-list">
            {data.recentReviews.map((review) => (
              <article className="tmr-dashboard-review" key={review.id}>
                <div className="tmr-dashboard-review-meta">
                  <span className="tmr-rating">{reviewStars(review.rating)}</span>
                  <span>{displayDate(review.created_at)}</span>
                  <Badge tone={review.status === "published" ? "success" : review.status === "pending" ? "attention" : "critical"}>{review.status}</Badge>
                </div>
                <Text as="p" fontWeight="semibold">{review.author_name}</Text>
                <Text as="p" tone="subdued">{reviewPreview(review)}</Text>
                <Text as="p" tone="subdued">{review.title_snapshot || "Unknown product"}{review.verified_purchase ? " · Verified purchase" : ""}</Text>
              </article>
            ))}
            {!loading && !data.recentReviews.length && <div className="tmr-dashboard-empty">No reviews have been received yet.</div>}
          </div>
          <button className="tmr-dashboard-panel-link" type="button" onClick={onOpenReviews}>View all reviews</button>
        </section>
      </div>
    </div>
  );
}
