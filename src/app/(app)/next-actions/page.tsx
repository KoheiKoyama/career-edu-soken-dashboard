import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, nextActions } from "@/db/schema";
import { completeNextAction } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { AccountLink, Card, Empty, StageBadge, Warn, inputCls, filterCls } from "@/components/ui";
import { daysBetween, formatDate, todayJST } from "@/lib/dates";
import { listUsers, loadAccountRows, userName } from "@/lib/queries";
import { canEdit, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NextActionsPage({ searchParams }: { searchParams: Promise<{ owner?: string; sort?: string }> }) {
  const sp = await searchParams;
  const me = await requireUser();
  const editable = canEdit(me);
  const today = todayJST();
  const [nas, accs, users, rows] = await Promise.all([
    db.select().from(nextActions).where(eq(nextActions.done, false)).orderBy(asc(nextActions.dueDate)),
    db.select().from(accounts),
    listUsers(),
    loadAccountRows(),
  ]);
  const accName = new Map(accs.map((a) => [a.id, a.name]));
  let list = nas;
  if (sp.owner) list = list.filter((n) => n.ownerId === sp.owner);
  if (sp.sort === "owner")
    list = [...list].sort((a, b) => userName(users, a.ownerId).localeCompare(userName(users, b.ownerId), "ja") || a.dueDate.localeCompare(b.dueDate));
  const missing = rows.filter((r) => r.needsAction && (!sp.owner || r.ownerId === sp.owner));
  const overdue = list.filter((n) => n.dueDate < today).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">ネクストアクション</h1>
        <form action="/next-actions" className="flex items-center gap-2 text-sm">
          <select name="owner" defaultValue={sp.owner ?? ""} className={`${filterCls} w-36`}>
            <option value="">担当：すべて</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select name="sort" defaultValue={sp.sort ?? ""} className={`${filterCls} w-40`}>
            <option value="">並び順：期日</option>
            <option value="owner">並び順：担当者→期日</option>
          </select>
          <button className="rounded bg-slate-800 px-3 py-1.5 text-white">表示</button>
        </form>
      </div>

      {missing.length > 0 && (
        <Card title={<span className="text-red-700">⚠ ネクストアクション未設定のアカウント（{missing.length}件）</span>}>
          <ul className="flex flex-wrap gap-2 text-sm">
            {missing.map((r) => (
              <li key={r.id} className="flex items-center gap-1.5 rounded border border-red-200 bg-red-50 px-2 py-1">
                <AccountLink id={r.id} name={r.name} /><StageBadge stage={r.currentStage} />
                <span className="text-xs text-slate-500">{userName(users, r.ownerId)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title={<>未完了 {list.length}件{overdue > 0 && <span className="ml-2"><Warn>期限切れ {overdue}件</Warn></span>}</>}>
        {list.length === 0 ? <Empty>未完了のネクストアクションはありません</Empty> : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
              <tr>
                {editable && <th className="w-10 py-2 font-normal">完了</th>}
                <th className="py-2 font-normal">期日</th><th className="py-2 font-normal">内容</th>
                <th className="py-2 font-normal">学校名</th><th className="py-2 font-normal">担当</th>
              </tr>
            </thead>
            <tbody>
              {list.map((n) => {
                const late = n.dueDate < today;
                const diff = daysBetween(today, n.dueDate);
                return (
                  <tr key={n.id} className={`border-b border-slate-100 ${late ? "bg-red-50/50" : ""}`}>
                    {editable && (
                      <td className="py-2">
                        <ActionForm action={completeNextAction.bind(null, n.id, n.accountId)}>
                          <button title="完了にする" className="h-5 w-5 rounded border border-slate-400 hover:border-emerald-600 hover:bg-emerald-50" />
                        </ActionForm>
                      </td>
                    )}
                    <td className="whitespace-nowrap py-2 tabular-nums">
                      <span className={late ? "font-semibold text-red-600" : ""}>{formatDate(n.dueDate)}</span>
                      <span className="ml-1 text-xs text-slate-500">{late ? `${-diff}日超過` : diff === 0 ? "今日" : `あと${diff}日`}</span>
                    </td>
                    <td className="py-2">{n.content}{n.source !== "手入力" && <span className="ml-1 rounded bg-sky-50 px-1 text-xs text-sky-700">自動</span>}</td>
                    <td className="py-2"><AccountLink id={n.accountId} name={accName.get(n.accountId) ?? "?"} /></td>
                    <td className="py-2 text-slate-600">{userName(users, n.ownerId)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="mt-3 text-xs text-slate-500">追加・編集は各<Link href="/" className="underline">アカウント</Link>の詳細画面から行います。完了にすると、そのアカウントのアクティビティに記録されます。</p>
      </Card>
    </div>
  );
}
