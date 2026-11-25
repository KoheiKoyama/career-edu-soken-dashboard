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
      if (!email) {
        console.warn("[signIn] Googleアカウントのメールが取得できませんでした");
        return false;
      }
      try {
        const [row] = await db.select().from(users).where(eq(users.email, email));
        if (row) {
          if (!row.active) console.warn(`[signIn] 無効化されたユーザー: ${email}`);
          return row.active;
        }
        if (bootstrapEmails().includes(email)) {
          await db.insert(users).values({ email, name: user.name ?? email, role: "編集" });
          console.log(`[signIn] ADMIN_EMAILS から自動登録: ${email}`);
          return true;
        }
        const dbHost = (() => {
          try {
            return new URL(process.env.DATABASE_URL ?? "").host;
          } catch {
            return "（DATABASE_URL 未設定）";
          }
        })();
        console.warn(
          `[signIn] 未登録のためログイン拒否: ${email} / ADMIN_EMAILS 設定数: ${bootstrapEmails().length} / 接続先DB: ${dbHost}`,
        );
        return false;
      } catch (e) {
        console.error("[signIn] データベースの確認中にエラー", e);
        return false;
      }
    },
  },
});
