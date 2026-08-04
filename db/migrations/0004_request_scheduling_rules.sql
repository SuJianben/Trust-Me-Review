alter table shop_settings
  add column if not exists max_products_per_order integer not null default 1 check (max_products_per_order between 1 and 10),
  add column if not exists product_selection_strategy text not null default 'highest_price' check (product_selection_strategy in ('highest_price','all_items')),
  add column if not exists request_spacing_days integer not null default 5 check (request_spacing_days between 0 and 90),
  add column if not exists customer_request_cooldown_days integer not null default 30 check (customer_request_cooldown_days between 0 and 365);

create table if not exists review_request_blocklist (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  email_hash text not null,
  email_masked text not null,
  note text,
  created_by_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(shop_id, email_hash)
);

create index if not exists review_request_blocklist_shop_created_idx
  on review_request_blocklist(shop_id, created_at desc);

create index if not exists review_requests_customer_cooldown_idx
  on review_requests(shop_id, customer_email_hash, created_at desc);
