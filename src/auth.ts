import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

/** 最初にログインできる管理者のメール（カンマ区切り）。初回ログイン時に「編集」権限で自動登録される */
function bootstrapEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  trustHost: true,
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;
      const [row] = await db.select().from(users).where(eq(users.email, email));
      if (row) return row.active;
      if (bootstrapEmails().includes(email)) {
        await db.insert(users).values({ email, name: user.name ?? email, role: "編集" });
        return true;
      }
      return false;
    },
  },
});
