export type ProductSummary = { shopify_product_id: string; title_snapshot: string; review_count: number; published_count: number; average_rating: number };
export type ProductReview = { id: string; rating: number; author_name: string; title: string | null; body: string; status: string; verified_purchase: boolean; created_at: string; reply_body?: string };
export type ProductDetail = ProductSummary & { reviews: ProductReview[] };
