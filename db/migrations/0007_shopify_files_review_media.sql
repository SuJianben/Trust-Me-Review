-- Media bytes live in each merchant's Shopify Files library. The app database
-- only retains the ownership and display metadata needed for review rendering.
alter table review_media
  add column if not exists storage_provider text not null default 'shopify_files',
  add column if not exists shopify_file_id text,
  add column if not exists storage_url text,
  add column if not exists file_status text not null default 'UPLOADED';

create unique index if not exists review_media_shopify_file_id_idx
  on review_media(shopify_file_id) where shopify_file_id is not null;
