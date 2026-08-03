import { Banner, Button, Card, Text, TextField } from "@shopify/polaris";
import type { AuthenticatedRequest } from "../../api";
import { useShopSettings } from "./useShopSettings";

type Props = {
  request: AuthenticatedRequest;
  onError: (message: string) => void;
};

export function EmailTemplatesPanel({ request, onError }: Props) {
  const { settings, setSettings, loading, saving, saved, save } = useShopSettings({ request, onError });

  return (
    <div className="tmr-settings-content">
      <div className="tmr-settings-content-heading">
        <div>
          <Text as="h1" variant="headingLg">Email templates</Text>
          <Text as="p" tone="subdued">Set the bilingual subject lines recorded with each V1 test invitation.</Text>
        </div>
      </div>

      <Card>
        <div className="tmr-settings-form-heading">
          <Text as="h2" variant="headingMd">Invitation subject lines</Text>
          <Text as="p" tone="subdued">V1 stores a test delivery record and review link instead of sending a real customer email.</Text>
        </div>
        {saved && <Banner tone="success">Email template settings saved.</Banner>}
        <div className="tmr-settings-form-control tmr-settings-template-fields">
          <TextField label="Invitation subject (English)" value={settings.email_subject_en} onChange={(value) => setSettings((current) => ({ ...current, email_subject_en: value }))} autoComplete="off" disabled={loading} />
          <TextField label="Invitation subject (Chinese)" value={settings.email_subject_zh} onChange={(value) => setSettings((current) => ({ ...current, email_subject_zh: value }))} autoComplete="off" disabled={loading} />
        </div>
        <Button variant="primary" loading={saving} disabled={loading} onClick={() => void save()}>Save template</Button>
      </Card>
    </div>
  );
}
