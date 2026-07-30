export type DashboardMetric = {
  total_reviews: number;
  published_reviews: number;
  pending_reviews: number;
  average_rating: number;
  sent_requests: number;
  scheduled_requests: number;
};

export type DashboardProduct = {
  shopify_product_id: string;
  title_snapshot: string;
  review_count: number;
  average_rating: number;
};

export type DashboardReview = {
  id: string;
  author_name: string;
  rating: number;
  title: string | null;
  body: string;
  status: "pending" | "published" | "hidden" | "deleted";
  verified_purchase: boolean;
  created_at: string;
  title_snapshot: string;
};

export type DashboardData = {
  metrics: DashboardMetric;
  topProducts: DashboardProduct[];
  recentReviews: DashboardReview[];
};
