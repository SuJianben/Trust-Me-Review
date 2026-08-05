-- Invitation reviews may be short (for example, "nice").
-- Keep the review body required while removing the outdated 10-character minimum.
alter table reviews drop constraint if exists reviews_body_check;
alter table reviews add constraint reviews_body_check
  check (char_length(body) between 1 and 3000);
