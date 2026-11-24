import Link from "next/link";
import { fiscalYearOf, formatDate, fyLabel, todayJST } from "@/lib/dates";
import { pct, people, yen, yenShort } from "@/lib/format";
import { loadAccountRows, loadDashboard, userName } from "@/lib/queries";
import { runDailyJobs } from "@/lib/domain";
import { canEdit, getCurrentUser } from "@/lib/session";
import { OPP_STAGES, ENG_STATUSES } from "@/lib/options";
import { AccountLink, Card, Empty, Kpi, StageBadge, Warn, inputCls, filterCls } from "@/components/ui";

export const dynamic = "force-dynamic";

type SP = { fy?: string; q?: string; owner?: string; stage?: string; focus?: string; alert?: string; sort?: string };

export default async function TopPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  // 日次ジョブ（契約終了・更新案件作成）は Cron でも動くが、念のため表示時にも実行（何度実行しても同じ結果）
  await runDailyJobs();

  const today = todayJST();
  const currentFy = fiscalYearOf(today);
  const fy = Number(sp.fy) || currentFy;
  const [d, rows, me] = await Promise.all([loadDashboard(fy), loadAccountRows(), getCurrentUser()]);

  const target = d.targetSeats;
  const ratio = (n: number) => (target ? n / target : null);

  // アカウント一覧の絞り込み
  let list = rows;
  if (sp.q) list = list.filter((r) => r.name.includes(sp.q!) || (r.city ?? "").includes(sp.q!));
  if (sp.owner) list = list.filter((r) => r.ownerId === sp.owner);
  if (sp.stage) list = list.filter((r) => r.currentStage === sp.stage);
  if (sp.focus) list = list.filter((r) => r.focus);
  if (sp.alert === "overdue") list = list.filter((r) => r.overdue);
  if (sp.alert === "noaction") list = list.filter((r) => r.needsAction);
  if (sp.alert === "focus") list = list.filter((r) => r.focusExpired);
  if (sp.sort === "due")
    list = [...list].sort((a, b) => (a.nextAction?.dueDate ?? "9999").localeCompare(b.nextAction?.dueDate ?? "9999"));
  if (sp.sort === "amount") list = [...list].sort((a, b) => b.openAmount - a.openAmount);

  const overdueCount = rows.filter((r) => r.overdue).length;
  const noActionCount = rows.filter((r) => r.needsAction).length;
  const focusExpiredCount = rows.filter((r) => r.focusExpired).length;

  const fyOptions = [currentFy - 1, currentFy, currentFy + 1, currentFy + 2];

  return (
    <div className="space-y-6">
      {/* 年度切り替え */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">経営指標 {fyLabel(fy)}</h1>
        <div className="flex items-center gap-1 text-sm">
          {fyOptions.map((y) => (
            <Link
              key={y}
              href={`/?fy=${y}`}
              className={`rounded px-3 py-1 ${y === fy ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
            >
              {fyLabel(y)}
            </Link>
          ))}
        </div>
      </div>

      {/* 目標（契約人数）に対する進捗 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="目標契約人数" value={target != null ? people(target) : "未設定"} sub={target == null ? <Link className="text-indigo-700 underline" href="/settings">設定で入力</Link> : `${fyLabel(fy)}（4月〜3月）`} />
        <Kpi label="受注済み（契約人数）" value={people(d.won.seats)} sub={`目標達成率 ${pct(ratio(d.won.seats))}`} emphasis />
        <Kpi label="手堅い見通し（受注済み＋Binary）" value={people(d.firm.seats)} sub={`見通しベース達成率 ${pct(ratio(d.firm.seats))}`} />
        <Kpi label="目標までの残り" value={target != null ? people(Math.max(target - d.won.seats, 0)) : "—"} sub={target != null ? `手堅い見通しとの差 ${people(Math.max(target - d.firm.seats, 0))}` : undefined} />
      </div>

      <TargetBar target={target} won={d.won.seats} binary={d.binary.seats} all={d.all.seats} />

      {/* 金額 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="受注済み（金額）" value={yenShort(d.won.amount)} sub={`${d.won.count}件`} />
        <Kpi label="Binary Backlog（確度50%以上）" value={yenShort(d.binary.amount)} sub={`${d.binary.count}件・${people(d.binary.seats)}`} />
        <Kpi label="All Backlog（未受注すべて）" value={yenShort(d.all.amount)} sub={`${d.all.count}件・${people(d.all.seats)}`} />
        <Kpi label="現在の契約人数" value={people(d.currentSeats)} sub={`実利用人数 ${people(d.currentActive)}`} />
      </div>

      {/* 警告 */}
      <div className="flex flex-wrap gap-2 text-sm">
        <AlertLink href="/?alert=overdue#accounts" count={overdueCount} label="ネクストアクション期限切れ" />
        <AlertLink href="/?alert=noaction#accounts" count={noActionCount} label="ネクストアクション未設定" />
        <AlertLink href="/?alert=focus#accounts" count={focusExpiredCount} label="Focus期限切れ" tone="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={`Opportunity ステージ別（${fyLabel(fy)}）`} className="lg:col-span-2">
          <table className="w-full table-fixed text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="py-1 font-normal">ステージ</th>
                <th className="py-1 text-right font-normal">件数</th>
                <th className="py-1 text-right font-normal">人数</th>
                <th className="py-1 text-right font-normal">金額</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {d.byStage.map((s) => (
                <tr key={s.stage} className="border-t border-slate-100">
                  <td className="py-1.5"><StageBadge stage={s.stage} /></td>
                  <td className="py-1.5 text-right">{s.count}</td>
                  <td className="py-1.5 text-right">{people(s.seats)}</td>
                  <td className="py-1.5 text-right">{yen(s.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="mt-5 text-xs font-semibold text-slate-600">Engagement ステータス別（全期間）</h3>
          <table className="mt-1 w-full table-fixed text-sm">
            <tbody className="tabular-nums">
              {d.byStatus.map((s) => (
                <tr key={s.status} className="border-t border-slate-100">
                  <td className="py-1.5"><StageBadge stage={s.status} /></td>
                  <td className="py-1.5 text-right">{s.count}</td>
                  <td className="py-1.5 text-right">{people(s.seats)}</td>
                  <td className="py-1.5 text-right">{yen(s.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="space-y-4">
          <Card title="アップセルフォーキャスト">
            <dl className="grid grid-cols-2 gap-y-1 text-sm tabular-nums">
              <dt className="text-slate-500">Binary Backlog</dt>
              <dd className="text-right">{yen(d.upsellBinary.amount)}<span className="ml-1 text-xs text-slate-500">{people(d.upsellBinary.seats)}</span></dd>
              <dt className="text-slate-500">All Backlog</dt>
              <dd className="text-right">{yen(d.upsellAll.amount)}<span className="ml-1 text-xs text-slate-500">{people(d.upsellAll.seats)}</span></dd>
            </dl>
          </Card>
          <Card title="今月の動き">
            <dl className="grid grid-cols-[auto_auto_1fr] gap-x-3 gap-y-1 text-sm tabular-nums">
              <dt className="text-slate-500">新規Opportunity</dt><dd className="text-right">{d.newThisMonth.count}件</dd><dd className="text-right">{yen(d.newThisMonth.amount)}</dd>
              <dt className="text-slate-500">受注</dt><dd className="text-right">{d.wonThisMonth.count}件</dd><dd className="text-right">{yen(d.wonThisMonth.amount)}</dd>
              <dt className="text-slate-500">失注</dt><dd className="text-right">{d.lostThisMonth.count}件</dd><dd className="text-right">{yen(d.lostThisMonth.amount)}</dd>
            </dl>
          </Card>
          <Card title="更新予定（6か月以内に契約終了）">
            {d.renewals.length === 0 ? (
              <Empty>該当なし</Empty>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {d.renewals.map((e) => {
                  const acc = rows.find((r) => r.id === e.accountId);
                  return (
                    <li key={e.id} className="flex justify-between gap-2">
                      <span className="truncate">{acc && <AccountLink id={acc.id} name={acc.name} />}</span>
                      <span className="whitespace-nowrap tabular-nums text-slate-600">{formatDate(e.endDate)}・{yen(e.amount)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* アカウント一覧 */}
      <Card
        title={`アカウント一覧（${list.length}件）`}
        actions={canEdit(me) && <Link href="/accounts/new" className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700">＋ アカウント追加</Link>}
      >
        <div id="accounts" />
        <form className="mb-3 flex flex-wrap items-end gap-2 text-sm" action="/">
          <input type="hidden" name="fy" value={fy} />
          <input name="q" defaultValue={sp.q} placeholder="学校名・市区町村で検索" className={`${filterCls} w-56`} />
          <select name="owner" defaultValue={sp.owner ?? ""} className={`${filterCls} w-36`}>
            <option value="">担当：すべて</option>
            {d.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select name="stage" defaultValue={sp.stage ?? ""} className={`${filterCls} w-44`}>
            <option value="">ステージ：すべて</option>
            {[...OPP_STAGES, ...ENG_STATUSES, "未着手"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select name="sort" defaultValue={sp.sort ?? ""} className={`${filterCls} w-48`}>
            <option value="">並び順：学校名</option>
            <option value="due">並び順：ネクストアクション期日</option>
            <option value="amount">並び順：進行中の金額</option>
          </select>
          <label className="flex items-center gap-1 text-slate-600"><input type="checkbox" name="focus" value="1" defaultChecked={!!sp.focus} /> Focusのみ</label>
          <button className="rounded bg-slate-800 px-3 py-1.5 text-white">絞り込む</button>
          {(sp.q || sp.owner || sp.stage || sp.focus || sp.alert || sp.sort) && <Link href={`/?fy=${fy}`} className="text-xs text-slate-500 underline">解除</Link>}
        </form>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
              <tr>
                <th className="w-8 py-2 font-normal"></th>
                <th className="py-2 font-normal">学校名</th>
                <th className="py-2 font-normal">地域</th>
                <th className="py-2 font-normal">現在のステージ</th>
                <th className="py-2 font-normal">担当</th>
                <th className="py-2 font-normal">ネクストアクション</th>
                <th className="py-2 text-right font-normal">進行中の金額</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                  <td className="py-2 text-center">{r.focus ? <span title={r.focusComment ?? "Focus"} className="text-amber-500">★</span> : ""}</td>
                  <td className="py-2">
                    <AccountLink id={r.id} name={r.name} />
                    {r.focusExpired && <div className="mt-0.5"><Warn tone="amber">Focus期限切れ</Warn></div>}
                  </td>
                  <td className="py-2 text-slate-600">{r.prefecture}{r.city ? ` ${r.city}` : ""}</td>
                  <td className="py-2"><StageBadge stage={r.currentStage} /></td>
                  <td className="py-2 text-slate-600">{userName(d.users, r.ownerId)}</td>
                  <td className="py-2">
                    {r.nextAction ? (
                      <div>
                        <div className="text-slate-800">{r.nextAction.content}</div>
                        <div className="text-xs text-slate-500">
                          <span className={r.nextAction.dueDate < today ? "font-semibold text-red-600" : ""}>{formatDate(r.nextAction.dueDate)}</span>
                          ・{userName(d.users, r.nextAction.ownerId)}
                          {r.openActionCount > 1 && `（ほか${r.openActionCount - 1}件）`}
                        </div>
                      </div>
                    ) : r.needsAction ? (
                      <Warn>未設定</Warn>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-2 text-right tabular-nums">{r.openAmount ? yen(r.openAmount) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <Empty>該当するアカウントはありません</Empty>}
        </div>
      </Card>
    </div>
  );
}

function AlertLink({ href, count, label, tone = "red" }: { href: string; count: number; label: string; tone?: "red" | "amber" }) {
  if (count === 0)
    return <span className="rounded-full bg-white px-3 py-1 text-slate-400 ring-1 ring-slate-200">{label} 0件</span>;
  const c = tone === "red" ? "bg-red-50 text-red-700 ring-red-200" : "bg-amber-50 text-amber-800 ring-amber-200";
  return (
    <Link href={href} className={`rounded-full px-3 py-1 font-medium ring-1 hover:underline ${c}`}>
      ⚠ {label} {count}件
    </Link>
  );
}

/** 目標人数に対する積み上げバー：受注済み → Binary → その他のBacklog */
function TargetBar({ target, won, binary, all }: { target: number | null; won: number; binary: number; all: number }) {
  const rest = Math.max(all - binary, 0);
  const total = Math.max(target ?? 0, won + all, 1);
  const w = (n: number) => `${(n / total) * 100}%`;
  const segs = [
    { label: "受注済み", value: won, cls: "bg-indigo-700" },
    { label: "Binary Backlog", value: binary, cls: "bg-indigo-400" },
    { label: "その他のBacklog", value: rest, cls: "bg-indigo-200" },
  ];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-slate-600">
        {segs.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-sm ${s.cls}`} />
            {s.label} {people(s.value)}
          </span>
        ))}
        {target != null && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-0.5 bg-slate-900" />目標 {people(target)}
          </span>
        )}
      </div>
      <div className="relative h-6 w-full rounded bg-slate-100">
        <div className="flex h-full gap-[2px] overflow-hidden rounded">
          {segs.map((s) =>
            s.value > 0 ? <div key={s.label} title={`${s.label}：${people(s.value)}`} className={`h-full ${s.cls}`} style={{ width: w(s.value) }} /> : null,
          )}
        </div>
        {target != null && <div className="absolute -top-1 -bottom-1 w-0.5 bg-slate-900" style={{ left: w(target) }} title={`目標：${people(target)}`} />}
      </div>
    </div>
  );
}
