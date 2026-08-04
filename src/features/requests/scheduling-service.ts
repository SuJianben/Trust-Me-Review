import type pg from "pg";
import { sha256 } from "../../lib/crypto";
import { ensureProduct } from "../reviews/service";
import { productRequestsEnabled } from "../products/admin-service";
import { createRequest } from "./service";

export type FulfilledLineItem = {
  product_id?: number;
  variant_id?: number;
  title?: string;
  price?: string | number;
};

export type RequestSchedulingSettings = {
  id: string;
  request_enabled: boolean;
  request_delay_days: number;
  max_products_per_order: number;
  product_selection_strategy: "highest_price" | "all_items";
  request_spacing_days: number;
  customer_request_cooldown_days: number;
};

type ScheduleFulfilledOrderArgs = {
  shop: RequestSchedulingSettings;
  orderId: string;
  email: string;
  lineItems: FulfilledLineItem[];
  tokenSecret: string;
  now?: Date;
};

export type SchedulingOutcome = {
  created: number;
  skippedReason: "disabled" | "blocked" | "customer_cooldown" | "no_products" | null;
};

function normalizedPrice(value: string | number | undefined) {
  const price = typeof value === "number" ? value : Number.parseFloat(value ?? "0");
  return Number.isFinite(price) ? price : 0;
}

export function selectOrderItems(items: FulfilledLineItem[], strategy: RequestSchedulingSettings["product_selection_strategy"], maxProducts: number) {
  const uniqueItems = new Map<string, FulfilledLineItem>();
  for (const item of items) {
    if (!item.product_id) continue;
    const key = String(item.product_id);
    const previous = uniqueItems.get(key);
    if (!previous || normalizedPrice(item.price) > normalizedPrice(previous.price)) uniqueItems.set(key, item);
  }
  const products = [...uniqueItems.values()];
  if (strategy === "highest_price") products.sort((left, right) => normalizedPrice(right.price) - normalizedPrice(left.price));
  return products.slice(0, Math.max(1, maxProducts));
}

export function scheduledAtForIndex(baseDate: Date, index: number, spacingDays: number) {
  return new Date(baseDate.getTime() + index * Math.max(0, spacingDays) * 86_400_000);
}

export function maskEmail(email: string) {
  const [local = "", domain = ""] = email.trim().toLowerCase().split("@");
  const visible = local.slice(0, 1) || "*";
  return `${visible}${"*".repeat(Math.max(2, Math.min(8, local.length - 1)))}@${domain}`;
}

async function hasCustomerCooldown(client: pg.Client, shopId: string, emailHash: string, cooldownDays: number) {
  if (cooldownDays === 0) return false;
  const result = await client.query(
    `select 1 from review_requests
      where shop_id=$1 and customer_email_hash=$2
        and status in ('scheduled','sent','submitted')
        and created_at >= now() - ($3::int * interval '1 day')
      limit 1`,
    [shopId, emailHash, cooldownDays],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function scheduleFulfilledOrderRequests(client: pg.Client, args: ScheduleFulfilledOrderArgs): Promise<SchedulingOutcome> {
  if (!args.shop.request_enabled) return { created: 0, skippedReason: "disabled" };
  const emailHash = await sha256(args.email.trim().toLowerCase());
  const blocked = await client.query("select 1 from review_request_blocklist where shop_id=$1 and email_hash=$2 limit 1", [args.shop.id, emailHash]);
  if (blocked.rowCount) return { created: 0, skippedReason: "blocked" };
  if (await hasCustomerCooldown(client, args.shop.id, emailHash, args.shop.customer_request_cooldown_days)) return { created: 0, skippedReason: "customer_cooldown" };

  const candidates = selectOrderItems(args.lineItems, args.shop.product_selection_strategy, args.shop.max_products_per_order);
  if (!candidates.length) return { created: 0, skippedReason: "no_products" };

  const baseDate = new Date((args.now ?? new Date()).getTime() + args.shop.request_delay_days * 86_400_000);
  let created = 0;
  for (const item of candidates) {
    if (!item.product_id) continue;
    const productId = await ensureProduct(client, args.shop.id, String(item.product_id), item.title);
    if (!(await productRequestsEnabled(client, productId))) continue;
    const request = await createRequest(client, {
      shopId: args.shop.id,
      productId,
      orderId: args.orderId,
      variantId: item.variant_id ? String(item.variant_id) : undefined,
      email: args.email,
      scheduledAt: scheduledAtForIndex(baseDate, created, args.shop.request_spacing_days),
      tokenSecret: args.tokenSecret,
    });
    if (request) created += 1;
  }
  return { created, skippedReason: created ? null : "no_products" };
}
