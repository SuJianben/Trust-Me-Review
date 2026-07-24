create type review_status as enum ('pending', 'published', 'hidden', 'deleted');
create type request_status as enum ('scheduled', 'sent', 'submitted', 'cancelled', 'failed');

create table shops (
  id uuid primary key default gen_random_uuid(),
  shopify_shop_id text not null unique,
  domain text not null unique,
  access_token text,
  status text not null default 'active' check (status in ('active','uninstalled','redacted')),
  locale text not null default 'en' check (locale in ('en','zh-CN')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table shop_settings (
  shop_id uuid primary key references shops(id) on delete cascade,
  request_enabled boolean not null default true,
  request_delay_days integer not null default 14 check (request_delay_days between 0 and 90),
  moderation_mode text not null default 'manual' check (moderation_mode in ('manual','automatic')),
  show_verified_badge boolean not null default true,
  star_color text not null default '#F6A623',
  email_subject_en text not null default 'How was your purchase?',
  email_subject_zh text not null default '您购买的商品体验如何？',
  updated_at timestamptz not null default now()
);
create table products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  shopify_product_id text not null,
  title_snapshot text not null default '', handle_snapshot text not null default '',
  unique(shop_id, shopify_product_id)
);
create table reviews (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  shopify_variant_id text,
  shopify_order_id text,
  rating smallint not null check (rating between 1 and 5),
  title text, body text not null check (char_length(body) between 10 and 3000),
  author_name text not null check (char_length(author_name) between 1 and 120),
  author_email_hash text,
  verified_purchase boolean not null default false,
  status review_status not null default 'pending',
  pinned boolean not null default false,
  source text not null check (source in ('public','invitation','import')),
  published_at timestamptz, deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index reviews_storefront_idx on reviews(shop_id, product_id, status, pinned desc, published_at desc);
create table review_replies (
  review_id uuid primary key references reviews(id) on delete cascade,
  shop_id uuid not null references shops(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  editor_user_id text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table review_requests (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  shopify_order_id text not null, shopify_variant_id text,
  customer_email_hash text not null, token_hash text not null unique, token_ciphertext text not null,
  scheduled_at timestamptz not null, sent_at timestamptz, submitted_at timestamptz,
  status request_status not null default 'scheduled', attempt_count integer not null default 0,
  test_email_payload jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(shop_id, shopify_order_id, product_id)
);
create index review_requests_due_idx on review_requests(status, scheduled_at) where status = 'scheduled';
create table webhook_events (
  id uuid primary key default gen_random_uuid(), shop_id uuid references shops(id) on delete set null,
  delivery_id text not null unique, topic text not null, status text not null default 'received',
  payload jsonb, received_at timestamptz not null default now(), processed_at timestamptz
);
create table audit_logs (
  id uuid primary key default gen_random_uuid(), shop_id uuid not null references shops(id) on delete cascade,
  actor_type text not null, actor_id text, action text not null, target_type text not null, target_id text,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table analytics_events (
  id uuid primary key default gen_random_uuid(), shop_id uuid references shops(id) on delete set null,
  event_name text not null, properties jsonb not null default '{}'::jsonb, occurred_at timestamptz not null default now()
);
create table submission_limits (
  shop_id uuid not null references shops(id) on delete cascade, ip_hash text not null, product_id uuid not null references products(id) on delete cascade,
  window_start timestamptz not null, count integer not null default 1, primary key(shop_id, ip_hash, product_id, window_start)
);
