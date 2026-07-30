import type pg from "pg";

export type AdminProductSummary = {
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

export type ProductRequestFilter = "all" | "active" | "inactive";

export type AdminProductList = {
  products: AdminProductSummary[];
  total: number;
  activeCount: number;
  inactiveCount: number;
};

export async function listAdminProducts(
  client: pg.Client,
  shopDomain: string,
  filter: ProductRequestFilter,
  page: number,
  search: string,
): Promise<AdminProductList> {
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * 50;
  const requestClause = filter === "active" ? "and p.request_enabled=true" : filter === "inactive" ? "and p.request_enabled=false" : "";
  const searchClause = search ? "and p.title_snapshot ilike $2" : "";
  const values: Array<string | number> = search ? [shopDomain, `%${search}%`, 50, offset] : [shopDomain, 50, offset];
  const limitIndex = search ? "$3" : "$2";
  const offsetIndex = search ? "$4" : "$3";
  const products = await client.query<AdminProductSummary>(`
    select
      p.shopify_product_id,
      p.title_snapshot,
      p.image_url,
      p.catalog_status,
      p.request_enabled,
      (select count(*)::int from reviews r where r.product_id = p.id and r.status <> 'deleted') as review_count,
      (select count(*)::int from reviews r where r.product_id = p.id and r.status = 'published') as published_count,
      (select count(*)::int from reviews r where r.product_id = p.id and r.status = 'pending') as pending_count,
      (select coalesce(avg(r.rating) filter (where r.status = 'published'), 0)::float8 from reviews r where r.product_id = p.id) as average_rating,
      (select count(*)::int from review_requests rr where rr.product_id = p.id) as invitation_count,
      (select max(r.created_at) from reviews r where r.product_id = p.id and r.status <> 'deleted') as last_reviewed_at
    from products p
    join shops s on s.id = p.shop_id
    where s.domain = $1 ${requestClause} ${searchClause}
    order by
      p.title_snapshot asc
    limit ${limitIndex} offset ${offsetIndex}
  `, values);
  const counts = await client.query<{ total: string; active_count: string; inactive_count: string }>(`
    select count(*) as total,
      count(*) filter (where p.request_enabled) as active_count,
      count(*) filter (where not p.request_enabled) as inactive_count
    from products p join shops s on s.id=p.shop_id
    where s.domain=$1`, [shopDomain]);
  const row = counts.rows[0];
  return {
    products: products.rows,
    total: Number(row?.total ?? 0),
    activeCount: Number(row?.active_count ?? 0),
    inactiveCount: Number(row?.inactive_count ?? 0),
  };
}

export async function updateProductRequestEnabled(client: pg.Client, shopDomain: string, shopifyProductId: string, requestEnabled: boolean) {
  const updated = await client.query<{ id: string; shop_id: string }>(`
    update products p set request_enabled=$1
    from shops s
    where p.shop_id=s.id and s.domain=$2 and p.shopify_product_id=$3
    returning p.id,p.shop_id`, [requestEnabled, shopDomain, shopifyProductId]);
  return updated.rows[0] ?? null;
}

export async function productRequestsEnabled(client: pg.Client, productId: string) {
  const result = await client.query<{ request_enabled: boolean }>("select request_enabled from products where id=$1", [productId]);
  return result.rows[0]?.request_enabled ?? true;
}
