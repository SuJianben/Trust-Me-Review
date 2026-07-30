import type pg from "pg";

export type AdminProductSummary = {
  shopify_product_id: string;
  title_snapshot: string;
  review_count: number;
  published_count: number;
  pending_count: number;
  average_rating: number;
  invitation_count: number;
  last_reviewed_at: string | null;
};

export async function listAdminProducts(client: pg.Client, shopDomain: string) {
  return client.query<AdminProductSummary>(`
    select
      p.shopify_product_id,
      p.title_snapshot,
      (select count(*)::int from reviews r where r.product_id = p.id and r.status <> 'deleted') as review_count,
      (select count(*)::int from reviews r where r.product_id = p.id and r.status = 'published') as published_count,
      (select count(*)::int from reviews r where r.product_id = p.id and r.status = 'pending') as pending_count,
      (select coalesce(avg(r.rating) filter (where r.status = 'published'), 0)::float8 from reviews r where r.product_id = p.id) as average_rating,
      (select count(*)::int from review_requests rr where rr.product_id = p.id) as invitation_count,
      (select max(r.created_at) from reviews r where r.product_id = p.id and r.status <> 'deleted') as last_reviewed_at
    from products p
    join shops s on s.id = p.shop_id
    where s.domain = $1
    order by
      (select count(*) from reviews r where r.product_id = p.id and r.status <> 'deleted') desc,
      p.title_snapshot asc
    limit 100
  `, [shopDomain]);
}
