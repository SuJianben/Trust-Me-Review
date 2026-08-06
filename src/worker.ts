import { Hono } from "hono";
import { cors } from "hono/cors";
import type pg from "pg";
import type { Env, QueueJob, ReviewStatus } from "./types";
import { withDb, audit } from "./services/db";
import { validWebhook, verifyTurnstile } from "./services/shopify";
import { verifyAdminSession, createOAuthState, validOAuthState } from "./lib/auth";
import { ensureManagedShop } from "./features/shops/service";
import { blocklistEntrySchema, publicReviewSchema, invitationBatchReviewSchema, moderationSchema, replySchema, settingsSchema } from "./features/reviews/schemas";
import { ensureProduct, hasProhibitedText, publicReviews, publicReviewSummary, reservePublicSubmission, type StorefrontReviewSort } from "./features/reviews/service";
import { validateReviewMedia } from "./features/reviews/media-rules";
import { deleteShopifyReviewMedia, removeExpiredReviewMedia, resolveShopifyMediaUrl, uploadReviewMediaToShopifyFiles } from "./features/reviews/shopify-media-service";
import { refreshMissingProductSnapshots } from "./features/products/service";
import { getAdminProductDetail, listAdminProducts, updateProductRequestEnabled, type ProductRequestFilter } from "./features/products/admin-service";
import { productRequestSettingSchema } from "./features/products/schemas";
import { createTestDelivery, queueDueRequests, recordTestDeliveryFailure, retryFailedTestDelivery } from "./features/requests/service";
import { groupTestDeliveryRows } from "./features/requests/delivery-view-service";
import { toInvitationProducts } from "./features/requests/invitation-view-service";
import { maskEmail, scheduleFulfilledOrderRequests, type RequestSchedulingSettings } from "./features/requests/scheduling-service";
import { randomToken, sha256, sha256Bytes } from "./lib/crypto";
import { cancelOutstandingRequests, eraseShopData, recordDataRequest, redactCustomerData } from "./features/privacy/service";
import { hasRequiredShopifyWebhookHeaders, shouldQueueWebhook } from "./features/webhooks/security";

export const app = new Hono<{ Bindings: Env; Variables: { admin?: { shopDomain: string; userId: string; sessionToken: string } } }>();
app.onError((error, ctx) => {
  console.error("request_failed", { method: ctx.req.method, path: new URL(ctx.req.url).pathname, error: error instanceof Error ? error.message : String(error) });
  return ctx.json({ error: "Internal server error" }, 500);
});
app.use("/api/storefront/*", cors({ origin: "*", allowMethods: ["GET", "POST"] }));
app.use("/api/review-media/*", cors({ origin: "*", allowMethods: ["GET"] }));
app.use("/api/admin/*", async (ctx, next) => {
  const admin = await verifyAdminSession(ctx.req.raw, ctx.env);
  if (!admin) return ctx.json({ error: "Unauthorized" }, 401);
  await ensureManagedShop(ctx.env, admin);
  ctx.set("admin", admin);
  await next();
});
app.get("/health", (ctx) => ctx.json({ ok: true, service: "trust-me-review" }));
app.get("/", async (ctx) => {
  const asset = await ctx.env.ASSETS.fetch(ctx.req.raw);
  const html = (await asset.text()).replace("REPLACE_WITH_SHOPIFY_API_KEY", ctx.env.SHOPIFY_API_KEY);
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
});

app.get("/auth", async (ctx) => {
  const shop = ctx.req.query("shop")?.toLowerCase(); if (!shop || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) return ctx.text("Invalid shop", 400);
  const state = await createOAuthState(shop, ctx.env); const params = new URLSearchParams({ client_id: ctx.env.SHOPIFY_API_KEY, scope: "read_products,read_orders,read_files,write_files", redirect_uri: `${ctx.env.APP_URL}/auth/callback`, state });
  return ctx.redirect(`https://${shop}/admin/oauth/authorize?${params}`);
});
app.get("/auth/callback", async (ctx) => {
  const shop = ctx.req.query("shop") ?? ""; const code = ctx.req.query("code") ?? ""; const state = ctx.req.query("state") ?? "";
  if (!code || !(await validOAuthState(shop, state, ctx.env))) return ctx.text("Invalid OAuth callback", 401);
  const exchange = await fetch(`https://${shop}/admin/oauth/access_token`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_id: ctx.env.SHOPIFY_API_KEY, client_secret: ctx.env.SHOPIFY_API_SECRET, code }) });
  if (!exchange.ok) return ctx.text("Shopify token exchange failed", 502);
  const token = await exchange.json() as { access_token: string };
  await withDb(ctx.env, async (db) => { await db.query(`insert into shops(shopify_shop_id,domain,access_token) values($1,$2,$3) on conflict(domain) do update set access_token=excluded.access_token,status='active',updated_at=now()`, [shop, shop, token.access_token]); await db.query("insert into shop_settings(shop_id) select id from shops where domain=$1 on conflict do nothing", [shop]); });
  console.info("shop_oauth_completed", { shopDomain: shop });
  return ctx.redirect(`https://${shop}/admin/apps/${ctx.env.SHOPIFY_API_KEY}`);
});

