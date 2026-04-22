import { db, users } from "..";

export async function seed() {
  console.log("Seeding...");

  const testUsers = [
    { id: "user_1", email: "admin@example.com", password: "password123" },
    { id: "user_2", email: "user@example.com", password: "password123" },
  ];

  for (const { id, email, password } of testUsers) {
    const passwordHash = await Bun.password.hash(password, { algorithm: "bcrypt" });
    await db.insert(users).values({ id, email, passwordHash }).onConflictDoUpdate({
      target: users.email,
      set: { passwordHash },
    });
  }

  console.log("Seeding done.");
}

if (import.meta.main) {
  await seed();
  process.exit(0);
}
