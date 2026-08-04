import type pg from "pg";

export async function removeExpiredReviewMedia(client: pg.Client, bucket: R2Bucket) {
  const expired = await client.query<{ id: string; object_key: string }>(`
    select id,object_key from review_media
    where review_id is null and created_at < now() - interval '24 hours'
    order by created_at asc
    limit 100`);
  if (!expired.rowCount) return 0;
  await client.query("delete from review_media where id = any($1::uuid[])", [expired.rows.map((row) => row.id)]);
  await bucket.delete(expired.rows.map((row) => row.object_key));
  return expired.rowCount;
}

export async function deleteReviewMediaObjects(bucket: R2Bucket, keys: readonly string[]) {
  if (keys.length) await bucket.delete([...new Set(keys)]);
}
