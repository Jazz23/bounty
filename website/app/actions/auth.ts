"use server";

import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export type LoginState = { error: string } | null;

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });

  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Invalid email or password." };
  }

  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  session.isLoggedIn = true;
  await session.save();

  redirect("/");
}

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}
