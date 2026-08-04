-- V1.1: invite once per fulfilled order, with multiple product links in one delivery.
-- Keep the existing product-level request rows and tokens so each product can
-- still receive its own one-time review submission link.

alter table shop_settings
  alter column max_products_per_order set default 10,
  alter column customer_request_cooldown_days set default 0;

-- The previous V1 defaults were max 1 product, 5 days between product rows,
-- and a 30-day customer cooldown. Only rows that still have that complete
-- legacy combination are normalized; merchants who changed a setting keep it.
update shop_settings
set max_products_per_order = 10,
    customer_request_cooldown_days = 0,
    updated_at = now()
where max_products_per_order = 1
  and request_spacing_days = 5
  and customer_request_cooldown_days = 30;

create index if not exists review_requests_order_delivery_idx
  on review_requests(shop_id, shopify_order_id, status, scheduled_at);
