import { Hono } from "hono";
import { cors } from "hono/cors";
import type pg from "pg";
import { z } from "zod";
import type { Env, QueueJob, ReviewStatus } from "./types";
import { withDb, audit } from "./services/db";
import { validWebhook, verifyTurnstile } from "./services/shopify";
import { verifyAdminSession, createOAuthState, validOAuthState } from "./lib/auth";
import { ensureManagedShop } from "./features/shops/service";
import { publicReviewSchema, invitationReviewSchema, moderationSchema, replySchema, settingsSchema } from "./features/reviews/schemas";
import { ensureProduct, hasProhibitedText, publicReviews, publicReviewSummary, reservePublicSubmission, type StorefrontReviewSort } from "./features/reviews/service";
import { createRequest, createTestDelivery, queueDueRequests, recordTestDeliveryFailure, retryFailedTestDelivery } from "./features/requests/service";
import { randomToken, sha256 } from "./lib/crypto";
import { cancelOutstandingRequests, eraseShopData, recordDataRequest, redactCustomerData } from "./features/privacy/service";

const app = new Hono<{ Bindings: Env; Variables: { admin?: { shopDomain: string; userId: string; sessionToken: string } } }>();
app.onError((error, ctx) => {
  console.error("request_failed", { method: ctx.req.method, path: new URL(ctx.req.url).pathname, error: error instanceof Error ? error.message : String(error) });
  return ctx.json({ error: "Internal server error" }, 500);
});
app.use("/api/storefront/*", cors({ origin: "*", allowMethods: ["GET", "POST"] }));
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
  const state = await createOAuthState(shop, ctx.env); const params = new URLSearchParams({ client_id: ctx.env.SHOPIFY_API_KEY, scope: "read_products,read_orders", redirect_uri: `${ctx.env.APP_URL}/auth/callback`, state });
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
    const productId = await ensureProduct(db, shop.rows[0].id, input.data.productId); if (!(await reservePublicSubmission(db, shop.rows[0].id, productId, remoteIp))) throw new Error("RATE_LIMITED");
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

app.post("/api/invitations/:token/reviews", async (ctx) => {
  const input = invitationReviewSchema.safeParse(await ctx.req.json()); if (!input.success) return ctx.json({ error: input.error.flatten() }, 400);
  if (hasProhibitedText(`${input.data.title ?? ""} ${input.data.body}`)) return ctx.json({ error: "Submission was rejected" }, 422);
  const tokenHash = await sha256(ctx.req.param("token"));
  const created = await withDb(ctx.env, async (db) => {
    const request = await db.query<{ id: string; shop_id: string; product_id: string; shopify_order_id: string; shopify_variant_id: string | null; customer_email_hash: string }>("select id,shop_id,product_id,shopify_order_id,shopify_variant_id,customer_email_hash from review_requests where token_hash=$1 and status='sent' for update", [tokenHash]); if (!request.rowCount) return null;
    const value = request.rows[0]; const review = await db.query<{ id: string }>("insert into reviews(shop_id,product_id,shopify_order_id,shopify_variant_id,rating,title,body,author_name,author_email_hash,status,source,verified_purchase) values($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending','invitation',true) returning id", [value.shop_id,value.product_id,value.shopify_order_id,value.shopify_variant_id,input.data.rating,input.data.title ?? null,input.data.body,input.data.authorName,value.customer_email_hash]);
    await db.query("update review_requests set status='submitted',submitted_at=now() where id=$1", [value.id]); return review.rows[0];
  });
  if (!created) return ctx.json({ error: "Invitation is invalid or already used" }, 404); return ctx.json({ id: created.id, status: "pending", verifiedPurchase: true }, 201);
});

