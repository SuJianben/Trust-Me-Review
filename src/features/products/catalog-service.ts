import type pg from "pg";
import type { Env } from "../../types";

type CatalogProduct = {
  id: string;
  title: string;
  handle: string;
  status: string;
  featuredImage: { url: string } | null;
};

type CatalogResponse = {
  data?: {
    products?: {
      nodes?: CatalogProduct[];
      pageInfo?: { hasNextPage: boolean; endCursor: string | null };
    };
  };
  errors?: Array<{ message?: string }>;
};

export type CatalogSyncResult = {
  synced: number;
  hasNextPage: boolean;
  nextCursor: string | null;
};

export async function syncProductCatalogPage(client: pg.Client, env: Env, shopDomain: string, cursor?: string | null): Promise<CatalogSyncResult> {
  const shop = await client.query<{ id: string; access_token: string | null }>(
    "select id,access_token from shops where domain=$1 and status='active'",
    [shopDomain],
  );
  if (!shop.rowCount || !shop.rows[0].access_token) throw new Error("SHOP_ACCESS_TOKEN_MISSING");

  const response = await fetch(`https://${shopDomain}/admin/api/${env.SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-shopify-access-token": shop.rows[0].access_token },
    body: JSON.stringify({
      query: `query ProductCatalog($after: String) {
        products(first: 100, after: $after, sortKey: TITLE) {
          nodes { id title handle status featuredImage { url } }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      variables: { after: cursor ?? null },
    }),
  });
  if (!response.ok) throw new Error(`SHOPIFY_PRODUCT_SYNC_FAILED_${response.status}`);

  const payload = await response.json() as CatalogResponse;
  if (payload.errors?.length) throw new Error("SHOPIFY_PRODUCT_SYNC_GRAPHQL_ERROR");
  const catalog = payload.data?.products;
  const products = catalog?.nodes ?? [];

  for (const product of products) {
    const shopifyProductId = product.id.split("/").pop();
    if (!shopifyProductId) continue;
    await client.query(`
      insert into products(shop_id,shopify_product_id,title_snapshot,handle_snapshot,image_url,catalog_status,catalog_synced_at)
      values($1,$2,$3,$4,$5,$6,now())
      on conflict(shop_id,shopify_product_id) do update set
        title_snapshot=excluded.title_snapshot,
        handle_snapshot=excluded.handle_snapshot,
        image_url=excluded.image_url,
        catalog_status=excluded.catalog_status,
        catalog_synced_at=excluded.catalog_synced_at`,
      [shop.rows[0].id, shopifyProductId, product.title, product.handle, product.featuredImage?.url ?? "", product.status],
    );
  }

  return {
    synced: products.length,
    hasNextPage: catalog?.pageInfo?.hasNextPage ?? false,
    nextCursor: catalog?.pageInfo?.endCursor ?? null,
  };
}
