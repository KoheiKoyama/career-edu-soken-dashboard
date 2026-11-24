import { asc } from "drizzle-orm";
import { db } from "@/db";
import { targets } from "@/db/schema";
import { runJobsNow, upsertTarget, upsertUser } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { Button, Card, Disclosure, Field, Select, inputCls } from "@/components/ui";
import { fiscalYearOf, fyLabel, todayJST } from "@/lib/dates";
import { people, yen } from "@/lib/format";
import { listUsers } from "@/lib/queries";
import { canEdit, requireUser } from "@/lib/session";
import { ROLES } from "@/lib/options";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const me = await requireUser();
  const editable = canEdit(me);
  const [users, ts] = await Promise.all([listUsers(), db.select().from(targets).orderBy(asc(targets.fiscalYear))]);
  const fy = fiscalYearOf(todayJST());

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">設定</h1>

      <Card title="年度目標（契約人数）">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500"><tr><th className="py-1 font-normal">年度</th><th className="py-1 text-right font-normal">目標契約人数</th><th className="py-1 text-right font-normal">目標金額（将来用）</th></tr></thead>
          <tbody className="tabular-nums">
            {ts.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="py-1.5">{fyLabel(t.fiscalYear)}</td><td className="py-1.5 text-right">{people(t.targetSeats)}</td><td className="py-1.5 text-right">{t.targetAmount ? yen(t.targetAmount) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {editable && (
          <div className="mt-3">
            <Disclosure label="目標を入力・変更">
              <ActionForm action={upsertTarget}>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="年度 *"><Select name="fiscalYear" options={[fy - 1, fy, fy + 1, fy + 2].map((y) => ({ value: String(y), label: `${fyLabel(y)}（${y}年4月〜${y + 1}年3月）` }))} defaultValue={String(fy)} /></Field>
                  <Field label="目標契約人数 *"><input name="targetSeats" type="number" min={0} required className={inputCls} /></Field>
                  <Field label="目標金額（任意）"><input name="targetAmount" type="number" min={0} className={inputCls} /></Field>
                </div>
                <div className="mt-3"><Button>保存</Button></div>
              </ActionForm>
            </Disclosure>
          </div>
        )}
      </Card>

      <Card title="ユーザー">
        <p className="mb-2 text-xs text-slate-500">ここに登録された有効なユーザーだけが、Googleアカウントでログインできます。</p>
        <ul className="divide-y divide-slate-100">
          {users.map((u) => (
            <li key={u.id} className="py-2">
              <div className="flex items-center gap-3 text-sm">
                <span className="font-medium">{u.name}</span>
                <span className="text-slate-500">{u.email}</span>
                <span className="rounded bg-slate-100 px-1.5 text-xs">{u.role}</span>
                {!u.active && <span className="rounded bg-red-50 px-1.5 text-xs text-red-700">無効</span>}
              </div>
              {editable && (
                <Disclosure label="編集">
                  <ActionForm action={upsertUser}>
                    <UserFields id={u.id} name={u.name} email={u.email} role={u.role} active={u.active} />
                  </ActionForm>
                </Disclosure>
              )}
            </li>
          ))}
        </ul>
        {editable && (
          <div className="mt-2">
            <Disclosure label="＋ ユーザーを追加">
              <ActionForm action={upsertUser} resetOnSuccess>
                <UserFields active />
              </ActionForm>
            </Disclosure>
          </div>
        )}
      </Card>

      {editable && (
        <Card title="自動処理">
          <p className="text-sm text-slate-600">毎朝6時に、契約終了日を過ぎた契約を「契約終了」にし、契約終了の6か月前になった契約の更新案件を作ります。トップ画面を開いたときにも同じ処理が動きます。</p>
          <ActionForm action={runJobsNow} className="mt-2"><Button variant="ghost">今すぐ実行</Button></ActionForm>
        </Card>
      )}
    </div>
  );
}

function UserFields(p: { id?: string; name?: string; email?: string; role?: string; active?: boolean }) {
  return (
    <>
      {p.id && <input type="hidden" name="id" value={p.id} />}
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="氏名 *"><input name="name" required defaultValue={p.name} className={inputCls} /></Field>
        <Field label="Googleアカウントのメール *"><input name="email" type="email" required defaultValue={p.email} className={inputCls} /></Field>
        <Field label="権限 *"><Select name="role" options={ROLES} defaultValue={p.role ?? "編集"} /></Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="active" defaultChecked={p.active} /> 有効</label>
      </div>
      <div className="mt-3"><Button>保存</Button></div>
    </>
  );
}
