import type pg from "pg";
import type { Env } from "../../types";

type MissingProduct = { id: string; shopify_product_id: string; access_token: string | null };
type ProductNode = { id?: string; title?: string; handle?: string; featuredImage?: { url?: string } | null } | null;

export async function refreshMissingProductSnapshots(client: pg.Client, env: Env, shopDomain: string) {
  const missing = await client.query<MissingProduct>(`
    select distinct p.id,p.shopify_product_id,s.access_token
    from products p
    join shops s on s.id=p.shop_id
    where s.domain=$1 and (coalesce(p.title_snapshot,'')='' or coalesce(p.handle_snapshot,'')='' or coalesce(p.image_url,'')='')
    limit 30`, [shopDomain]);
  const accessToken = missing.rows[0]?.access_token;
  if (!missing.rowCount || !accessToken) return;

  const response = await fetch(`https://${shopDomain}/admin/api/${env.SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-shopify-access-token": accessToken },
    body: JSON.stringify({
      query: "query ProductDetails($ids:[ID!]!){ nodes(ids:$ids){ ... on Product { id title handle featuredImage { url } } } }",
      variables: { ids: missing.rows.map((product) => `gid://shopify/Product/${product.shopify_product_id}`) },
    }),
  });
  if (!response.ok) {
    console.warn("product_details_refresh_failed", { status: response.status, shopDomain });
    return;
  }

  const payload = await response.json() as { data?: { nodes?: ProductNode[] }; errors?: Array<{ message?: string }> };
  if (payload.errors?.length) {
    console.warn("product_details_refresh_graphql_error", { shopDomain, count: payload.errors.length });
    return;
  }
  const details = new Map((payload.data?.nodes ?? []).flatMap((node) => node?.id ? [[node.id.split("/").pop()!, { title: node.title ?? "", handle: node.handle ?? "", imageUrl: node.featuredImage?.url ?? "" }] as const] : []));
  for (const product of missing.rows) {
    const detail = details.get(product.shopify_product_id);
    if (detail) await client.query(`
      update products set
        title_snapshot=case when title_snapshot='' and $1 <> '' then $1 else title_snapshot end,
        handle_snapshot=case when handle_snapshot='' and $2 <> '' then $2 else handle_snapshot end,
        image_url=case when image_url='' and $3 <> '' then $3 else image_url end
      where id=$4`, [detail.title, detail.handle, detail.imageUrl, product.id]);
  }
}
