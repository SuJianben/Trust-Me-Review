import type pg from "pg";
import { sha256 } from "../../lib/crypto";

const prohibited = ["viagra", "casino", "click here"];
export function hasProhibitedText(value: string) { const plain = value.toLowerCase(); return prohibited.some((word) => plain.includes(word)); }
export async function ensureProduct(client: pg.Client, shopId: string, shopifyProductId: string, title?: string) {
  const result = await client.query<{ id: string }>("insert into products(shop_id,shopify_product_id,title_snapshot) values($1,$2,$3) on conflict(shop_id,shopify_product_id) do update set title_snapshot=case when excluded.title_snapshot <> '' then excluded.title_snapshot else products.title_snapshot end returning id", [shopId, shopifyProductId, title?.trim() ?? ""]);
  return result.rows[0].id;
}
export async function reservePublicSubmission(client: pg.Client, shopId: string, productId: string, ip: string) {
  const ipHash = await sha256(ip); const result = await client.query("insert into submission_limits(shop_id,ip_hash,product_id,window_start,count) values($1,$2,$3,date_trunc('day',now()),1) on conflict(shop_id,ip_hash,product_id,window_start) do update set count=submission_limits.count+1 where submission_limits.count < 3 returning count", [shopId, ipHash, productId]);
  return result.rowCount === 1;
}
export type StorefrontReviewSort = "newest" | "highest" | "lowest";

function storefrontOrder(sort: StorefrontReviewSort) {
  if (sort === "highest") return "r.pinned desc,r.rating desc,r.published_at desc";
  if (sort === "lowest") return "r.pinned desc,r.rating asc,r.published_at desc";
  return "r.pinned desc,r.published_at desc";
}

export async function publicReviews(client: pg.Client, shopDomain: string, productExternalId: string, page: number, sort: StorefrontReviewSort) {
  const query = `select r.id,r.rating,r.title,r.body,r.author_name,r.verified_purchase,r.published_at,rr.body reply_body,
    count(*) over() as total, avg(r.rating) over() as average
    from reviews r join shops s on s.id=r.shop_id join products p on p.id=r.product_id left join review_replies rr on rr.review_id=r.id
    where s.domain=$1 and p.shopify_product_id=$2 and r.status='published' order by ${storefrontOrder(sort)} limit 10 offset $3`;
  return (await client.query(query, [shopDomain, productExternalId, Math.max(0, page - 1) * 10])).rows;
}

export async function publicReviewSummary(client: pg.Client, shopDomain: string, productExternalId: string) {
  const result = await client.query<{ total: string; average: string; one: string; two: string; three: string; four: string; five: string }>(`
    select count(*) total, coalesce(avg(r.rating),0) average,
      count(*) filter (where r.rating=1) one, count(*) filter (where r.rating=2) two,
      count(*) filter (where r.rating=3) three, count(*) filter (where r.rating=4) four,
      count(*) filter (where r.rating=5) five
    from reviews r join shops s on s.id=r.shop_id join products p on p.id=r.product_id
    where s.domain=$1 and p.shopify_product_id=$2 and r.status='published'`, [shopDomain, productExternalId]);
  const row = result.rows[0];
  return {
    total: Number(row?.total ?? 0), average: Number(row?.average ?? 0),
    distribution: { 1: Number(row?.one ?? 0), 2: Number(row?.two ?? 0), 3: Number(row?.three ?? 0), 4: Number(row?.four ?? 0), 5: Number(row?.five ?? 0) },
  };
}