app.get("/api/storefront/products/:productId/reviews", async (ctx) => {
  const shop = ctx.req.query("shop"); if (!shop) return ctx.json({ error: "shop is required" }, 400);
  const page = Math.max(1, Number(ctx.req.query("page") ?? 1));
  const requestedSort = ctx.req.query("sort");
  const sort: StorefrontReviewSort = requestedSort === "highest" || requestedSort === "lowest" ? requestedSort : "newest";
  const data = await withDb(ctx.env, async (db) => {
    const [reviews, summary] = await Promise.all([publicReviews(db, shop, ctx.req.param("productId"), page, sort), publicReviewSummary(db, shop, ctx.req.param("productId"))]);
    return { reviews, summary };
  });
  return ctx.json({ reviews: data.reviews.map(({ total: _total, average: _average, ...review }) => review), ...data.summary, page, pageSize: 10, sort });
});

app.post("/api/storefront/reviews", async (ctx) => {
  const input = publicReviewSchema.safeParse(await ctx.req.json()); if (!input.success) return ctx.json({ error: input.error.flatten() }, 400);
  if (input.data.website || hasProhibitedText(`${input.data.title ?? ""} ${input.data.body}`)) return ctx.json({ error: "Submission was rejected" }, 422);
  const remoteIp = ctx.req.header("CF-Connecting-IP") ?? "unknown";
  if (!(await verifyTurnstile(input.data.turnstileToken, remoteIp, ctx.env))) return ctx.json({ error: "Bot verification failed" }, 400);
  const result = await withDb(ctx.env, async (db) => {
    const shop = await db.query<{ id: string }>("select id from shops where domain=$1 and status='active'", [input.data.shopDomain]); if (!shop.rowCount) return null;
    const productId = await ensureProduct(db, shop.rows[0].id, input.data.productId, input.data.productTitle); if (!(await reservePublicSubmission(db, shop.rows[0].id, productId, remoteIp))) throw new Error("RATE_LIMITED");
    const duplicate = await db.query("select 1 from reviews where shop_id=$1 and product_id=$2 and body=$3 and status <> 'deleted'", [shop.rows[0].id, productId, input.data.body]); if (duplicate.rowCount) throw new Error("DUPLICATE");
    const created = await db.query<{ id: string }>("insert into reviews(shop_id,product_id,rating,title,body,author_name,status,source) values($1,$2,$3,$4,$5,$6,'pending','public') returning id", [shop.rows[0].id,productId,input.data.rating,input.data.title ?? null,input.data.body,input.data.authorName]);
    await db.query("insert into analytics_events(shop_id,event_name,properties) values($1,'review_submitted',$2)", [shop.rows[0].id, JSON.stringify({ source: "public" })]); return created.rows[0];
  }).catch((error) => { if (error instanceof Error && ["RATE_LIMITED","DUPLICATE"].includes(error.message)) return error.message; throw error; });
  if (typeof result === "string") return ctx.json({ error: result === "RATE_LIMITED" ? "Too many submissions" : "A similar review already exists" }, 429);
  if (!result) {
    console.warn("public_review_unknown_store", { shopDomain: input.data.shopDomain });
    return ctx.json({ error: "Store connection is incomplete" }, 404);
  }
  return ctx.json({ id: result.id, status: "pending" }, 201);
});

app.get("/api/invitations/:token", async (ctx) => {
  const tokenHash = await sha256(ctx.req.param("token"));
  const invitation = await withDb(ctx.env, async (db) => {
    const request = await db.query<{ shop_id: string; shopify_order_id: string }>("select shop_id,shopify_order_id from review_requests where token_hash=$1 and status in ('sent','submitted')", [tokenHash]);
    if (!request.rowCount) return null;
    const value = request.rows[0];
    const products = await db.query<{ request_id: string; product_id: string; product_title: string; status: "sent" | "submitted" }>(`
      select rr.id request_id,p.shopify_product_id product_id,p.title_snapshot product_title,rr.status
      from review_requests rr join products p on p.id=rr.product_id
      where rr.shop_id=$1 and rr.shopify_order_id=$2 and rr.status in ('sent','submitted')
      order by rr.created_at asc`, [value.shop_id, value.shopify_order_id]);
    return { orderId: value.shopify_order_id, products: toInvitationProducts(products.rows) };
  });
  if (!invitation) return ctx.json({ error: "Invitation is invalid or already used" }, 404);
  return ctx.json(invitation);
});

