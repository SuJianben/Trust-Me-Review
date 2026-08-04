import { AppProvider, Badge, Button, Card, FormLayout, Page, Text, TextField } from "@shopify/polaris";
import { useEffect, useMemo, useState } from "react";
import type { InvitationOrder, ReviewDraft } from "./types";
import "./invitation-review.css";

type Props = { token: string };

const emptyDraft = (): ReviewDraft => ({ rating: 5, title: "", body: "" });

function identityStorageKey(orderId: string) {
  return `trust-me-review:invitation:${orderId}:author-name`;
}

export function InvitationReviewPage({ token }: Props) {
  const [invitation, setInvitation] = useState<InvitationOrder | null>(null);
  const [authorName, setAuthorName] = useState("");
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const loadInvitation = async () => {
      try {
        const response = await fetch(`/api/invitations/${token}`);
        if (!response.ok) throw new Error("invalid");
        const data = await response.json() as InvitationOrder;
        if (!active) return;
        setInvitation(data);
        setDrafts(Object.fromEntries(data.products.filter((product) => product.status === "sent").map((product) => [product.requestId, emptyDraft()])));
        setAuthorName(window.localStorage.getItem(identityStorageKey(data.orderId)) ?? "");
      } catch {
        if (active) setMessage("This invitation is invalid or all of its product reviews have already been submitted.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadInvitation();
    return () => { active = false; };
  }, [token]);

  const pendingProducts = useMemo(() => invitation?.products.filter((product) => product.status === "sent") ?? [], [invitation]);

  const updateDraft = (requestId: string, patch: Partial<ReviewDraft>) => {
    setDrafts((current) => ({ ...current, [requestId]: { ...(current[requestId] ?? emptyDraft()), ...patch } }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!invitation) return;
    const reviews = pendingProducts
      .map((product) => ({ requestId: product.requestId, ...(drafts[product.requestId] ?? emptyDraft()) }))
      .filter((review) => review.body.trim().length > 0);
    if (!authorName.trim()) { setMessage("Please enter your name once before submitting your review."); return; }
    if (!reviews.length) { setMessage("Write a review for at least one product before submitting."); return; }
    setMessage("");
    setSubmitting(true);
    try {
      const response = await fetch(`/api/invitations/${token}/reviews`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ authorName, reviews }),
      });
      if (!response.ok) {
        if (response.status === 400) setMessage("Check your rating and review text, then try again.");
        else if (response.status === 404 || response.status === 409) setMessage("One or more product invitations are no longer available. Refresh this page to see the latest status.");
        else setMessage("Unable to submit your review right now. Please try again shortly.");
        return;
      }
      window.localStorage.setItem(identityStorageKey(invitation.orderId), authorName.trim());
      const submittedIds = new Set(reviews.map((review) => review.requestId));
      setInvitation((current) => current ? { ...current, products: current.products.map((product) => submittedIds.has(product.requestId) ? { ...product, status: "submitted" } : product) } : current);
      setMessage(`Thank you. ${reviews.length} verified-purchase review${reviews.length === 1 ? " is" : "s are"} awaiting approval.`);
    } catch {
      setMessage("Unable to submit your review right now. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <AppProvider i18n={{}}><div className="tmr-invitation-page"><Page title="Share your review"><Text as="p">Loading your order…</Text></Page></div></AppProvider>;
  if (!invitation) return <AppProvider i18n={{}}><div className="tmr-invitation-page"><Page title="Share your review"><Card><Text as="p">{message}</Text></Card></Page></div></AppProvider>;

  return <AppProvider i18n={{}}><div className="tmr-invitation-page"><Page title="Share your review">
    <div className="tmr-invitation-intro"><Text as="p" tone="subdued">Leave ratings for the products in this order. Your name is shared once, while each product review remains separate.</Text></div>
    <Card><form className="tmr-invitation-form" onSubmit={submit}>
      <TextField label="Name" value={authorName} onChange={setAuthorName} autoComplete="name" disabled={submitting || !pendingProducts.length} helpText="Required once for every review submitted from this order." />
      {invitation.products.map((product) => {
        const draft = drafts[product.requestId] ?? emptyDraft();
        const submitted = product.status === "submitted";
        return <section className={`tmr-invitation-product${submitted ? " tmr-invitation-product--submitted" : ""}`} key={product.requestId}>
          <div className="tmr-invitation-product__heading"><Text as="h2" variant="headingMd">{product.productTitle}</Text>{submitted && <Badge tone="success">Submitted</Badge>}</div>
          {submitted ? <p className="tmr-invitation-product__submitted-note">This verified review was submitted and is awaiting store approval.</p> : <FormLayout>
            <div><Text as="p" fontWeight="medium">Rating</Text><div className="tmr-invitation-rating" role="radiogroup" aria-label={`Rating for ${product.productTitle}`}>{[1, 2, 3, 4, 5].map((rating) => <button aria-checked={draft.rating === rating} aria-label={`${rating} star${rating === 1 ? "" : "s"}`} className={`tmr-invitation-star${draft.rating === rating ? " is-selected" : ""}`} disabled={submitting} key={rating} onClick={() => updateDraft(product.requestId, { rating })} role="radio" type="button">★</button>)}</div></div>
            <TextField label="Title (optional)" value={draft.title} onChange={(value) => updateDraft(product.requestId, { title: value })} autoComplete="off" disabled={submitting} />
            <TextField label="Review" value={draft.body} onChange={(value) => updateDraft(product.requestId, { body: value })} multiline autoComplete="off" disabled={submitting} helpText="Required to submit this product review." />
          </FormLayout>}
        </section>;
      })}
      {pendingProducts.length ? <div className="tmr-invitation-actions"><Button submit variant="primary" loading={submitting}>Submit completed reviews</Button><Text as="p" tone="subdued">Only products with review text will be submitted. A title is optional.</Text></div> : <Text as="p">All product reviews in this invitation have already been submitted.</Text>}
      {message && <Text as="p">{message}</Text>}
    </form></Card>
  </Page></div></AppProvider>;
}
