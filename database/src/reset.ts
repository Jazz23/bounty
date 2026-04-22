import { sql } from "drizzle-orm";
import { db } from "./client";
import { seed } from "./seed";

console.log("Resetting database...");

await db.execute(sql`DROP SCHEMA public CASCADE`);
await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
await db.execute(sql`CREATE SCHEMA public`);
console.log("Dropped schema.");

await Bun.$`bun --env-file=.env.local drizzle-kit migrate`.cwd(
  import.meta.dir + "/.."
);
console.log("Migrations applied.");

await seed();

process.exit(0);
