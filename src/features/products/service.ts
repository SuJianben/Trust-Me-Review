import type pg from "pg";
import type { Env } from "../../types";

type MissingProduct = { id: string; shopify_product_id: string; access_token: string | null };
type ProductNode = { id?: string; title?: string } | null;

export async function refreshMissingProductTitles(client: pg.Client, env: Env, shopDomain: string) {
  const missing = await client.query<MissingProduct>(`
    select distinct p.id,p.shopify_product_id,s.access_token
    from products p
    join shops s on s.id=p.shop_id
    where s.domain=$1 and coalesce(p.title_snapshot,'')=''
    limit 30`, [shopDomain]);
  const accessToken = missing.rows[0]?.access_token;
  if (!missing.rowCount || !accessToken) return;

  const response = await fetch(`https://${shopDomain}/admin/api/${env.SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-shopify-access-token": accessToken },
    body: JSON.stringify({
      query: "query ProductTitles($ids:[ID!]!){ nodes(ids:$ids){ ... on Product { id title } } }",
      variables: { ids: missing.rows.map((product) => `gid://shopify/Product/${product.shopify_product_id}`) },
    }),
  });
  if (!response.ok) {
    console.warn("product_title_refresh_failed", { status: response.status, shopDomain });
    return;
  }

  const payload = await response.json() as { data?: { nodes?: ProductNode[] }; errors?: Array<{ message?: string }> };
  if (payload.errors?.length) {
    console.warn("product_title_refresh_graphql_error", { shopDomain, count: payload.errors.length });
    return;
  }
  const titles = new Map((payload.data?.nodes ?? []).flatMap((node) => node?.id && node.title ? [[node.id.split("/").pop()!, node.title] as const] : []));
  for (const product of missing.rows) {
    const title = titles.get(product.shopify_product_id);
    if (title) await client.query("update products set title_snapshot=$1 where id=$2 and title_snapshot=''", [title, product.id]);
  }
}
