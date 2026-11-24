import Link from "next/link";
import { signOut } from "@/auth";
import { requireUser } from "@/lib/session";
import { NavLinks } from "@/components/NavLinks";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-2.5">
          <Link href="/" className="text-sm font-semibold text-slate-900">
            営業管理ダッシュボード
          </Link>
          <NavLinks />
          <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
            <span>
              {me.name}（{me.role}）
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50">ログアウト</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