app.post("/api/invitations/:token/media", async (ctx) => {
  const form = await ctx.req.formData();
  const requestId = form.get("requestId");
  const file = form.get("file");
  if (typeof requestId !== "string" || !(file instanceof File)) return ctx.json({ error: "A product and file are required." }, 400);
  const validation = validateReviewMedia(file.type, file.size);
  if (!validation.ok) return ctx.json({ error: validation.error }, 400);
  const contentHash = await sha256Bytes(await file.arrayBuffer());
  const tokenHash = await sha256(ctx.req.param("token"));
  const upload = await withDb(ctx.env, async (db) => {
    const request = await db.query<{ shop_id: string; domain: string; access_token: string | null }>(`
      select target.shop_id,s.domain,s.access_token
      from review_requests source
      join review_requests target on target.shop_id=source.shop_id and target.shopify_order_id=source.shopify_order_id
      join shops s on s.id=target.shop_id
      where source.token_hash=$1 and source.status in ('sent','submitted') and target.id=$2 and target.status='sent'`, [tokenHash, requestId]);
    return request.rows[0] ?? null;
  });
  if (!upload) return ctx.json({ error: "This product invitation is no longer available." }, 409);
  if (!upload.access_token) return ctx.json({ error: "Shopify Files access is unavailable. Reinstall the app to grant file permission." }, 409);
  const existing = await withDb(ctx.env, async (db) => db.query<{ id: string; media_kind: "image" | "video" }>(`
    select id,media_kind from review_media
    where shop_id=$1 and review_request_id=$2 and content_sha256=$3 and review_id is null
    limit 1`, [upload.shop_id, requestId, contentHash]));
  if (existing.rows[0]) {
    console.info("invitation_review_media_deduplicated", { requestId, kind: existing.rows[0].media_kind });
    return ctx.json({ id: existing.rows[0].id, kind: existing.rows[0].media_kind });
  }
  const stored = await uploadReviewMediaToShopifyFiles(ctx.env, { shopDomain: upload.domain, accessToken: upload.access_token, requestId, file, kind: validation.kind });
  try {
    const media = await withDb(ctx.env, async (db) => db.query<{ id: string }>(`
      insert into review_media(shop_id,review_request_id,object_key,storage_provider,shopify_file_id,storage_url,file_status,media_kind,content_type,byte_size,content_sha256)
      values($1,$2,$3,'shopify_files',$4,$5,$6,$7,$8,$9,$10)
      on conflict (review_request_id,content_sha256) where review_id is null and content_sha256 is not null do nothing
      returning id`, [upload.shop_id, requestId, `shopify-file:${stored.shopifyFileId}`, stored.shopifyFileId, stored.storageUrl, stored.fileStatus, validation.kind, file.type, file.size, contentHash]));
    if (!media.rows[0]) {
      await deleteShopifyReviewMedia(ctx.env, upload.domain, upload.access_token, [stored.shopifyFileId]);
      const duplicate = await withDb(ctx.env, async (db) => db.query<{ id: string; media_kind: "image" | "video" }>(`
        select id,media_kind from review_media
        where shop_id=$1 and review_request_id=$2 and content_sha256=$3 and review_id is null
        limit 1`, [upload.shop_id, requestId, contentHash]));
      if (duplicate.rows[0]) {
        console.info("invitation_review_media_deduplicated", { requestId, kind: duplicate.rows[0].media_kind });
        return ctx.json({ id: duplicate.rows[0].id, kind: duplicate.rows[0].media_kind });
      }
      throw new Error("MEDIA_DEDUPLICATION_FAILED");
    }
    console.info("invitation_review_media_uploaded", { requestId, kind: validation.kind, byteSize: file.size });
    return ctx.json({ id: media.rows[0].id, kind: validation.kind }, 201);
  } catch (error) {
    await deleteShopifyReviewMedia(ctx.env, upload.domain, upload.access_token, [stored.shopifyFileId]);
    throw error;
  }
});

app.delete("/api/invitations/:token/media/:id", async (ctx) => {
  const tokenHash = await sha256(ctx.req.param("token"));
  const media = await withDb(ctx.env, async (db) => {
    const row = await db.query<{ shopify_file_id: string | null; domain: string; access_token: string | null }>(`
      select rm.shopify_file_id,s.domain,s.access_token
      from review_media rm
      join review_requests target on target.id=rm.review_request_id
      join review_requests source on source.shop_id=target.shop_id and source.shopify_order_id=target.shopify_order_id
      join shops s on s.id=target.shop_id
      where source.token_hash=$1 and source.status in ('sent','submitted') and rm.id=$2 and rm.review_id is null`, [tokenHash, ctx.req.param("id")]);
    if (!row.rowCount) return null;
    return row.rows[0];
  });
  if (!media) return ctx.json({ error: "Media upload not found." }, 404);
  await deleteShopifyReviewMedia(ctx.env, media.domain, media.access_token, [media.shopify_file_id]);
  await withDb(ctx.env, (db) => db.query("delete from review_media where id=$1 and review_id is null", [ctx.req.param("id")]));
  return ctx.json({ ok: true });
});

app.get("/api/review-media/:id", async (ctx) => {
  const media = await withDb(ctx.env, async (db) => db.query<{ shopify_file_id: string | null; storage_url: string | null; domain: string; access_token: string | null }>(`
    select rm.shopify_file_id,rm.storage_url,s.domain,s.access_token from review_media rm
    join reviews r on r.id=rm.review_id join shops s on s.id=rm.shop_id
    where rm.id=$1 and r.status='published'`, [ctx.req.param("id")]));
  if (!media.rowCount) return ctx.text("Not found", 404);
  const current = media.rows[0];
  let mediaUrl = current.storage_url;
  if (!mediaUrl && current.shopify_file_id && current.access_token) {
    const resolved = await resolveShopifyMediaUrl(ctx.env, current.domain, current.access_token, current.shopify_file_id);
    mediaUrl = resolved?.storageUrl ?? null;
    if (resolved) await withDb(ctx.env, (db) => db.query("update review_media set storage_url=$1,file_status=$2 where id=$3", [resolved.storageUrl, resolved.fileStatus, ctx.req.param("id")]));
  }
  if (!mediaUrl) return ctx.text("Media is still processing", 404);
  return ctx.redirect(mediaUrl, 302);
});

