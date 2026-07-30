import { Badge, Button, Card, Select, Text, TextField } from "@shopify/polaris";
import { useCallback, useEffect, useState } from "react";
import type { AuthenticatedRequest } from "../../api";

type ReviewStatus = "pending" | "published" | "hidden" | "deleted";
type Review = {
  id: string; rating: number; author_name: string; title: string | null; body: string; status: ReviewStatus;
  source: "public" | "invitation"; pinned: boolean; verified_purchase: boolean; reply_body?: string; created_at: string;
  shopify_product_id: string; title_snapshot: string;
};
type ReviewResponse = { reviews: Review[]; total: number; page: number };
type Props = {
  request: AuthenticatedRequest;
  onError: (message: string) => void;
  onClearError: () => void;
};

const statusTone: Record<ReviewStatus, "success" | "attention" | "critical" | "info"> = { pending: "attention", published: "success", hidden: "critical", deleted: "critical" };
const statusOptions = [{ label: "All reviews", value: "all" }, { label: "Pending", value: "pending" }, { label: "Published", value: "published" }, { label: "Hidden", value: "hidden" }, { label: "Deleted", value: "deleted" }];
const reviewStatusOptions = statusOptions.filter((item) => item.value !== "all");
const sourceOptions = [{ label: "All sources", value: "all" }, { label: "Public form", value: "public" }, { label: "Verified invitation", value: "invitation" }];
const ratingOptions = [{ label: "All ratings", value: "all" }, ...[5, 4, 3, 2, 1].map((rating) => ({ label: `${rating} stars`, value: String(rating) }))];

function reviewStars(rating: number) { return "★".repeat(rating) + "☆".repeat(5 - rating); }
function createdAt(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }

