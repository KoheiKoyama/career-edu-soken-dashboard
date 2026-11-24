import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { getCurrentUser } from "@/lib/session";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold">営業管理ダッシュボード</h1>
        <p className="mt-2 text-sm text-slate-500">社内メンバーのGoogleアカウントでログインしてください。</p>
        {error && (
          <p className="mt-4 rounded bg-red-50 p-2 text-sm text-red-700">
            このアカウントはログインできません。管理者にユーザー登録を依頼してください。
          </p>
        )}
        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button className="w-full rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Googleでログイン
          </button>
        </form>
      </div>
    </main>
  );
}
