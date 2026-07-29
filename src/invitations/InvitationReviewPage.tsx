import { AppProvider, Button, Card, FormLayout, Page, Text, TextField } from "@shopify/polaris";
import { useState } from "react";

type Props = { token: string };

export function InvitationReviewPage({ token }: Props) {
  const [authorName, setAuthorName] = useState("");
  const [rating, setRating] = useState("5");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);
    try {
      const response = await fetch(`/api/invitations/${token}/reviews`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating: Number(rating), authorName, title, body }),
      });
      if (response.ok) {
        setMessage("Thank you. Your verified-purchase review is awaiting approval.");
        return;
      }
      if (response.status === 404) {
        setMessage("This invitation is invalid or has already been used.");
        return;
      }
      if (response.status === 400) {
        setMessage("Please enter a name, a rating from 1 to 5, and a review with at least 10 characters.");
        return;
      }
      setMessage("Unable to submit your review right now. Please try again shortly.");
    } catch {
      setMessage("Unable to submit your review right now. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return <AppProvider i18n={{}}><Page title="Share your review"><Card><form onSubmit={submit}><FormLayout>
    <TextField label="Name" value={authorName} onChange={setAuthorName} autoComplete="name" disabled={submitting} />
    <TextField label="Rating (1-5)" type="number" min={1} max={5} value={rating} onChange={setRating} autoComplete="off" disabled={submitting} />
    <TextField label="Title" value={title} onChange={setTitle} autoComplete="off" disabled={submitting} />
    <TextField label="Review" value={body} onChange={setBody} multiline autoComplete="off" disabled={submitting} />
    <Button submit variant="primary" loading={submitting}>Submit review</Button>
    {message && <Text as="p">{message}</Text>}
  </FormLayout></form></Card></Page></AppProvider>;
}
