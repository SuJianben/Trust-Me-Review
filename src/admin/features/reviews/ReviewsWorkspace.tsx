import { Tabs } from "@shopify/polaris";
import { useState } from "react";
import type { AuthenticatedRequest } from "../../api";
import { TestDeliveriesPanel } from "../deliveries/TestDeliveriesPanel";
import { ReviewsPanel } from "./ReviewsPanel";

type ReviewsWorkspaceProps = {
  request: AuthenticatedRequest;
  onError: (message: string) => void;
  onClearError: () => void;
};

const reviewTabs = [
  { id: "reviews", content: "Reviews" },
  { id: "review-requests", content: "Review requests" },
];

export function ReviewsWorkspace({ request, onError, onClearError }: ReviewsWorkspaceProps) {
  const [selected, setSelected] = useState(0);

  return (
    <>
      <div className="tmr-child-page-tabs">
        <Tabs tabs={reviewTabs} selected={selected} onSelect={setSelected} />
      </div>
      {selected === 0 ? (
        <ReviewsPanel request={request} onError={onError} onClearError={onClearError} />
      ) : (
        <TestDeliveriesPanel request={request} onError={onError} />
      )}
    </>
  );
}