app.get("/api/admin/reviews", async (ctx) => {
  const admin = ctx.get("admin")!; const page = Math.max(1, Number(ctx.req.query("page") ?? 1));
  const requestedStatus = ctx.req.query("status");
  const status = ["pending", "published", "hidden", "deleted"].includes(requestedStatus ?? "") ? requestedStatus as ReviewStatus : null;
  const source = ["public", "invitation"].includes(ctx.req.query("source") ?? "") ? ctx.req.query("source")! : null;
  const rating = ["1", "2", "3", "4", "5"].includes(ctx.req.query("rating") ?? "") ? Number(ctx.req.query("rating")) : null;
  const search = ctx.req.query("q")?.trim().slice(0, 120) || null;
  const result = await withDb(ctx.env, async (db) => {
    const values: Array<string | number> = [admin.shopDomain];
    const conditions = ["s.domain=$1"];
    if (status) { values.push(status); conditions.push(`r.status=$${values.length}::review_status`); }
    if (source) { values.push(source); conditions.push(`r.source=$${values.length}`); }
    if (rating) { values.push(rating); conditions.push(`r.rating=$${values.length}`); }
    if (search) { values.push(search); conditions.push(`(r.author_name ilike '%' || $${values.length} || '%' or coalesce(r.title,'') ilike '%' || $${values.length} || '%' or r.body ilike '%' || $${values.length} || '%')`); }
    values.push((page - 1) * 30);
    return db.query(`select r.*,p.shopify_product_id,p.title_snapshot,rr.body reply_body,count(*) over() total from reviews r join shops s on s.id=r.shop_id join products p on p.id=r.product_id left join review_replies rr on rr.review_id=r.id where ${conditions.join(" and ")} order by r.created_at desc limit 30 offset $${values.length}`, values);
  });
  return ctx.json({ reviews: result.rows, total: Number(result.rows[0]?.total ?? 0), page });
});
app.patch("/api/admin/reviews/:id", async (ctx) => {
  const admin = ctx.get("admin")!; const input = moderationSchema.safeParse(await ctx.req.json()); if (!input.success) return ctx.json({ error: input.error.flatten() }, 400);
  const updated = await withDb(ctx.env, async (db) => {
    const row = await db.query<{ id: string; shop_id: string }>(`
      update reviews r
      set status = $1::review_status,
          pinned = coalesce($2, pinned),
          published_at = case when $1::review_status = 'published'::review_status and published_at is null then now() else published_at end,
          deleted_at = case when $1::review_status = 'deleted'::review_status then now() else null end,
          updated_at = now()
      from shops s
      where r.shop_id = s.id and s.domain = $3 and r.id = $4
      returning r.id, r.shop_id`,
      [input.data.status, input.data.pinned ?? null, admin.shopDomain, ctx.req.param("id")],
    );
    if (row.rowCount) await audit(db, row.rows[0].shop_id, `review_${input.data.status}`, "review", row.rows[0].id, admin.userId, { pinned: input.data.pinned });
    return row.rows[0];
  });
  return updated ? ctx.json(updated) : ctx.json({ error: "Review not found" }, 404);
});
app.post("/api/admin/reviews/:id/reply", async (ctx) => {
  const admin = ctx.get("admin")!; const input = replySchema.safeParse(await ctx.req.json()); if (!input.success) return ctx.json({ error: input.error.flatten() }, 400);
  const reply = await withDb(ctx.env, async (db) => { const review = await db.query<{ shop_id:string }>("select r.shop_id from reviews r join shops s on s.id=r.shop_id where r.id=$1 and s.domain=$2", [ctx.req.param("id"),admin.shopDomain]); if (!review.rowCount) return null; await db.query("insert into review_replies(review_id,shop_id,body,editor_user_id) values($1,$2,$3,$4) on conflict(review_id) do update set body=excluded.body,editor_user_id=excluded.editor_user_id,updated_at=now()", [ctx.req.param("id"),review.rows[0].shop_id,input.data.body,admin.userId]); await audit(db,review.rows[0].shop_id,"review_replied","review",ctx.req.param("id"),admin.userId); return { ok:true }; }); return reply ? ctx.json(reply) : ctx.json({ error:"Review not found" },404);
});
app.get("/api/admin/settings", async (ctx) => { const admin = ctx.get("admin")!; const row = await withDb(ctx.env, (db) => db.query("select ss.* from shop_settings ss join shops s on s.id=ss.shop_id where s.domain=$1", [admin.shopDomain])); return ctx.json(row.rows[0] ?? {}); });
app.patch("/api/admin/settings", async (ctx) => { const admin = ctx.get("admin")!; const input = settingsSchema.safeParse(await ctx.req.json()); if (!input.success) return ctx.json({ error: input.error.flatten() },400); await withDb(ctx.env, async (db) => { await db.query(`update shop_settings ss set request_enabled=$1,request_delay_days=$2,show_verified_badge=$3,star_color=$4,email_subject_en=$5,email_subject_zh=$6,updated_at=now() from shops s where ss.shop_id=s.id and s.domain=$7`,[input.data.requestEnabled,input.data.requestDelayDays,input.data.showVerifiedBadge,input.data.starColor,input.data.emailSubjectEn,input.data.emailSubjectZh,admin.shopDomain]); }); return ctx.json({ ok:true }); });
app.get("/api/admin/test-deliveries", async (ctx) => { const admin=ctx.get("admin")!; const rows=await withDb(ctx.env,(db)=>db.query("select rr.id,rr.shopify_order_id,rr.status,rr.scheduled_at,rr.sent_at,rr.attempt_count,rr.failure_reason,rr.test_email_payload,p.shopify_product_id from review_requests rr join shops s on s.id=rr.shop_id join products p on p.id=rr.product_id where s.domain=$1 order by rr.created_at desc limit 100",[admin.shopDomain])); return ctx.json(rows.rows); });
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

