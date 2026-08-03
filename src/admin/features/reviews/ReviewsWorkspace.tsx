import type { AuthenticatedRequest } from "../../api";
import { ReviewsPanel } from "./ReviewsPanel";

type ReviewsWorkspaceProps = {
  request: AuthenticatedRequest;
  onError: (message: string) => void;
  onClearError: () => void;
};

export function ReviewsWorkspace({ request, onError, onClearError }: ReviewsWorkspaceProps) {
  const productId = new URLSearchParams(location.search).get("product") ?? undefined;

  return <ReviewsPanel request={request} onError={onError} onClearError={onClearError} productId={productId} />;
}