app.post("/api/invitations/:token/reviews", async (ctx) => {
  const input = invitationBatchReviewSchema.safeParse(await ctx.req.json()); if (!input.success) return ctx.json({ error: input.error.flatten() }, 400);
  if (input.data.reviews.some((review) => hasProhibitedText(`${review.title ?? ""} ${review.body}`))) return ctx.json({ error: "Submission was rejected" }, 422);
  const tokenHash = await sha256(ctx.req.param("token"));
  const created = await withDb(ctx.env, async (db) => {
    await db.query("begin");
    try {
      const request = await db.query<{ shop_id: string; shopify_order_id: string }>("select shop_id,shopify_order_id from review_requests where token_hash=$1 and status in ('sent','submitted') for update", [tokenHash]);
      if (!request.rowCount) { await db.query("rollback"); return null; }
      const value = request.rows[0];
      const requestedIds = input.data.reviews.map((review) => review.requestId);
      const requests = await db.query<{ id: string; product_id: string; shopify_variant_id: string | null; customer_email_hash: string }>(`
        select id,product_id,shopify_variant_id,customer_email_hash
        from review_requests
        where shop_id=$1 and shopify_order_id=$2 and id = any($3::uuid[]) and status='sent'
        for update`, [value.shop_id, value.shopify_order_id, requestedIds]);
      if (requests.rowCount !== requestedIds.length) { await db.query("rollback"); return "unavailable" as const; }
      const requestsById = new Map(requests.rows.map((row) => [row.id, row]));
      const reviewIds: string[] = [];
      for (const reviewInput of input.data.reviews) {
        const target = requestsById.get(reviewInput.requestId)!;
        const review = await db.query<{ id: string }>("insert into reviews(shop_id,product_id,shopify_order_id,shopify_variant_id,rating,title,body,author_name,author_email_hash,status,source,verified_purchase) values($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending','invitation',true) returning id", [value.shop_id,target.product_id,value.shopify_order_id,target.shopify_variant_id,reviewInput.rating,reviewInput.title ?? null,reviewInput.body,input.data.authorName,target.customer_email_hash]);
        reviewIds.push(review.rows[0].id);
        if (reviewInput.mediaIds.length) {
          const attached = await db.query(`
            update review_media set review_id=$1
            where shop_id=$2 and review_request_id=$3 and id = any($4::uuid[]) and review_id is null
            returning id`, [review.rows[0].id, value.shop_id, target.id, reviewInput.mediaIds]);
          if (attached.rowCount !== reviewInput.mediaIds.length) throw new Error("MEDIA_ATTACHMENT_UNAVAILABLE");
        }
        await db.query("update review_requests set status='submitted',submitted_at=now(),updated_at=now() where id=$1", [target.id]);
      }
      await db.query("insert into analytics_events(shop_id,event_name,properties) values($1,'invitation_review_batch_submitted',$2)", [value.shop_id, JSON.stringify({ orderId: value.shopify_order_id, productCount: reviewIds.length, verifiedPurchase: true })]);
      await db.query("commit");
      return reviewIds;
    } catch (error) {
      try { await db.query("rollback"); } catch { /* preserve the original error */ }
      throw error;
    }
  });
  if (!created) return ctx.json({ error: "Invitation is invalid or already used" }, 404);
  if (created === "unavailable") return ctx.json({ error: "One or more requested products are no longer available" }, 409);
  return ctx.json({ ids: created, status: "pending", verifiedPurchase: true }, 201);
});

app.get("/api/admin/dashboard", async (ctx) => {
  const admin = ctx.get("admin")!;
  await withDb(ctx.env, (db) => refreshMissingProductSnapshots(db, ctx.env, admin.shopDomain));
  const data = await withDb(ctx.env, async (db) => {
    const metrics = await db.query<{
      total_reviews: number; published_reviews: number; pending_reviews: number;
      average_rating: number; sent_requests: number; scheduled_requests: number;
    }>(`
      select
        (select count(*)::int from reviews r where r.shop_id = s.id and r.status <> 'deleted') as total_reviews,
        (select count(*)::int from reviews r where r.shop_id = s.id and r.status = 'published') as published_reviews,
        (select count(*)::int from reviews r where r.shop_id = s.id and r.status = 'pending') as pending_reviews,
        (select coalesce(avg(r.rating), 0)::float8 from reviews r where r.shop_id = s.id and r.status = 'published') as average_rating,
        (select count(distinct rr.shopify_order_id)::int from review_requests rr where rr.shop_id = s.id and rr.status in ('sent', 'submitted')) as sent_requests,
        (select count(distinct rr.shopify_order_id)::int from review_requests rr where rr.shop_id = s.id and rr.status = 'scheduled') as scheduled_requests
      from shops s where s.domain = $1
    `, [admin.shopDomain]);
    const topProducts = await db.query(`
      select p.shopify_product_id, p.title_snapshot,
        count(r.id) filter (where r.status <> 'deleted')::int as review_count,
        coalesce(avg(r.rating) filter (where r.status = 'published'), 0)::float8 as average_rating
      from products p
      join shops s on s.id = p.shop_id
      left join reviews r on r.product_id = p.id
      where s.domain = $1
      group by p.id, p.shopify_product_id, p.title_snapshot
      having count(r.id) filter (where r.status <> 'deleted') > 0
      order by count(r.id) filter (where r.status <> 'deleted') desc, p.title_snapshot asc
      limit 5
    `, [admin.shopDomain]);
    const recentReviews = await db.query(`
      select r.id, r.author_name, r.rating, r.title, r.body, r.status, r.verified_purchase, r.created_at, p.title_snapshot
      from reviews r
      join shops s on s.id = r.shop_id
      join products p on p.id = r.product_id
      where s.domain = $1 and r.status <> 'deleted'
      order by r.created_at desc
      limit 5
    `, [admin.shopDomain]);
    return { metrics: metrics.rows[0], topProducts: topProducts.rows, recentReviews: recentReviews.rows };
  });
  return ctx.json(data);
});

