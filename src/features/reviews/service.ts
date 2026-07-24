import type pg from "pg";
import { sha256 } from "../../lib/crypto";

const prohibited = ["viagra", "casino", "click here"];
export function hasProhibitedText(value: string) { const plain = value.toLowerCase(); return prohibited.some((word) => plain.includes(word)); }
export async function ensureProduct(client: pg.Client, shopId: string, shopifyProductId: string) {
  const result = await client.query<{ id: string }>("insert into products(shop_id,shopify_product_id) values($1,$2) on conflict(shop_id,shopify_product_id) do update set shopify_product_id=excluded.shopify_product_id returning id", [shopId, shopifyProductId]);
  return result.rows[0].id;
}
export async function reservePublicSubmission(client: pg.Client, shopId: string, productId: string, ip: string) {
  const ipHash = await sha256(ip); const result = await client.query("insert into submission_limits(shop_id,ip_hash,product_id,window_start,count) values($1,$2,$3,date_trunc('day',now()),1) on conflict(shop_id,ip_hash,product_id,window_start) do update set count=submission_limits.count+1 where submission_limits.count < 3 returning count", [shopId, ipHash, productId]);
  return result.rowCount === 1;
}
export async function publicReviews(client: pg.Client, shopDomain: string, productExternalId: string, page: number) {
  const query = `select r.id,r.rating,r.title,r.body,r.author_name,r.verified_purchase,r.published_at,rr.body reply_body,
    count(*) over() as total, avg(r.rating) over() as average
    from reviews r join shops s on s.id=r.shop_id join products p on p.id=r.product_id left join review_replies rr on rr.review_id=r.id
    where s.domain=$1 and p.shopify_product_id=$2 and r.status='published' order by r.pinned desc,r.published_at desc limit 10 offset $3`;
  return (await client.query(query, [shopDomain, productExternalId, Math.max(0, page - 1) * 10])).rows;
}
