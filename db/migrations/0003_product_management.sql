alter table products add column if not exists image_url text not null default '';
alter table products add column if not exists request_enabled boolean not null default true;
alter table products add column if not exists catalog_status text not null default 'ACTIVE';
alter table products add column if not exists catalog_synced_at timestamptz;

create index if not exists products_shop_request_enabled_title_idx
  on products(shop_id, request_enabled, title_snapshot);
