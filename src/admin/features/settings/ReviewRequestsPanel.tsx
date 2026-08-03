import { Button, Card, Text } from "@shopify/polaris";
import "./review-requests.css";

type Props = {
  onManageEmailRequests: () => void;
};

type ChannelItem = {
  title: string;
  description: string;
  action: string;
  available?: boolean;
  status?: string;
};

const channels: ChannelItem[] = [
  {
    title: "Manage email review requests",
    description: "Collect product reviews automatically after a customer order is fulfilled.",
    action: "Manage",
    available: true,
    status: "Active",
  },
  {
    title: "Links, QR codes and point of sale review collection",
    description: "Share review links or QR codes in store materials and customer communications.",
    action: "Coming soon",
  },
  {
    title: "SMS requests",
    description: "Connect an SMS provider to deliver review requests by text message.",
    action: "Coming soon",
    status: "Planned",
  },
  {
    title: "Push notifications",
    description: "Send review reminders through supported push-notification providers.",
    action: "Coming soon",
    status: "Planned",
  },
  {
    title: "WhatsApp and email marketing integrations",
    description: "Connect future marketing integrations for additional review-collection channels.",
    action: "Coming soon",
  },
];

export function ReviewRequestsPanel({ onManageEmailRequests }: Props) {

  return (
    <div className="tmr-settings-content">
      <div className="tmr-settings-content-heading">
        <div>
          <Text as="h1" variant="headingLg">Review requests</Text>
          <Text as="p" tone="subdued">Choose how customers are invited to leave a product review.</Text>
        </div>
      </div>

      <Card>
        <div className="tmr-request-group-heading">
          <Text as="h2" variant="headingMd">Email review requests</Text>
          <Text as="p" tone="subdued">Send and manage review invitations for eligible fulfilled orders.</Text>
        </div>
        <div className="tmr-request-entry-list">
          <div className="tmr-request-entry tmr-request-entry-muted">
            <div><Text as="h3" variant="headingSm">Request reviews from previous Shopify orders</Text><Text as="p" tone="subdued">Schedule review requests in batches for orders placed before the app was installed.</Text></div>
            <Button disabled>Coming soon</Button>
          </div>
          <div className="tmr-request-entry tmr-request-entry-muted">
            <div><Text as="h3" variant="headingSm">Request reviews from customer segments or lists</Text><Text as="p" tone="subdued">Create requests from customer groups, imports, or individual customers outside Shopify.</Text></div>
            <Button disabled>Coming soon</Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="tmr-request-group-heading"><Text as="h2" variant="headingMd">Collection channels</Text></div>
        <div className="tmr-request-entry-list">
          {channels.map((channel) => <div className={`tmr-request-entry ${channel.available ? "tmr-request-entry-available" : "tmr-request-entry-muted"}`} key={channel.title}>
            <div>
              <div className="tmr-request-entry-title"><Text as="h3" variant="headingSm">{channel.title}</Text>{channel.status && <span className={channel.available ? "tmr-request-status-active" : "tmr-request-status-planned"}>{channel.status}</span>}</div>
              <Text as="p" tone="subdued">{channel.description}</Text>
            </div>
            {channel.available ? <Button onClick={onManageEmailRequests}>{channel.action}</Button> : <Button disabled>{channel.action}</Button>}
          </div>)}
        </div>
      </Card>
    </div>
  );
}
