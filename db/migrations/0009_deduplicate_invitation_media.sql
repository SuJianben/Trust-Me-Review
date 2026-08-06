-- Prevent a retry or duplicate browser upload from creating multiple media
-- records for the same file in the same product invitation.
alter table review_media
  add column if not exists content_sha256 text;

create unique index if not exists review_media_invitation_content_hash_idx
  on review_media(review_request_id, content_sha256)
  where review_id is null and content_sha256 is not null;
