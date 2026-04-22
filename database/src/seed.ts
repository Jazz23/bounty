import { db, users } from "..";

export async function seed() {
  console.log("Seeding...");

  await db.insert(users).values({
    id: "user_1",
    email: "admin@example.com",
  }).onConflictDoNothing();

  console.log("Seeding done.");
}

if (import.meta.main) {
  await seed();
  process.exit(0);
}