app.get("/api/admin/reviews", async (ctx) => {
  const admin = ctx.get("admin")!; const page = Math.max(1, Number(ctx.req.query("page") ?? 1));
  const requestedStatus = ctx.req.query("status");
  const status = ["pending", "published", "hidden", "deleted"].includes(requestedStatus ?? "") ? requestedStatus as ReviewStatus : null;
  const source = ["public", "invitation"].includes(ctx.req.query("source") ?? "") ? ctx.req.query("source")! : null;
  const rating = ["1", "2", "3", "4", "5"].includes(ctx.req.query("rating") ?? "") ? Number(ctx.req.query("rating")) : null;
  const search = ctx.req.query("q")?.trim().slice(0, 120) || null;
  const productId = ctx.req.query("product")?.trim().slice(0, 50) || null;
  await withDb(ctx.env, (db) => refreshMissingProductSnapshots(db, ctx.env, admin.shopDomain));
  const result = await withDb(ctx.env, async (db) => {
    const values: Array<string | number> = [admin.shopDomain];
    const conditions = ["s.domain=$1"];
    if (status) { values.push(status); conditions.push(`r.status=$${values.length}::review_status`); }
    if (source) { values.push(source); conditions.push(`r.source=$${values.length}`); }
    if (rating) { values.push(rating); conditions.push(`r.rating=$${values.length}`); }
    if (search) { values.push(search); conditions.push(`(r.author_name ilike '%' || $${values.length} || '%' or coalesce(r.title,'') ilike '%' || $${values.length} || '%' or r.body ilike '%' || $${values.length} || '%')`); }
    if (productId) { values.push(productId); conditions.push(`p.shopify_product_id=$${values.length}`); }
    values.push((page - 1) * 30);
    return db.query(`select r.*,p.shopify_product_id,p.title_snapshot,rr.body reply_body,
      coalesce((select json_agg(json_build_object('id',rm.id,'kind',rm.media_kind,'storageUrl',rm.storage_url,'fileStatus',rm.file_status,'shopifyFileId',rm.shopify_file_id) order by rm.created_at asc)
        from review_media rm where rm.review_id=r.id), '[]'::json) media,
      count(*) over() total
      from reviews r join shops s on s.id=r.shop_id join products p on p.id=r.product_id left join review_replies rr on rr.review_id=r.id where ${conditions.join(" and ")} order by r.created_at desc limit 30 offset $${values.length}`, values);
  });
  const unresolvedMedia = result.rows.flatMap((review) => (review.media as Array<{ id: string; storageUrl: string | null; shopifyFileId: string | null; fileStatus: string }> ?? [])
    .filter((media) => !media.storageUrl && media.shopifyFileId));
  if (unresolvedMedia.length) {
    const shop = await withDb(ctx.env, (db) => db.query<{ access_token: string | null }>("select access_token from shops where domain=$1", [admin.shopDomain]));
    const accessToken = shop.rows[0]?.access_token;
    if (accessToken) {
      for (const media of unresolvedMedia) {
        try {
          const resolved = await resolveShopifyMediaUrl(ctx.env, admin.shopDomain, accessToken, media.shopifyFileId!);
          if (!resolved) continue;
          media.storageUrl = resolved.storageUrl;
          media.fileStatus = resolved.fileStatus;
          await withDb(ctx.env, (db) => db.query("update review_media set storage_url=$1,file_status=$2 where id=$3", [resolved.storageUrl, resolved.fileStatus, media.id]));
        } catch (error) {
          console.warn("admin_review_media_refresh_failed", { mediaId: media.id, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }
  }
  return ctx.json({ reviews: result.rows, total: Number(result.rows[0]?.total ?? 0), page });
});
app.get("/api/admin/products", async (ctx) => {
  const admin = ctx.get("admin")!;
  const filter = ctx.req.query("filter") === "active" || ctx.req.query("filter") === "inactive" ? ctx.req.query("filter") as ProductRequestFilter : "all";
  const page = Math.max(1, Number(ctx.req.query("page") ?? 1) || 1);
  const search = (ctx.req.query("search") ?? "").trim().slice(0, 120);
  await withDb(ctx.env, (db) => refreshMissingProductSnapshots(db, ctx.env, admin.shopDomain));
  return ctx.json(await withDb(ctx.env, (db) => listAdminProducts(db, admin.shopDomain, filter, page, search)));
});
app.get("/api/admin/products/:productId", async (ctx) => {
  const admin = ctx.get("admin")!;
  await withDb(ctx.env, (db) => refreshMissingProductSnapshots(db, ctx.env, admin.shopDomain));
  const product = await withDb(ctx.env, (db) => getAdminProductDetail(db, admin.shopDomain, ctx.req.param("productId"), {
    range: ctx.req.query("range"),
    startDate: ctx.req.query("start"),
    endDate: ctx.req.query("end"),
  }));
  return product ? ctx.json(product) : ctx.json({ error: "Product not found" }, 404);
});
app.patch("/api/admin/products/:productId", async (ctx) => {
  const admin = ctx.get("admin")!;
  const input = productRequestSettingSchema.safeParse(await ctx.req.json());
  if (!input.success) return ctx.json({ error: input.error.flatten() }, 400);
  const updated = await withDb(ctx.env, async (db) => {
    const product = await updateProductRequestEnabled(db, admin.shopDomain, ctx.req.param("productId"), input.data.requestEnabled);
    if (product) {
      const action = input.data.requestEnabled ? "product_review_requests_enabled" : "product_review_requests_disabled";
      await audit(db, product.shop_id, action, "product", product.id, admin.userId);
      await db.query("insert into analytics_events(shop_id,event_name,properties) values($1,$2,$3)", [product.shop_id, "product_review_request_setting_updated", JSON.stringify({ enabled: input.data.requestEnabled })]);
    }
    return product;
  });
  return updated ? ctx.json({ ok: true }) : ctx.json({ error: "Product not found" }, 404);
});
app.patch("/api/admin/reviews/:id", async (ctx) => {
  const admin = ctx.get("admin")!; const input = moderationSchema.safeParse(await ctx.req.json()); if (!input.success) return ctx.json({ error: input.error.flatten() }, 400);
  const updated = await withDb(ctx.env, async (db) => {
    const row = await db.query<{ id: string; shop_id: string }>(`
      update reviews r
      set status = coalesce($1::review_status, r.status),
          pinned = coalesce($2, pinned),
          published_at = case when coalesce($1::review_status, r.status) = 'published'::review_status and published_at is null then now() else published_at end,
          deleted_at = case when coalesce($1::review_status, r.status) = 'deleted'::review_status then now() else null end,
          updated_at = now()
      from shops s
      where r.shop_id = s.id and s.domain = $3 and r.id = $4
      returning r.id, r.shop_id`,
      [input.data.status, input.data.pinned ?? null, admin.shopDomain, ctx.req.param("id")],
    );
    if (row.rowCount) await audit(db, row.rows[0].shop_id, `review_${input.data.status}`, "review", row.rows[0].id, admin.userId, { pinned: input.data.pinned });
    return row.rows[0];
  });
  if (!updated) return ctx.json({ error: "Review not found" }, 404);
  return ctx.json(updated);
});
app.post("/api/admin/reviews/:id/reply", async (ctx) => {
  const admin = ctx.get("admin")!; const input = replySchema.safeParse(await ctx.req.json()); if (!input.success) return ctx.json({ error: input.error.flatten() }, 400);
  const reply = await withDb(ctx.env, async (db) => { const review = await db.query<{ shop_id:string }>("select r.shop_id from reviews r join shops s on s.id=r.shop_id where r.id=$1 and s.domain=$2", [ctx.req.param("id"),admin.shopDomain]); if (!review.rowCount) return null; await db.query("insert into review_replies(review_id,shop_id,body,editor_user_id) values($1,$2,$3,$4) on conflict(review_id) do update set body=excluded.body,editor_user_id=excluded.editor_user_id,updated_at=now()", [ctx.req.param("id"),review.rows[0].shop_id,input.data.body,admin.userId]); await audit(db,review.rows[0].shop_id,"review_replied","review",ctx.req.param("id"),admin.userId); return { ok:true }; }); return reply ? ctx.json(reply) : ctx.json({ error:"Review not found" },404);
});
app.get("/api/admin/settings", async (ctx) => {
  const admin = ctx.get("admin")!;
  const row = await withDb(ctx.env, (db) => db.query("select ss.* from shop_settings ss join shops s on s.id=ss.shop_id where s.domain=$1", [admin.shopDomain]));
  return ctx.json(row.rows[0] ?? {});
});
app.patch("/api/admin/settings", async (ctx) => {
  const admin = ctx.get("admin")!;
  const input = settingsSchema.safeParse(await ctx.req.json());
  if (!input.success) return ctx.json({ error: input.error.flatten() }, 400);
  await withDb(ctx.env, async (db) => {
    const updated = await db.query<{ shop_id: string }>(`
      update shop_settings ss set
        request_enabled=$1,request_delay_days=$2,max_products_per_order=$3,product_selection_strategy=$4,
        request_spacing_days=$5,customer_request_cooldown_days=$6,show_verified_badge=$7,
        star_color=$8,email_subject_en=$9,email_subject_zh=$10,updated_at=now()
      from shops s where ss.shop_id=s.id and s.domain=$11 returning ss.shop_id`,
      [input.data.requestEnabled,input.data.requestDelayDays,input.data.maxProductsPerOrder,input.data.productSelectionStrategy,input.data.requestSpacingDays,input.data.customerRequestCooldownDays,input.data.showVerifiedBadge,input.data.starColor,input.data.emailSubjectEn,input.data.emailSubjectZh,admin.shopDomain],
    );
    if (updated.rowCount) {
      await audit(db, updated.rows[0].shop_id, "request_scheduling_updated", "shop_settings", updated.rows[0].shop_id, admin.userId, {
        delayDays: input.data.requestDelayDays, maxProductsPerOrder: input.data.maxProductsPerOrder,
        selectionStrategy: input.data.productSelectionStrategy, spacingDays: input.data.requestSpacingDays,
        customerCooldownDays: input.data.customerRequestCooldownDays,
      });
      await db.query("insert into analytics_events(shop_id,event_name,properties) values($1,'request_scheduling_updated',$2)", [updated.rows[0].shop_id, JSON.stringify({ maxProductsPerOrder: input.data.maxProductsPerOrder, customerCooldownDays: input.data.customerRequestCooldownDays })]);
    }
  });
  return ctx.json({ ok: true });
});
app.get("/api/admin/request-blocklist", async (ctx) => {
  const admin = ctx.get("admin")!;
  const entries = await withDb(ctx.env, (db) => db.query(`select b.id,b.email_masked,b.note,b.created_at from review_request_blocklist b join shops s on s.id=b.shop_id where s.domain=$1 order by b.created_at desc`, [admin.shopDomain]));
  return ctx.json(entries.rows);
});
app.post("/api/admin/request-blocklist", async (ctx) => {
  const admin = ctx.get("admin")!;
  const input = blocklistEntrySchema.safeParse(await ctx.req.json());
  if (!input.success) return ctx.json({ error: input.error.flatten() }, 400);
  const entry = await withDb(ctx.env, async (db) => {
    const shop = await db.query<{ id: string }>("select id from shops where domain=$1", [admin.shopDomain]);
    if (!shop.rowCount) return null;
    const emailHash = await sha256(input.data.email.toLowerCase());
    const saved = await db.query<{ id: string }>(`
      insert into review_request_blocklist(shop_id,email_hash,email_masked,note,created_by_user_id)
      values($1,$2,$3,$4,$5)
      on conflict(shop_id,email_hash) do update set email_masked=excluded.email_masked,note=excluded.note,created_by_user_id=excluded.created_by_user_id,updated_at=now()
      returning id`, [shop.rows[0].id, emailHash, maskEmail(input.data.email), input.data.note || null, admin.userId]);
    await audit(db, shop.rows[0].id, "review_request_blocked", "request_blocklist", saved.rows[0].id, admin.userId);
    await db.query("insert into analytics_events(shop_id,event_name,properties) values($1,'review_request_blocklist_added','{}')", [shop.rows[0].id]);
    return saved.rows[0];
  });
  return entry ? ctx.json({ ok: true, id: entry.id }, 201) : ctx.json({ error: "Shop not found" }, 404);
});
app.delete("/api/admin/request-blocklist/:id", async (ctx) => {
  const admin = ctx.get("admin")!;
  const deleted = await withDb(ctx.env, async (db) => {
    const result = await db.query<{ id: string; shop_id: string }>(`delete from review_request_blocklist b using shops s where b.shop_id=s.id and s.domain=$1 and b.id=$2 returning b.id,b.shop_id`, [admin.shopDomain, ctx.req.param("id")]);
    if (result.rowCount) {
      await audit(db, result.rows[0].shop_id, "review_request_unblocked", "request_blocklist", result.rows[0].id, admin.userId);
      await db.query("insert into analytics_events(shop_id,event_name,properties) values($1,'review_request_blocklist_removed','{}')", [result.rows[0].shop_id]);
    }
    return result.rows[0] ?? null;
  });
  return deleted ? ctx.json({ ok: true }) : ctx.json({ error: "Blocklist entry not found" }, 404);
});
app.get("/api/admin/test-deliveries", async (ctx) => {
  const admin = ctx.get("admin")!;
  const rows = await withDb(ctx.env, (db) => db.query(`
    select rr.id,rr.shopify_order_id,rr.status,rr.scheduled_at,rr.sent_at,rr.attempt_count,
      rr.failure_reason,rr.test_email_payload,p.shopify_product_id,p.title_snapshot
    from review_requests rr
    join shops s on s.id=rr.shop_id
    join products p on p.id=rr.product_id
    where s.domain=$1
    order by rr.created_at desc
    limit 500`, [admin.shopDomain]));
  return ctx.json(groupTestDeliveryRows(rows.rows));
});
app.post("/api/admin/test-deliveries/process-due", async (ctx) => {
  const admin = ctx.get("admin")!;
  const requestIds = await withDb(ctx.env, async (db) => {
    const shop = await db.query<{ id: string }>("select id from shops where domain=$1 and status='active'", [admin.shopDomain]);
    if (!shop.rowCount) return [];
    const due = await queueDueRequests(db, shop.rows[0].id);
    await db.query("insert into analytics_events(shop_id,event_name,properties) values($1,'test_delivery_manual_run',$2)", [shop.rows[0].id, JSON.stringify({ queued: due.length })]);
    return due.map((task) => task.id);
  });
  for (const requestId of requestIds) await ctx.env.REVIEW_QUEUE.send({ type: "send_test_request", requestId });
  return ctx.json({ queued: requestIds.length });
});
app.post("/api/admin/test-deliveries/:id/retry", async (ctx) => {
  const admin = ctx.get("admin")!;
  const retried = await withDb(ctx.env, (db) => retryFailedTestDelivery(db, admin.shopDomain, ctx.req.param("id")));
  if (!retried) return ctx.json({ error: "Failed test delivery not found" }, 404);
  await ctx.env.REVIEW_QUEUE.send({ type: "send_test_request", requestId: retried.id });
  return ctx.json({ queued: true });
});

app.post("/webhooks/shopify", async (ctx) => {
  const body = await ctx.req.text();
  if (!(await validWebhook(ctx.req.raw, body, ctx.env.SHOPIFY_API_SECRET))) return ctx.text("Invalid HMAC", 401);
  if (!hasRequiredShopifyWebhookHeaders(ctx.req.raw.headers)) return ctx.text("Missing Shopify webhook headers", 400);

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return ctx.text("Invalid JSON", 400);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return ctx.text("Invalid JSON", 400);

  const deliveryId = ctx.req.header("x-shopify-webhook-id")!;
  const topic = ctx.req.header("x-shopify-topic")!;
  const shopDomain = ctx.req.header("x-shopify-shop-domain")!;
  const accepted = await withDb(ctx.env, async (db) => {
    const shop = await db.query<{ id: string }>("select id from shops where domain=$1", [shopDomain]);
    const insert = await db.query(
      "insert into webhook_events(shop_id,delivery_id,topic,payload) values($1,$2,$3,$4) on conflict(delivery_id) do nothing returning id",
      [shop.rows[0]?.id ?? null, deliveryId, topic, payload],
    );
    return shouldQueueWebhook(insert.rowCount);
  });
  if (accepted) await ctx.env.REVIEW_QUEUE.send({ type: "shopify_webhook", deliveryId, topic, shopDomain, payload });
  return ctx.text("OK", 200);
});
app.get("*", (ctx) => ctx.env.ASSETS.fetch(ctx.req.raw));

async function markWebhookProcessed(db: pg.Client, deliveryId: string) {
  await db.query("update webhook_events set status='processed',processed_at=now(),payload='{}'::jsonb where delivery_id=$1", [deliveryId]);
}

async function processWebhook(job: Extract<QueueJob,{type:"shopify_webhook"}>, env: Env) {
  if (job.topic === "app/uninstalled") {
    await withDb(env, async (db) => {
      const shop = await db.query<{ id: string; access_token: string | null }>("select id,access_token from shops where domain=$1", [job.shopDomain]);
      if (shop.rowCount) {
        await cancelOutstandingRequests(db, shop.rows[0].id);
        await db.query("update shops set status='uninstalled',access_token=null,updated_at=now() where id=$1", [shop.rows[0].id]);
      }
      await markWebhookProcessed(db, job.deliveryId);
    });
    return;
  }

  if (["customers/data_request", "customers/redact", "shop/redact"].includes(job.topic)) {
    await withDb(env, async (db) => {
      const shop = await db.query<{ id: string; access_token: string | null }>("select id,access_token from shops where domain=$1", [job.shopDomain]);
      if (job.topic === "shop/redact") {
        if (shop.rowCount) {
          const mediaIds = await eraseShopData(db, shop.rows[0].id);
          await deleteShopifyReviewMedia(env, job.shopDomain, shop.rows[0].access_token, mediaIds);
        }
        else await markWebhookProcessed(db, job.deliveryId);
        return;
      }
      if (shop.rowCount) {
        if (job.topic === "customers/data_request") await recordDataRequest(db, shop.rows[0].id);
        else await deleteShopifyReviewMedia(env, job.shopDomain, shop.rows[0].access_token, await redactCustomerData(db, shop.rows[0].id, job.payload));
      }
      await markWebhookProcessed(db, job.deliveryId);
    });
    return;
  }

  if (job.topic === "orders/fulfilled") {
    const payload = job.payload as { id?: number; email?: string; line_items?: Array<{ product_id?: number; variant_id?: number; title?: string; price?: string | number }> };
    await withDb(env, async (db) => {
      const shop = await db.query<RequestSchedulingSettings>(`
        select s.id,ss.request_enabled,ss.request_delay_days,ss.max_products_per_order,
          ss.product_selection_strategy,ss.request_spacing_days,ss.customer_request_cooldown_days
        from shops s join shop_settings ss on ss.shop_id=s.id
        where s.domain=$1 and s.status='active'`, [job.shopDomain]);
      if (payload.id && payload.email && shop.rowCount) {
        const outcome = await scheduleFulfilledOrderRequests(db, {
          shop: shop.rows[0], orderId: String(payload.id), email: payload.email,
          lineItems: payload.line_items ?? [], tokenSecret: env.TOKEN_SECRET,
        });
        await db.query("insert into analytics_events(shop_id,event_name,properties) values($1,'fulfilled_order_review_request_evaluated',$2)", [shop.rows[0].id, JSON.stringify({ created: outcome.created, skippedReason: outcome.skippedReason })]);
      }
      await markWebhookProcessed(db, job.deliveryId);
    });
  }
}
export default { fetch: app.fetch, async queue(batch: MessageBatch<QueueJob>, env: Env) { for(const message of batch.messages){ const job=message.body; try { if(job.type==="shopify_webhook") await processWebhook(job,env); else await withDb(env,(db)=>createTestDelivery(db,(job as Extract<QueueJob,{type:"send_test_request"}>).requestId,env.APP_URL,env.TOKEN_SECRET)); message.ack(); } catch(error) { console.error("queue_job_failed",{type:job.type,error:String(error)}); if(job.type === "send_test_request") await withDb(env,(db)=>recordTestDeliveryFailure(db,job.requestId,String(error),message.attempts >= 5)); if(message.attempts >= 5) message.ack(); else message.retry({delaySeconds:60}); } } }, async scheduled(_event:ScheduledEvent,env:Env,ctx:ExecutionContext){ ctx.waitUntil(withDb(env,async(db)=>{ for(const task of await queueDueRequests(db)) await env.REVIEW_QUEUE.send({type:"send_test_request",requestId:task.id}); await removeExpiredReviewMedia(db,env); })); } };
