import { Banner, Button, Card, Checkbox, FormLayout, Text, TextField } from "@shopify/polaris";
import { useCallback, useEffect, useState } from "react";
import type { AuthenticatedRequest } from "../../api";
import type { SettingsSection, ShopSettings } from "./types";

type Props = {
  request: AuthenticatedRequest;
  onError: (message: string) => void;
  section: Exclude<SettingsSection, "product-management">;
};

const defaults: ShopSettings = {
  request_enabled: true,
  request_delay_days: 14,
  show_verified_badge: true,
  star_color: "#f59e0b",
  email_subject_en: "How was your purchase?",
  email_subject_zh: "您的购买体验如何？",
};

const sectionContent = {
  "review-requests": { title: "Review requests", description: "Control whether fulfilled orders can be added to the review request queue." },
  "request-scheduling": { title: "Request scheduling", description: "Choose how many days to wait after fulfillment before a review request is queued." },
  templates: { title: "Email templates", description: "Set the subject line used by V1 test review invitations." },
  display: { title: "Storefront display", description: "Control the verified-purchase label and star colour used in the storefront widgets." },
  language: { title: "Language & notifications", description: "Manage the English and Chinese subject lines shown in test review invitations." },
};

export function SettingsPanel({ request, onError, section }: Props) {
  const [settings, setSettings] = useState<ShopSettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const content = sectionContent[section];

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

  useEffect(() => {
    void load();
  }, [load]);

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

  return (
    <div className="tmr-settings-content">
      <div className="tmr-settings-content-heading">
        <div><Text as="h1" variant="headingLg">{content.title}</Text><Text as="p" tone="subdued">{content.description}</Text></div>
      </div>
      <Card>
        <FormLayout>
          {saved && <Banner tone="success">Settings saved.</Banner>}
          {section === "review-requests" && <>
            <Checkbox label="Enable automatic review requests" checked={settings.request_enabled} disabled={loading} onChange={(value) => setSettings((current) => ({ ...current, request_enabled: value }))} />
          </>}
          {section === "request-scheduling" && <>
            <TextField label="Delay after fulfillment (days)" type="number" min={0} max={90} value={String(settings.request_delay_days)} onChange={(value) => setSettings((current) => ({ ...current, request_delay_days: Math.min(90, Math.max(0, Number(value) || 0)) }))} autoComplete="off" helpText="Use 0 in the development store to queue an invitation immediately after fulfillment." disabled={loading} />
          </>}
          {(section === "templates" || section === "language") && <>
            <TextField label="Invitation subject (English)" value={settings.email_subject_en} onChange={(value) => setSettings((current) => ({ ...current, email_subject_en: value }))} autoComplete="off" disabled={loading} />
            <TextField label="Invitation subject (Chinese)" value={settings.email_subject_zh} onChange={(value) => setSettings((current) => ({ ...current, email_subject_zh: value }))} autoComplete="off" disabled={loading} />
          </>}
          {section === "display" && <>
            <Checkbox label="Show verified-purchase badge" checked={settings.show_verified_badge} disabled={loading} onChange={(value) => setSettings((current) => ({ ...current, show_verified_badge: value }))} />
            <TextField label="Star colour" value={settings.star_color} onChange={(value) => setSettings((current) => ({ ...current, star_color: value }))} autoComplete="off" helpText="Use a six-digit hexadecimal colour, for example #F59E0B." disabled={loading} />
          </>}
          <Button variant="primary" loading={saving} disabled={loading} onClick={() => void save()}>Save settings</Button>
        </FormLayout>
      </Card>
    </div>
  );
}
