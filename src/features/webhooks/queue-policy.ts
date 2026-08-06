/**
 * Queue retry policy shared by the consumer and its tests.
 *
 * The consumer keeps the existing rule: attempts 0-4 are retried and
 * attempt 5 (or later) is acknowledged as final to avoid an endless loop.
 */
export const MAX_QUEUE_ATTEMPTS = 5;

export function shouldRetryQueueMessage(attempts: number): boolean {
  return Number.isFinite(attempts) && attempts >= 0 && attempts < MAX_QUEUE_ATTEMPTS;
}
