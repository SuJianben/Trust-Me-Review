-- Review media lives in private R2 object storage. PostgreSQL stores only the
-- ownership, lifecycle and display metadata needed to secure each object.
create table if not exists review_media (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  review_request_id uuid not null references review_requests(id) on delete cascade,
  review_id uuid references reviews(id) on delete cascade,
  object_key text not null unique,
  media_kind text not null check (media_kind in ('image', 'video')),
  content_type text not null,
  byte_size integer not null check (byte_size > 0 and byte_size <= 10485760),
  created_at timestamptz not null default now()
);

create index if not exists review_media_review_idx on review_media(review_id);
create index if not exists review_media_unattached_idx on review_media(review_request_id, created_at) where review_id is null;
