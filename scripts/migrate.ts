import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const client = new pg.Client({ connectionString });
await client.connect();
await client.query("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
for (const name of (await fs.readdir("db/migrations")).filter((file) => file.endsWith(".sql")).sort()) {
  const seen = await client.query("select 1 from schema_migrations where name = $1", [name]);
  if (!seen.rowCount) {
    await client.query("begin");
    try { await client.query(await fs.readFile(path.join("db/migrations", name), "utf8")); await client.query("insert into schema_migrations(name) values($1)", [name]); await client.query("commit"); }
    catch (error) { await client.query("rollback"); throw error; }
  }
}
await client.end();
