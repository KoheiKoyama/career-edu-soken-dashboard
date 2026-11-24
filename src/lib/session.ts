import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, type User } from "@/db/schema";

/**
 * ログイン中のユーザー。
 * 開発時は DEV_LOGIN_EMAIL を設定すると Google ログインなしでそのユーザーとして動く（本番では無効）。
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  let email: string | undefined;
  if (process.env.NODE_ENV !== "production" && process.env.DEV_LOGIN_EMAIL) {
    email = process.env.DEV_LOGIN_EMAIL;
  } else {
    const session = await auth();
    email = session?.user?.email ?? undefined;
  }
  if (!email) return null;
  const [row] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  if (!row || !row.active) return null;
  return row;
});

export async function requireUser(): Promise<User> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireEditor(): Promise<User> {
  const u = await requireUser();
  if (u.role !== "編集") throw new Error("閲覧権限のユーザーは編集できません");
  return u;
}

export function canEdit(u: User | null): boolean {
  return u?.role === "編集";
}
