import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { accounts, opportunities } from "@/db/schema";
import { changeOppStage } from "@/app/actions";
import { AutoSubmitSelect } from "@/components/ActionForm";
import { AccountLink, Card, Empty, StageBadge, inputCls, filterCls } from "@/components/ui";
import { fiscalYearOf, formatDate, fyLabel, todayJST } from "@/lib/dates";
import { people, yen } from "@/lib/format";
import { listUsers, userName } from "@/lib/queries";
import { canEdit, requireUser } from "@/lib/session";
import { OPP_STAGES, OPP_TYPES } from "@/lib/options";

export const dynamic = "force-dynamic";

type SP = { view?: string; fy?: string; owner?: string; type?: string; closed?: string };

export default async function PipelinePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const me = await requireUser();
  const editable = canEdit(me);
  const [opps, accs, users] = await Promise.all([
    db.select().from(opportunities).orderBy(asc(opportunities.expectedCloseDate)),
    db.select().from(accounts),
    listUsers(),
  ]);
  const accName = new Map(accs.map((a) => [a.id, a.name]));
  const currentFy = fiscalYearOf(todayJST());

  let list = opps;
  if (sp.fy) list = list.filter((o) => o.fiscalYear === Number(sp.fy));
  if (sp.owner) list = list.filter((o) => o.ownerId === sp.owner);
  if (sp.type) list = list.filter((o) => o.type === sp.type);
  const stages = sp.closed ? OPP_STAGES : OPP_STAGES.filter((s) => s !== "受注" && s !== "失注");
  list = list.filter((o) => (stages as readonly string[]).includes(o.stage));

  const view = sp.view === "list" ? "list" : "board";
  const qs = (patch: Partial<SP>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/pipeline?${p.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">パイプライン</h1>
        <div className="flex gap-1 text-sm">
          <Link href={qs({ view: "board" })} className={`rounded px-3 py-1 ${view === "board" ? "bg-slate-900 text-white" : "bg-white ring-1 ring-slate-200"}`}>カンバン</Link>
          <Link href={qs({ view: "list" })} className={`rounded px-3 py-1 ${view === "list" ? "bg-slate-900 text-white" : "bg-white ring-1 ring-slate-200"}`}>一覧</Link>
        </div>
      </div>

      <form action="/pipeline" className="flex flex-wrap items-center gap-2 text-sm">
        <input type="hidden" name="view" value={view} />
        <select name="fy" defaultValue={sp.fy ?? ""} className={`${filterCls} w-36`}>
          <option value="">年度：すべて</option>
          {[currentFy - 1, currentFy, currentFy + 1, currentFy + 2].map((y) => <option key={y} value={y}>{fyLabel(y)}</option>)}
        </select>
        <select name="owner" defaultValue={sp.owner ?? ""} className={`${filterCls} w-36`}>
          <option value="">担当：すべて</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select name="type" defaultValue={sp.type ?? ""} className={`${filterCls} w-36`}>
          <option value="">種別：すべて</option>
          {OPP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <label className="flex items-center gap-1 text-slate-600"><input type="checkbox" name="closed" value="1" defaultChecked={!!sp.closed} /> 受注・失注も表示</label>
        <button className="rounded bg-slate-800 px-3 py-1.5 text-white">絞り込む</button>
      </form>

      {view === "board" ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {stages.map((s) => {
            const col = list.filter((o) => o.stage === s);
            return (
              <div key={s} className="w-72 shrink-0 rounded-lg bg-slate-100 p-2">
                <div className="mb-2 flex items-center justify-between px-1">
                  <StageBadge stage={s} />
                  <span className="text-xs tabular-nums text-slate-500">{col.length}件・{yen(col.reduce((a, o) => a + o.amount, 0))}</span>
                </div>
                <div className="space-y-2">
                  {col.map((o) => (
                    <div key={o.id} className="rounded-md border border-slate-200 bg-white p-2.5 text-sm shadow-sm">
                      <AccountLink id={o.accountId} name={accName.get(o.accountId) ?? "?"} />
                      <div className="text-xs text-slate-600">{o.name}<span className="ml-1 rounded bg-slate-100 px-1">{o.type}</span></div>
                      <div className="mt-1 flex justify-between text-xs tabular-nums text-slate-500">
                        <span>{yen(o.amount)}・{people(o.seats)}</span>
                        <span>確度 {o.probability}%</span>
                      </div>
                      <div className="text-xs text-slate-500">受注予定 {formatDate(o.expectedCloseDate)}・{userName(users, o.ownerId)}</div>
                      {editable && (
                        <div className="mt-1.5">
                          <AutoSubmitSelect action={changeOppStage.bind(null, o.id)} name="stage" defaultValue={o.stage} options={OPP_STAGES} className="w-full rounded border border-slate-200 px-1.5 py-1 text-xs" />
                        </div>
                      )}
                    </div>
                  ))}
                  {col.length === 0 && <p className="px-1 py-3 text-center text-xs text-slate-400">なし</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          {list.length === 0 ? <Empty>該当する案件はありません</Empty> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-2 font-normal">学校名</th><th className="py-2 font-normal">案件名</th><th className="py-2 font-normal">種別</th>
                    <th className="py-2 font-normal">ステージ</th><th className="py-2 text-right font-normal">確度</th><th className="py-2 text-right font-normal">人数</th>
                    <th className="py-2 text-right font-normal">金額</th><th className="py-2 font-normal">受注予定</th><th className="py-2 font-normal">年度</th><th className="py-2 font-normal">担当</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {list.map((o) => (
                    <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2"><AccountLink id={o.accountId} name={accName.get(o.accountId) ?? "?"} /></td>
                      <td className="py-2">{o.name}</td><td className="py-2">{o.type}</td>
                      <td className="py-2"><StageBadge stage={o.stage} /></td>
                      <td className="py-2 text-right">{o.probability}%</td><td className="py-2 text-right">{people(o.seats)}</td>
                      <td className="py-2 text-right">{yen(o.amount)}</td><td className="py-2">{formatDate(o.expectedCloseDate)}</td>
                      <td className="py-2">{fyLabel(o.fiscalYear)}</td><td className="py-2">{userName(users, o.ownerId)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