app.post("/webhooks/shopify", async (ctx) => { const body=await ctx.req.text(); if (!(await validWebhook(ctx.req.raw,body,ctx.env.SHOPIFY_API_SECRET))) return ctx.text("Invalid HMAC",401); const deliveryId=ctx.req.header("x-shopify-webhook-id") ?? await sha256(`${ctx.req.header("x-shopify-topic")}:${body}`); const topic=ctx.req.header("x-shopify-topic") ?? "unknown"; const shopDomain=ctx.req.header("x-shopify-shop-domain") ?? ""; const payload=JSON.parse(body); const accepted=await withDb(ctx.env,async(db)=>{ const shop=await db.query<{id:string}>("select id from shops where domain=$1",[shopDomain]); const insert=await db.query("insert into webhook_events(shop_id,delivery_id,topic,payload) values($1,$2,$3,$4) on conflict(delivery_id) do nothing returning id",[shop.rows[0]?.id ?? null,deliveryId,topic,payload]); return Boolean(insert.rowCount); }); if(accepted) await ctx.env.REVIEW_QUEUE.send({type:"shopify_webhook",deliveryId,topic,shopDomain,payload}); return ctx.text("OK",200); });
app.get("*", (ctx) => ctx.env.ASSETS.fetch(ctx.req.raw));

async function markWebhookProcessed(db: pg.Client, deliveryId: string) {
  await db.query("update webhook_events set status='processed',processed_at=now(),payload='{}'::jsonb where delivery_id=$1", [deliveryId]);
}

async function processWebhook(job: Extract<QueueJob,{type:"shopify_webhook"}>, env: Env) {
  if (job.topic === "app/uninstalled") {
    await withDb(env, async (db) => {
      const shop = await db.query<{ id: string }>("select id from shops where domain=$1", [job.shopDomain]);
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
      const shop = await db.query<{ id: string }>("select id from shops where domain=$1", [job.shopDomain]);
      if (job.topic === "shop/redact") {
        if (shop.rowCount) await eraseShopData(db, shop.rows[0].id);
        else await markWebhookProcessed(db, job.deliveryId);
        return;
      }
      if (shop.rowCount) {
        if (job.topic === "customers/data_request") await recordDataRequest(db, shop.rows[0].id);
        else await redactCustomerData(db, shop.rows[0].id, job.payload);
      }
      await markWebhookProcessed(db, job.deliveryId);
    });
    return;
  }

  if (job.topic === "orders/fulfilled") {
    const payload = job.payload as { id?: number; email?: string; line_items?: Array<{ product_id?: number; variant_id?: number }> };
    await withDb(env, async (db) => {
      const shop = await db.query<{ id: string; request_delay_days: number; request_enabled: boolean }>("select s.id,ss.request_delay_days,ss.request_enabled from shops s join shop_settings ss on ss.shop_id=s.id where s.domain=$1 and s.status='active'", [job.shopDomain]);
      if (payload.id && payload.email && shop.rowCount && shop.rows[0].request_enabled) {
        const due = new Date(Date.now() + shop.rows[0].request_delay_days * 86400000);
        for (const item of payload.line_items ?? []) if (item.product_id) {
          const productId = await ensureProduct(db, shop.rows[0].id, String(item.product_id));
          await createRequest(db, { shopId: shop.rows[0].id, productId, orderId: String(payload.id), variantId: item.variant_id ? String(item.variant_id) : undefined, email: payload.email, scheduledAt: due, tokenSecret: env.TOKEN_SECRET });
        }
      }
      await markWebhookProcessed(db, job.deliveryId);
    });
  }
}
export default { fetch: app.fetch, async queue(batch: MessageBatch<QueueJob>, env: Env) { for(const message of batch.messages){ const job=message.body; try { if(job.type==="shopify_webhook") await processWebhook(job,env); else await withDb(env,(db)=>createTestDelivery(db,(job as Extract<QueueJob,{type:"send_test_request"}>).requestId,env.APP_URL,env.TOKEN_SECRET)); message.ack(); } catch(error) { console.error("queue_job_failed",{type:job.type,error:String(error)}); if(job.type === "send_test_request") await withDb(env,(db)=>recordTestDeliveryFailure(db,job.requestId,String(error),message.attempts >= 5)); message.retry({delaySeconds:60}); } } }, async scheduled(_event:ScheduledEvent,env:Env,ctx:ExecutionContext){ ctx.waitUntil(withDb(env,async(db)=>{ for(const task of await queueDueRequests(db)) await env.REVIEW_QUEUE.send({type:"send_test_request",requestId:task.id}); })); } };
