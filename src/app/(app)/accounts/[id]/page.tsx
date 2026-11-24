import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, activities, contacts, engagements, nextActions, opportunities, stageHistory } from "@/db/schema";
import * as A from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { AccountFields, ActivityFields, ContactFields, EngagementFields, NextActionFields, OpportunityFields, type RelatedOption } from "@/components/forms";
import { Button, Card, Disclosure, Empty, Field, StageBadge, Warn, inputCls } from "@/components/ui";
import { formatDate, formatDateTime, fyLabel, todayJST } from "@/lib/dates";
import { people, yen } from "@/lib/format";
import { currentStageOf, listUsers, userName } from "@/lib/queries";
import { canEdit, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AccountPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string; stage?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const me = await requireUser();
  const editable = canEdit(me);
  const today = todayJST();

  const [account] = await db.select().from(accounts).where(eq(accounts.id, id));
  if (!account) notFound();

  const [users, cts, opps, engs, acts, nas, hist] = await Promise.all([
    listUsers(),
    db.select().from(contacts).where(eq(contacts.accountId, id)).orderBy(desc(contacts.isPrimary), asc(contacts.createdAt)),
    db.select().from(opportunities).where(eq(opportunities.accountId, id)).orderBy(desc(opportunities.expectedStartDate)),
    db.select().from(engagements).where(eq(engagements.accountId, id)).orderBy(desc(engagements.startDate)),
    db.select().from(activities).where(eq(activities.accountId, id)).orderBy(desc(activities.date), desc(activities.createdAt)),
    db.select().from(nextActions).where(eq(nextActions.accountId, id)).orderBy(asc(nextActions.dueDate)),
    db.select().from(stageHistory).where(eq(stageHistory.accountId, id)).orderBy(desc(stageHistory.changedAt)).limit(50),
  ]);

  const openNas = nas.filter((n) => !n.done);
  const doneNas = nas.filter((n) => n.done).reverse();
  const related: RelatedOption[] = [
    ...opps.map((o) => ({ value: `opp:${o.id}`, label: `Opp：${o.name}` })),
    ...engs.map((e) => ({ value: `eng:${e.id}`, label: `契約：${e.startDate}〜${e.endDate}` })),
  ];
  const relatedLabel = (oppId: string | null, engId: string | null) => {
    if (oppId) return opps.find((o) => o.id === oppId)?.name;
    if (engId) {
      const e = engs.find((x) => x.id === engId);
      return e ? `契約 ${formatDate(e.startDate)}〜` : undefined;
    }
  };
  const contactName = (cid: string) => cts.find((c) => c.id === cid)?.name ?? "";
  const stage = currentStageOf(opps, engs);
  const inProgress = opps.some((o) => ["リード", "商談予定済み", "商談済み"].includes(o.stage)) || engs.some((e) => e.status === "Onboarding");
  const focusExpired = account.focus && account.focusDue && account.focusDue < today;

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {account.focus && <span className="text-lg text-amber-500" title="Focus">★</span>}
            <h1 className="text-xl font-semibold">{account.name}</h1>
            <StageBadge stage={stage} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {account.prefecture}{account.city ? ` ${account.city}` : ""}・{account.establishment}{account.schoolType}
            {account.courseType ? `（${account.courseType}）` : ""}・担当 {userName(users, account.ownerId)}
            {account.studentCount != null && `・在籍生徒数 ${people(account.studentCount)}`}
          </p>
        </div>
        <div className="flex gap-2">
          {inProgress && openNas.length === 0 && <Warn>ネクストアクション未設定</Warn>}
          {focusExpired && <Warn tone="amber">Focus期限切れ</Warn>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* ネクストアクション */}
          <Card title={`ネクストアクション（未完了 ${openNas.length}件）`}>
            {openNas.length === 0 ? <Empty>未完了のネクストアクションはありません</Empty> : (
              <ul className="divide-y divide-slate-100">
                {openNas.map((n) => (
                  <li key={n.id} className="py-2">
                    <div className="flex items-start gap-3">
                      {editable && (
                        <ActionForm action={A.completeNextAction.bind(null, n.id, id)}>
                          <button title="完了にする（アクティビティに記録されます）" className="mt-0.5 h-5 w-5 rounded border border-slate-400 hover:border-emerald-600 hover:bg-emerald-50" />
                        </ActionForm>
                      )}
                      <div className="flex-1">
                        <div className="text-sm text-slate-900">{n.content}</div>
                        <div className="text-xs text-slate-500">
                          <span className={n.dueDate < today ? "font-semibold text-red-600" : ""}>期日 {formatDate(n.dueDate)}{n.dueDate < today && "（期限切れ）"}</span>
                          ・{userName(users, n.ownerId)}
                          {relatedLabel(n.opportunityId, n.engagementId) && `・${relatedLabel(n.opportunityId, n.engagementId)}`}
                          {n.source !== "手入力" && `・${n.source}`}
                        </div>
                      </div>
                      {editable && (
                        <div className="flex items-start">
                          <Disclosure label="編集">
                            <ActionForm action={A.updateNextAction.bind(null, n.id, id)}>
                              <NextActionFields n={n} users={users} me={me} related={related} />
                            </ActionForm>
                            <ActionForm action={A.deleteNextAction.bind(null, n.id, id)} confirm="このネクストアクションを削除しますか？" className="mt-2">
                              <Button variant="danger">削除</Button>
                            </ActionForm>
                          </Disclosure>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {editable && (
              <div className="mt-2">
                <Disclosure label="＋ ネクストアクションを追加" open={inProgress && openNas.length === 0}>
                  <ActionForm action={A.createNextAction.bind(null, id)} resetOnSuccess>
                    <NextActionFields users={users} me={me} related={related} />
                  </ActionForm>
                </Disclosure>
              </div>
            )}
            {doneNas.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-slate-500">完了済み（{doneNas.length}件）</summary>
                <ul className="mt-2 space-y-1">
                  {doneNas.map((n) => (
                    <li key={n.id} className="flex items-center justify-between text-sm text-slate-500">
                      <span className="line-through">{n.content}</span>
                      <span className="flex items-center gap-2 text-xs">
                        完了 {formatDate(n.doneDate)}
                        {editable && (
                          <ActionForm action={A.reopenNextAction.bind(null, n.id, id)}>
                            <button className="text-indigo-700 underline">未完了に戻す</button>
                          </ActionForm>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Card>

          {/* Opportunity */}
          <Card title={`Opportunity（受注前の案件）`}>
            {opps.length === 0 ? <Empty>案件はまだありません</Empty> : (
              <ul className="space-y-3">
                {opps.map((o) => (
                  <li key={o.id} id={`opp-${o.id}`} className="rounded-md border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <StageBadge stage={o.stage} />
                      <span className="font-medium">{o.name}</span>
                      <span className="rounded bg-slate-100 px-1.5 text-xs text-slate-600">{o.type}</span>
                      <span className="text-xs text-slate-500">確度 {o.probability}%</span>
                      <span className="ml-auto text-sm font-semibold tabular-nums">{yen(o.amount)}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500 tabular-nums">
                      {people(o.seats)} × {yen(o.unitPrice)} × {o.months}か月・受注予定 {formatDate(o.expectedCloseDate)}・契約開始予定 {formatDate(o.expectedStartDate)}（{fyLabel(o.fiscalYear)}）・担当 {userName(users, o.ownerId)}
                      {o.wonDate && `・受注日 ${formatDate(o.wonDate)}`}
                    </div>
                    {o.lostReason && <p className="mt-1 text-xs text-slate-600">理由：{o.lostReason}</p>}
                    {o.memo && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{o.memo}</p>}
                    {editable && (
                      <div className="mt-1">
                        <Disclosure label="編集" open={sp.edit === o.id}>
                          {sp.edit === o.id && sp.stage && <p className="mb-2 text-sm text-amber-700">「{sp.stage}」にするには理由を入力して保存してください。</p>}
                          <ActionForm action={A.updateOpportunity.bind(null, o.id, id)}>
                            <OpportunityFields o={o} users={users} me={me} engagements={engs} stageOverride={sp.edit === o.id ? sp.stage : undefined} />
                          </ActionForm>
                          {!engs.some((e) => e.opportunityId === o.id) && (
                            <ActionForm action={A.deleteOpportunity.bind(null, o.id, id)} confirm="この案件を削除しますか？" className="mt-2">
                              <Button variant="danger">削除</Button>
                            </ActionForm>
                          )}
                        </Disclosure>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {editable && (
              <div className="mt-3">
                <Disclosure label="＋ Opportunityを追加">
                  <ActionForm action={A.createOpportunity.bind(null, id)} resetOnSuccess>
                    <OpportunityFields users={users} me={me} engagements={engs} />
                  </ActionForm>
                </Disclosure>
              </div>
            )}
          </Card>

          {/* Engagement */}
          <Card title="Engagement（受注後の契約）">
            {engs.length === 0 ? <Empty>契約はまだありません。Opportunity を受注にすると自動で作られます。</Empty> : (
              <ul className="space-y-3">
                {engs.map((e) => (
                  <li key={e.id} className="rounded-md border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <StageBadge stage={e.status} />
                      <span className="font-medium tabular-nums">{formatDate(e.startDate)} 〜 {formatDate(e.endDate)}</span>
                      <span className="text-xs text-slate-500">{fyLabel(e.fiscalYear)}</span>
                      {e.renewalCreated && <span className="rounded bg-sky-50 px-1.5 text-xs text-sky-700">更新案件作成済み</span>}
                      <span className="ml-auto text-sm font-semibold tabular-nums">{yen(e.amount)}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500 tabular-nums">
                      契約 {people(e.seats)}（実利用 {people(e.activeUsers)}）× {yen(e.unitPrice)} × {e.months}か月・担当 {userName(users, e.ownerId)}
                    </div>
                    {e.churnReason && <p className="mt-1 text-xs text-slate-600">解約理由：{e.churnReason}</p>}
                    {e.memo && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{e.memo}</p>}
                    {editable && (
                      <div className="mt-1">
                        <Disclosure label="編集">
                          <ActionForm action={A.updateEngagement.bind(null, e.id, id)}>
                            <EngagementFields e={e} users={users} />
                          </ActionForm>
                        </Disclosure>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* アクティビティ */}
          <Card title={`アクティビティ（${acts.length}件）`}>
            {editable && (
              <div className="mb-3">
                <Disclosure label="＋ アクティビティを記録">
                  <ActionForm action={A.createActivity.bind(null, id)} resetOnSuccess>
                    <ActivityFields users={users} me={me} contacts={cts} related={related} />
                  </ActionForm>
                </Disclosure>
              </div>
            )}
            {acts.length === 0 ? <Empty>記録はまだありません</Empty> : (
              <ol className="relative space-y-4 border-l border-slate-200 pl-4">
                {acts.map((a) => (
                  <li key={a.id}>
                    <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-indigo-400" />
                    <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-slate-500">
                      <span className="font-medium text-slate-700 tabular-nums">{formatDate(a.date)}</span>
                      <span className="rounded bg-slate-100 px-1.5">{a.type}</span>
                      <span>{userName(users, a.performedBy)}</span>
                      {a.contactIds.length > 0 && <span>相手：{a.contactIds.map(contactName).filter(Boolean).join("、")}</span>}
                      {relatedLabel(a.opportunityId, a.engagementId) && <span>・{relatedLabel(a.opportunityId, a.engagementId)}</span>}
                    </div>
                    <div className="mt-0.5 text-sm font-medium text-slate-900">{a.title}</div>
                    {a.body && <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{a.body}</p>}
                    {editable && (
                      <ActionForm action={A.deleteActivity.bind(null, a.id, id)} confirm="このアクティビティを削除しますか？">
                        <button className="mt-1 text-xs text-slate-400 hover:text-red-600">削除</button>
                      </ActionForm>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          {/* Focus */}
          <Card title="Focus">
            {account.focus ? (
              <div className="space-y-1 text-sm">
                <p className="whitespace-pre-wrap text-slate-800">{account.focusComment || "（コメントなし）"}</p>
                <p className="text-xs text-slate-500">
                  {userName(users, account.focusSetBy)}が{formatDate(account.focusSetOn)}に設定・期限 {formatDate(account.focusDue)}
                </p>
              </div>
            ) : <Empty>Focus は設定されていません</Empty>}
            {editable && (
              <div className="mt-2">
                <Disclosure label="Focus を編集">
                  <ActionForm action={A.updateFocus.bind(null, id)}>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="focus" defaultChecked={account.focus} /> Focus にする</label>
                      <Field label="Focusコメント"><textarea name="focusComment" rows={2} defaultValue={account.focusComment ?? ""} className={inputCls} /></Field>
                      <Field label="Focus期限"><input type="date" name="focusDue" defaultValue={account.focusDue ?? ""} className={inputCls} /></Field>
                      <Button>保存</Button>
                    </div>
                  </ActionForm>
                </Disclosure>
              </div>
            )}
          </Card>

          {/* コンタクト */}
          <Card title={`コンタクト（${cts.length}名）`}>
            {cts.length === 0 ? <Empty>登録はまだありません</Empty> : (
              <ul className="divide-y divide-slate-100">
                {cts.map((c) => (
                  <li key={c.id} className={`py-2 text-sm ${c.status !== "在籍" ? "opacity-60" : ""}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.name}</span>
                      {c.isPrimary && <span className="rounded bg-indigo-50 px-1.5 text-xs text-indigo-700">主担当</span>}
                      {c.status !== "在籍" && <span className="rounded bg-slate-100 px-1.5 text-xs text-slate-600">{c.status}</span>}
                    </div>
                    <div className="text-xs text-slate-500">{c.roleType}{c.roleDetail ? `・${c.roleDetail}` : ""}</div>
                    <div className="text-xs text-slate-500">{[c.email, c.phone].filter(Boolean).join("・")}</div>
                    {c.memo && <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-600">{c.memo}</p>}
                    {editable && (
                      <Disclosure label="編集">
                        <ActionForm action={A.updateContact.bind(null, c.id, id)}>
                          <ContactFields c={c} />
                        </ActionForm>
                        <ActionForm action={A.deleteContact.bind(null, c.id, id)} confirm="このコンタクトを削除しますか？" className="mt-2">
                          <Button variant="danger">削除</Button>
                        </ActionForm>
                      </Disclosure>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {editable && (
              <div className="mt-2">
                <Disclosure label="＋ コンタクトを追加">
                  <ActionForm action={A.createContact.bind(null, id)} resetOnSuccess>
                    <ContactFields />
                  </ActionForm>
                </Disclosure>
              </div>
            )}
          </Card>

          {/* 基本情報 */}
          <Card title="基本情報">
            <dl className="grid grid-cols-[6rem_1fr] gap-y-1 text-sm">
              <dt className="text-slate-500">住所</dt><dd>{account.address || "—"}</dd>
              <dt className="text-slate-500">代表電話</dt><dd>{account.phone || "—"}</dd>
              <dt className="text-slate-500">Webサイト</dt><dd className="truncate">{account.website ? <a href={account.website} target="_blank" rel="noreferrer" className="text-indigo-700 underline">{account.website}</a> : "—"}</dd>
              <dt className="text-slate-500">メモ</dt><dd className="whitespace-pre-wrap">{account.memo || "—"}</dd>
            </dl>
            {editable && (
              <div className="mt-2 space-y-1">
                <Disclosure label="基本情報を編集">
                  <ActionForm action={A.updateAccount.bind(null, id)}>
                    <AccountFields a={account} users={users} me={me} />
                  </ActionForm>
                </Disclosure>
                <Disclosure label={<span className="text-red-600">アカウントを削除</span>}>
                  <ActionForm action={A.deleteAccount.bind(null, id)} confirm="本当に削除しますか？元に戻せません。">
                    <p className="mb-2 text-xs text-slate-600">配下のコンタクト・案件・契約・アクティビティ・ネクストアクション・履歴もすべて削除されます。</p>
                    <label className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" name="confirm" /> 削除することを確認しました</label>
                    <Button variant="danger">削除</Button>
                  </ActionForm>
                </Disclosure>
              </div>
            )}
          </Card>

          {/* 変更履歴 */}
          <Card title="ステージ変更履歴">
            {hist.length === 0 ? <Empty>履歴はまだありません</Empty> : (
              <ul className="space-y-1.5 text-xs">
                {hist.map((h) => {
                  const target = h.targetType === "Opportunity" ? opps.find((o) => o.id === h.targetId)?.name : "契約";
                  const fmt = (v: string | null) => (v && h.field === "金額" ? yen(Number(v)) : v ?? "—");
                  return (
                    <li key={h.id} className="text-slate-600">
                      <span className="tabular-nums text-slate-400">{formatDateTime(h.changedAt)}</span>{" "}
                      {target}の{h.field}：{h.before == null ? "作成" : fmt(h.before)} → <span className="font-medium text-slate-800">{fmt(h.after)}</span>
                      <span className="text-slate-400">（{h.changedBy ? userName(users, h.changedBy) : "自動"}）</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
