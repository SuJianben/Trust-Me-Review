import { Banner, Button, Card, Checkbox, FormLayout, Text, TextField } from "@shopify/polaris";
import type { AuthenticatedRequest } from "../../api";
import type { SettingsSection } from "./types";
import { useShopSettings } from "./useShopSettings";

type Props = {
  request: AuthenticatedRequest;
  onError: (message: string) => void;
  section: Extract<SettingsSection, "display" | "language">;
};

const sectionContent = {
  display: { title: "Storefront display", description: "Control the verified-purchase label and star colour used in the storefront widgets." },
  language: { title: "Language & notifications", description: "Manage the English and Chinese subject lines shown in test review invitations." },
};

export function SettingsPanel({ request, onError, section }: Props) {
  const { settings, setSettings, loading, saving, saved, save } = useShopSettings({ request, onError });
  const content = sectionContent[section];

  return (
    <div className="tmr-settings-content">
      <div className="tmr-settings-content-heading">
        <div><Text as="h1" variant="headingLg">{content.title}</Text><Text as="p" tone="subdued">{content.description}</Text></div>
      </div>
      <Card>
        <FormLayout>
          {saved && <Banner tone="success">Settings saved.</Banner>}
          {section === "language" && <>
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
