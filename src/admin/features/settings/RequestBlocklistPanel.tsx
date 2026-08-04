import { Button, InlineStack, Text, TextField } from "@shopify/polaris";
import { useCallback, useEffect, useState } from "react";
import type { AuthenticatedRequest } from "../../api";

type BlocklistEntry = { id: string; email_masked: string; note: string | null; created_at: string };
type Props = { request: AuthenticatedRequest; onError: (message: string) => void };

export function RequestBlocklistPanel({ request, onError }: Props) {
  const [entries, setEntries] = useState<BlocklistEntry[]>([]);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { setEntries(await request<BlocklistEntry[]>("/api/admin/request-blocklist")); }
    catch (issue) { onError((issue as Error).message); }
    finally { setLoading(false); }
  }, [onError, request]);
  useEffect(() => { void load(); }, [load]);
  const add = async () => {
    setSaving(true);
    try { await request<{ ok: boolean }>("/api/admin/request-blocklist", { method: "POST", body: JSON.stringify({ email, note }) }); setEmail(""); setNote(""); await load(); }
    catch (issue) { onError((issue as Error).message); }
    finally { setSaving(false); }
  };
  const remove = async (id: string) => {
    try { await request<{ ok: boolean }>(`/api/admin/request-blocklist/${id}`, { method: "DELETE" }); await load(); }
    catch (issue) { onError((issue as Error).message); }
  };
  return <section className="tmr-schedule-blocklist" aria-labelledby="request-blocklist-heading">
    <div className="tmr-schedule-section-heading"><Text as="h2" variant="headingMd" id="request-blocklist-heading">Blocklist</Text><Text as="p" tone="subdued">Blocked customers will never receive a review invitation from this store.</Text></div>
    <div className="tmr-schedule-blocklist-form"><TextField label="Customer email" value={email} onChange={setEmail} autoComplete="email" placeholder="customer@example.com" disabled={loading || saving} /><TextField label="Internal note (optional)" value={note} onChange={setNote} autoComplete="off" maxLength={300} disabled={loading || saving} /><Button onClick={() => void add()} loading={saving} disabled={loading || !email.trim()}>Add to blocklist</Button></div>
    {entries.length ? <div className="tmr-schedule-blocklist-list">{entries.map((entry) => <div className="tmr-schedule-blocklist-row" key={entry.id}><div><Text as="p" fontWeight="bold">{entry.email_masked}</Text>{entry.note && <Text as="p" tone="subdued">{entry.note}</Text>}</div><InlineStack gap="200" blockAlign="center"><Text as="span" tone="subdued">{new Date(entry.created_at).toLocaleDateString()}</Text><Button variant="plain" tone="critical" onClick={() => void remove(entry.id)}>Remove</Button></InlineStack></div>)}</div> : !loading && <Text as="p" tone="subdued">No blocked customer emails.</Text>}
  </section>;
}