export function ReviewsPanel({ request, onError, onClearError }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"all" | ReviewStatus>("all");
  const [source, setSource] = useState("all");
  const [rating, setRating] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [replyTarget, setReplyTarget] = useState<Review | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replying, setReplying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page) });
      if (status !== "all") query.set("status", status);
      if (source !== "all") query.set("source", source);
      if (rating !== "all") query.set("rating", rating);
      if (search) query.set("q", search);
      const data = await request<ReviewResponse>(`/api/admin/reviews?${query}`);
      onClearError();
      setReviews(data.reviews); setTotal(data.total);
    } catch (issue) { onError((issue as Error).message); } finally { setLoading(false); }
  }, [onClearError, onError, page, rating, request, search, source, status]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const keyword = searchInput.trim();
    if (!keyword) {
      setSearch("");
      setPage(1);
      return;
    }

    const timer = window.setTimeout(() => {
      setSearch(keyword);
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const resetPage = (action: () => void) => { action(); setPage(1); };
  const updateReview = async (id: string, update: { status?: ReviewStatus; pinned?: boolean }) => {
    try { await request(`/api/admin/reviews/${id}`, { method: "PATCH", body: JSON.stringify(update) }); await load(); }
    catch (issue) { onError((issue as Error).message); }
  };
  const openReply = (review: Review) => { setReplyTarget(review); setReplyBody(review.reply_body ?? ""); };
  const saveReply = async () => {
    if (!replyTarget) return;
    setReplying(true);
    try { await request(`/api/admin/reviews/${replyTarget.id}/reply`, { method: "POST", body: JSON.stringify({ body: replyBody }) }); setReplyTarget(null); setReplyBody(""); await load(); }
    catch (issue) { onError((issue as Error).message); } finally { setReplying(false); }
  };
  const deleteReview = async (id: string) => {
    if (window.confirm("Delete this review? It will no longer appear in the storefront.")) await updateReview(id, { status: "deleted" });
  };
  const hasPreviousPage = page > 1; const hasNextPage = page * 30 < total;

  return <div className="tmr-admin-workspace">
    <div className="tmr-admin-heading">
      <div><div className="tmr-eyebrow">REVIEW OPERATIONS</div><div className="tmr-title-row"><Text as="h1" variant="headingLg">Reviews</Text><Badge tone="info">{`${total} matching`}</Badge></div><Text as="p" tone="subdued">Moderate customer feedback and keep storefront reviews accurate.</Text></div>
      <Button onClick={() => void load()} loading={loading}>Refresh</Button>
    </div>

    <Card padding="0">
      <div className="tmr-review-tabs" role="tablist">
        {statusOptions.map((option) => <button key={option.value} type="button" className={status === option.value ? "is-active" : ""} onClick={() => resetPage(() => setStatus(option.value as "all" | ReviewStatus))}>{option.value === "all" ? `All reviews (${total})` : option.label}</button>)}
      </div>
      <div className="tmr-review-filters">
        <Select label="Source" labelHidden options={sourceOptions} value={source} onChange={(value) => resetPage(() => setSource(value))} />
        <Select label="Rating" labelHidden options={ratingOptions} value={rating} onChange={(value) => resetPage(() => setRating(value))} />
        <div className="tmr-review-search"><TextField label="Search reviews" labelHidden value={searchInput} onChange={setSearchInput} placeholder="Search customer, title, or review" autoComplete="off" /></div>
      </div>

      <div className="tmr-review-table" aria-busy={loading}>
        <div className="tmr-review-table-head"><span>Customer</span><span>Created</span><span>Rating & review</span><span>Status</span><span>Actions</span></div>
        {reviews.map((review) => <article className="tmr-review-row" key={review.id}>
          <div className="tmr-customer-cell"><Text as="p" fontWeight="semibold">{review.author_name}</Text><Text as="p" tone="subdued">{review.source === "invitation" ? "Verified invitation" : "Public form"}{review.verified_purchase ? " · Verified" : ""}</Text><Text as="p" tone="subdued">Product: {review.title_snapshot || `Product #${review.shopify_product_id}`}</Text></div>
          <Text as="p" tone="subdued">{createdAt(review.created_at)}</Text>
          <div className="tmr-review-content"><div className="tmr-rating">{reviewStars(review.rating)}</div>{review.title && <Text as="p" fontWeight="semibold">{review.title}</Text>}<Text as="p">{review.body}</Text>{review.reply_body && <Text as="p" tone="subdued">Store reply: {review.reply_body}</Text>}</div>
          <div className="tmr-status-cell"><Badge tone={statusTone[review.status]}>{review.status}</Badge><Select label={`Status for ${review.author_name}`} labelHidden options={reviewStatusOptions} value={review.status} onChange={(value) => void updateReview(review.id, { status: value as ReviewStatus })} /></div>
          <div className="tmr-review-actions"><Button size="slim" onClick={() => openReply(review)}>Reply</Button><Button size="slim" onClick={() => void updateReview(review.id, { pinned: !review.pinned })}>{review.pinned ? "Unpin" : "Pin"}</Button><Button size="slim" tone="critical" onClick={() => void deleteReview(review.id)}>Delete</Button></div>
        </article>)}
        {!loading && !reviews.length && <div className="tmr-empty-state"><Text as="p">No reviews match these filters.</Text></div>}
      </div>
      <div className="tmr-pagination-bar"><Text as="p" tone="subdued">Page {page}</Text><div><Button disabled={!hasPreviousPage || loading} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button disabled={!hasNextPage || loading} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>
    </Card>

    {replyTarget && <Card><div className="tmr-reply-panel"><Text as="h2" variant="headingMd">Reply to {replyTarget.author_name}</Text><TextField label="Store reply" value={replyBody} onChange={setReplyBody} multiline autoComplete="off" /><div><Button variant="primary" loading={replying} onClick={() => void saveReply()}>Save reply</Button><Button onClick={() => setReplyTarget(null)}>Cancel</Button></div></div></Card>}
  </div>;
}
