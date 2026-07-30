export type SettingsSection = "review-requests" | "request-scheduling" | "templates" | "product-management" | "display" | "language";

export type ShopSettings = {
  request_enabled: boolean;
  request_delay_days: number;
  show_verified_badge: boolean;
  star_color: string;
  email_subject_en: string;
  email_subject_zh: string;
};

export type ManagedProduct = {
  shopify_product_id: string;
  title_snapshot: string;
  image_url: string;
  catalog_status: string;
  request_enabled: boolean;
  review_count: number;
  published_count: number;
  pending_count: number;
  average_rating: number;
  invitation_count: number;
  last_reviewed_at: string | null;
};

export type ManagedProductList = {
  products: ManagedProduct[];
  total: number;
  activeCount: number;
  inactiveCount: number;
};
