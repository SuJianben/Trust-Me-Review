import { Badge, Button, Card, DataTable, Select, Text, TextField } from "@shopify/polaris";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AuthenticatedRequest } from "../../api";

type ReviewStatus = "pending" | "published" | "hidden" | "deleted";
type Review = {
  id: string;
  rating: number;
  author_name: string;
  title: string | null;
  body: string;
  status: ReviewStatus;
  pinned: boolean;
  verified_purchase: boolean;
  reply_body?: string;
};
type ReviewResponse = { reviews: Review[]; total: number; page: number };

type Props = { request: AuthenticatedRequest; onError: (message: string) => void };

const statusTone: Record<ReviewStatus, "success" | "attention" | "critical" | "info"> = {
  pending: "attention",
  published: "success",
  hidden: "critical",
  deleted: "critical",
};

export function ReviewsPanel({ request, onError }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"all" | ReviewStatus>("all");
  const [loading, setLoading] = useState(true);
  const [replyTarget, setReplyTarget] = useState<Review | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replying, setReplying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page) });
      if (status !== "all") query.set("status", status);
      const data = await request<ReviewResponse>(`/api/admin/reviews?${query}`);
      setReviews(data.reviews);
      setTotal(data.total);
    } catch (issue) {
      onError((issue as Error).message);
    } finally {
      setLoading(false);
    }
  }, [onError, page, request, status]);

  useEffect(() => { void load(); }, [load]);

  const updateReview = async (id: string, update: { status?: ReviewStatus; pinned?: boolean }) => {
    try {
      await request(`/api/admin/reviews/${id}`, { method: "PATCH", body: JSON.stringify(update) });
      await load();
    } catch (issue) {
      onError((issue as Error).message);
    }
  };

  const openReply = (review: Review) => {
    setReplyTarget(review);
    setReplyBody(review.reply_body ?? "");
  };

  const saveReply = async () => {
    if (!replyTarget) return;
    setReplying(true);
    try {
      await request(`/api/admin/reviews/${replyTarget.id}/reply`, { method: "POST", body: JSON.stringify({ body: replyBody }) });
      setReplyTarget(null);
      setReplyBody("");
      await load();
    } catch (issue) {
      onError((issue as Error).message);
    } finally {
      setReplying(false);
    }
  };

  const rows = useMemo(() => reviews.map((review) => [
    <div><Text as="span" fontWeight="semibold">{review.author_name}</Text>{review.title && <Text as="p" tone="subdued">{review.title}</Text>}</div>,
    `${review.rating}/5`,
    review.body,
    <Badge tone={statusTone[review.status]}>{review.status}</Badge>,
    review.verified_purchase ? "✓" : "—",
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      <Button size="slim" onClick={() => void updateReview(review.id, { status: "published" })}>Publish</Button>
      <Button size="slim" onClick={() => void updateReview(review.id, { status: "hidden" })}>Hide</Button>
      <Button size="slim" onClick={() => void updateReview(review.id, { pinned: !review.pinned })}>{review.pinned ? "Unpin" : "Pin"}</Button>
      <Button size="slim" onClick={() => openReply(review)}>Reply</Button>
    </div>,
  ]), [reviews]);

  const hasPreviousPage = page > 1;
  const hasNextPage = page * 30 < total;

  return <>
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <Select label="Review status" labelHidden options={[{ label: "All statuses", value: "all" }, { label: "Pending", value: "pending" }, { label: "Published", value: "published" }, { label: "Hidden", value: "hidden" }, { label: "Deleted", value: "deleted" }]} value={status} onChange={(value) => { setStatus(value as "all" | ReviewStatus); setPage(1); }} />
        <div style={{ display: "flex", gap: 8 }}><Button disabled={!hasPreviousPage || loading} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button disabled={!hasNextPage || loading} onClick={() => setPage((value) => value + 1)}>Next</Button></div>
      </div>
      <DataTable columnContentTypes={["text", "numeric", "text", "text", "text", "text"]} headings={["Customer", "Rating", "Review", "Status", "Verified", "Actions"]} rows={rows} />
      {!loading && !rows.length && <Text as="p">No reviews match this filter.</Text>}
    </Card>
    {replyTarget && <Card>
      <div style={{ display: "grid", gap: 12 }}>
        <Text as="h2" variant="headingMd">Reply to {replyTarget.author_name}</Text>
        <TextField label="Store reply" value={replyBody} onChange={setReplyBody} multiline autoComplete="off" />
        <div style={{ display: "flex", gap: 8 }}><Button variant="primary" loading={replying} onClick={() => void saveReply()}>Save reply</Button><Button onClick={() => setReplyTarget(null)}>Cancel</Button></div>
      </div>
    </Card>}
  </>;
}
