import { Banner, Button, Card, Checkbox, FormLayout, Text, TextField } from "@shopify/polaris";
import { useCallback, useEffect, useState } from "react";
import type { AuthenticatedRequest } from "../../api";

export type ShopSettings = {
  request_enabled: boolean;
  request_delay_days: number;
  show_verified_badge: boolean;
  star_color: string;
  email_subject_en: string;
  email_subject_zh: string;
};

type Props = {
  request: AuthenticatedRequest;
  onError: (message: string) => void;
};

const defaults: ShopSettings = {
  request_enabled: true,
  request_delay_days: 14,
  show_verified_badge: true,
  star_color: "#f59e0b",
  email_subject_en: "How was your purchase?",
  email_subject_zh: "您的购买体验如何？",
};

export function SettingsPanel({ request, onError }: Props) {
  const [settings, setSettings] = useState<ShopSettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request<Partial<ShopSettings>>("/api/admin/settings");
      setSettings({ ...defaults, ...data });
    } catch (issue) {
      onError((issue as Error).message);
    } finally {
      setLoading(false);
    }
  }, [onError, request]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await request<{ ok: boolean }>("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({
          requestEnabled: settings.request_enabled,
          requestDelayDays: settings.request_delay_days,
          showVerifiedBadge: settings.show_verified_badge,
          starColor: settings.star_color,
          emailSubjectEn: settings.email_subject_en,
          emailSubjectZh: settings.email_subject_zh,
        }),
      });
      setSaved(true);
    } catch (issue) {
      onError((issue as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return <Card>
    <FormLayout>
      <Text as="h2" variant="headingMd">Review request settings</Text>
      {saved && <Banner tone="success">Settings saved. New fulfilled orders will use these settings.</Banner>}
      <Checkbox label="Enable automatic review requests" checked={settings.request_enabled} onChange={(value) => setSettings((current) => ({ ...current, request_enabled: value }))} />
      <TextField label="Delay after fulfillment (days)" type="number" min={0} max={90} value={String(settings.request_delay_days)} onChange={(value) => setSettings((current) => ({ ...current, request_delay_days: Math.min(90, Math.max(0, Number(value) || 0)) }))} autoComplete="off" helpText="Use 0 for the development-store test: the invitation is queued immediately after fulfillment." disabled={loading} />
      <Checkbox label="Show verified-purchase badge" checked={settings.show_verified_badge} onChange={(value) => setSettings((current) => ({ ...current, show_verified_badge: value }))} />
      <TextField label="Star color" value={settings.star_color} onChange={(value) => setSettings((current) => ({ ...current, star_color: value }))} autoComplete="off" disabled={loading} />
      <TextField label="Test invitation subject (English)" value={settings.email_subject_en} onChange={(value) => setSettings((current) => ({ ...current, email_subject_en: value }))} autoComplete="off" disabled={loading} />
      <TextField label="Test invitation subject (Chinese)" value={settings.email_subject_zh} onChange={(value) => setSettings((current) => ({ ...current, email_subject_zh: value }))} autoComplete="off" disabled={loading} />
      <Button variant="primary" loading={saving} disabled={loading} onClick={save}>Save settings</Button>
    </FormLayout>
  </Card>;
}
