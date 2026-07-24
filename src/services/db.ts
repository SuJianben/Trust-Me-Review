import pg from "pg";
import type { Env } from "../types";

export function database(env: Env) {
  return new pg.Client({ connectionString: env.HYPERDRIVE.connectionString });
}
export async function withDb<T>(env: Env, fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = database(env); await client.connect();
  try { return await fn(client); } finally { await client.end(); }
}
export async function audit(client: pg.Client, shopId: string, action: string, targetType: string, targetId: string | null, actorId: string | null, metadata: Record<string, unknown> = {}) {
  await client.query("insert into audit_logs(shop_id, actor_type, actor_id, action, target_type, target_id, metadata) values($1,'merchant',$2,$3,$4,$5,$6)", [shopId, actorId, action, targetType, targetId, metadata]);
}
