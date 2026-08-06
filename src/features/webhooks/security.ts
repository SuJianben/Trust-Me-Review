/**
 * A webhook is queued only when the delivery row was inserted for the first time.
 * PostgreSQL returns zero rows for an ON CONFLICT DO NOTHING duplicate.
 */
export function shouldQueueWebhook(insertedRows: number | null | undefined): boolean {
  return insertedRows === 1;
}
