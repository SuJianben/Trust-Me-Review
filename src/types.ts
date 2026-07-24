export type Locale = "en" | "zh-CN";
export type ReviewStatus = "pending" | "published" | "hidden" | "deleted";
export type QueueJob =
  | { type: "shopify_webhook"; deliveryId: string; topic: string; shopDomain: string; payload: unknown }
  | { type: "send_test_request"; requestId: string };
export interface Env {
  ASSETS: Fetcher;
  HYPERDRIVE: Hyperdrive;
  REVIEW_QUEUE: Queue<QueueJob>;
  APP_URL: string;
  SHOPIFY_API_KEY: string;
  SHOPIFY_API_SECRET: string;
  SHOPIFY_API_VERSION: string;
  TURNSTILE_SECRET: string;
  TURNSTILE_SITE_KEY: string;
  TOKEN_SECRET: string;
  DEFAULT_LOCALE: Locale;
}
