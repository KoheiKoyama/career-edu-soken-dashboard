import type { Account, Contact, Engagement, NextAction, Opportunity, User } from "@/db/schema";
import {
  ACTIVITY_TYPES,
  CONTACT_ROLES,
  CONTACT_STATUSES,
  COURSE_TYPES,
  ENG_STATUSES,
  ESTABLISHMENTS,
  OPP_STAGES,
  OPP_TYPES,
  PREFECTURES,
  PROBABILITIES,
  SCHOOL_TYPES,
} from "@/lib/options";
import { todayJST } from "@/lib/dates";
import { Button, Field, Select, inputCls } from "./ui";

const grid = "grid gap-3 sm:grid-cols-2 lg:grid-cols-4";
const userOptions = (users: User[]) => users.filter((u) => u.active).map((u) => ({ value: u.id, label: u.name }));

export function AccountFields({ a, users, me }: { a?: Account; users: User[]; me: User }) {
  return (
    <>
      <div className={grid}>
        <Field label="学校名 *"><input name="name" required defaultValue={a?.name} className={inputCls} /></Field>
        <Field label="都道府県 *"><Select name="prefecture" options={PREFECTURES} defaultValue={a?.prefecture} required blank="選択" /></Field>
        <Field label="市区町村"><input name="city" defaultValue={a?.city ?? ""} className={inputCls} /></Field>
        <Field label="担当 *"><Select name="ownerId" options={userOptions(users)} defaultValue={a?.ownerId ?? me.id} required /></Field>
        <Field label="学校種別 *"><Select name="schoolType" options={SCHOOL_TYPES} defaultValue={a?.schoolType} required blank="選択" /></Field>
        <Field label="設置区分 *"><Select name="establishment" options={ESTABLISHMENTS} defaultValue={a?.establishment} required blank="選択" /></Field>
        <Field label="課程"><Select name="courseType" options={COURSE_TYPES} defaultValue={a?.courseType} blank="—" /></Field>
        <Field label="在籍生徒数"><input name="studentCount" type="number" min={0} defaultValue={a?.studentCount ?? ""} className={inputCls} /></Field>
        <Field label="住所" wide><input name="address" defaultValue={a?.address ?? ""} className={inputCls} /></Field>
        <Field label="代表電話"><input name="phone" defaultValue={a?.phone ?? ""} className={inputCls} /></Field>
        <Field label="WebサイトURL"><input name="website" type="url" defaultValue={a?.website ?? ""} className={inputCls} /></Field>
        <Field label="メモ" wide><textarea name="memo" rows={2} defaultValue={a?.memo ?? ""} className={inputCls} /></Field>
      </div>
      <div className="mt-3"><Button>{a ? "保存" : "作成"}</Button></div>
    </>
  );
}

export function ContactFields({ c }: { c?: Contact }) {
  return (
    <>
      <div className={grid}>
        <Field label="氏名 *"><input name="name" required defaultValue={c?.name} className={inputCls} /></Field>
        <Field label="役職区分 *"><Select name="roleType" options={CONTACT_ROLES} defaultValue={c?.roleType} required blank="選択" /></Field>
        <Field label="役職詳細"><input name="roleDetail" defaultValue={c?.roleDetail ?? ""} placeholder="例：3年主任" className={inputCls} /></Field>
        <Field label="在籍状況 *"><Select name="status" options={CONTACT_STATUSES} defaultValue={c?.status ?? "在籍"} required /></Field>
        <Field label="メールアドレス"><input name="email" type="email" defaultValue={c?.email ?? ""} className={inputCls} /></Field>
        <Field label="電話番号"><input name="phone" defaultValue={c?.phone ?? ""} className={inputCls} /></Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700"><input type="checkbox" name="isPrimary" defaultChecked={c?.isPrimary} /> 主担当（窓口）</label>
        <Field label="メモ" wide><textarea name="memo" rows={2} defaultValue={c?.memo ?? ""} className={inputCls} /></Field>
      </div>
      <div className="mt-3"><Button>{c ? "保存" : "追加"}</Button></div>
    </>
  );
}

export function OpportunityFields({ o, users, me, engagements, stageOverride }: { o?: Opportunity; users: User[]; me: User; engagements: Engagement[]; stageOverride?: string }) {
  const probs = PROBABILITIES.map((p) => ({ value: String(p), label: `${p}%` }));
  const probDefault = o ? (o.probability === 100 || o.probability === 0 ? "90" : String(o.probability)) : "10";
  return (
    <>
      <div className={grid}>
        <Field label="案件名 *" wide><input name="name" required defaultValue={o?.name} placeholder="例：2027年度 全学年導入" className={inputCls} /></Field>
        <Field label="種別 *"><Select name="type" options={OPP_TYPES} defaultValue={o?.type ?? "新規"} required /></Field>
        <Field label="担当 *"><Select name="ownerId" options={userOptions(users)} defaultValue={o?.ownerId ?? me.id} required /></Field>
        <Field label="ステージ *"><Select name="stage" options={OPP_STAGES} defaultValue={stageOverride ?? o?.stage ?? "リード"} required /></Field>
        <Field label="確度 *（受注で100%、失注で0%に自動設定）"><Select name="probability" options={probs} defaultValue={probDefault} required /></Field>
        <Field label="利用人数 *"><input name="seats" type="number" min={0} required defaultValue={o?.seats} className={inputCls} /></Field>
        <Field label="単価（円/人/月・税込）*"><input name="unitPrice" type="number" min={0} required defaultValue={o?.unitPrice} className={inputCls} /></Field>
        <Field label="契約月数 *"><input name="months" type="number" min={1} required defaultValue={o?.months ?? 12} className={inputCls} /></Field>
        <Field label="受注予定日 *"><input name="expectedCloseDate" type="date" required defaultValue={o?.expectedCloseDate} className={inputCls} /></Field>
        <Field label="契約開始予定日 *（年度判定に使用）"><input name="expectedStartDate" type="date" required defaultValue={o?.expectedStartDate} className={inputCls} /></Field>
        <Field label="元Engagement（更新・アップセル時）">
          <Select name="sourceEngagementId" options={engagements.map((e) => ({ value: e.id, label: `${e.startDate}〜${e.endDate}・${e.seats}人` }))} defaultValue={o?.sourceEngagementId} blank="—" />
        </Field>
        <Field label="失注・保留理由（失注・保留のとき必須）" wide><textarea name="lostReason" rows={2} defaultValue={o?.lostReason ?? ""} className={inputCls} /></Field>
        <Field label="メモ" wide><textarea name="memo" rows={2} defaultValue={o?.memo ?? ""} className={inputCls} /></Field>
      </div>
      <p className="mt-2 text-xs text-slate-500">金額は「利用人数 × 単価 × 契約月数」で自動計算されます。ステージを受注にすると Engagement が自動で作られます。</p>
      <div className="mt-3"><Button>{o ? "保存" : "追加"}</Button></div>
    </>
  );
}

export function EngagementFields({ e, users }: { e: Engagement; users: User[] }) {
  return (
    <>
      <div className={grid}>
        <Field label="ステータス *"><Select name="status" options={ENG_STATUSES} defaultValue={e.status} required /></Field>
        <Field label="担当 *"><Select name="ownerId" options={userOptions(users)} defaultValue={e.ownerId} required /></Field>
        <Field label="契約人数 *"><input name="seats" type="number" min={0} required defaultValue={e.seats} className={inputCls} /></Field>
        <Field label="実利用人数"><input name="activeUsers" type="number" min={0} defaultValue={e.activeUsers ?? ""} className={inputCls} /></Field>
        <Field label="単価（円/人/月・税込）*"><input name="unitPrice" type="number" min={0} required defaultValue={e.unitPrice} className={inputCls} /></Field>
        <Field label="契約月数 *"><input name="months" type="number" min={1} required defaultValue={e.months} className={inputCls} /></Field>
        <Field label="契約開始日 *"><input name="startDate" type="date" required defaultValue={e.startDate} className={inputCls} /></Field>
        <Field label="契約終了日（空欄なら自動計算）"><input name="endDate" type="date" defaultValue={e.endDate} className={inputCls} /></Field>
        <Field label="解約理由（更新しなかった場合）" wide><textarea name="churnReason" rows={2} defaultValue={e.churnReason ?? ""} className={inputCls} /></Field>
        <Field label="メモ" wide><textarea name="memo" rows={2} defaultValue={e.memo ?? ""} className={inputCls} /></Field>
      </div>
      <p className="mt-2 text-xs text-slate-500">契約月数や開始日を変えた場合は、契約終了日を空欄にして保存すると再計算されます。</p>
      <div className="mt-3"><Button>保存</Button></div>
    </>
  );
}

export type RelatedOption = { value: string; label: string };

export function ActivityFields({ users, me, contacts, related }: { users: User[]; me: User; contacts: Contact[]; related: RelatedOption[] }) {
  return (
    <>
      <div className={grid}>
        <Field label="件名 *" wide><input name="title" required className={inputCls} /></Field>
        <Field label="種別 *"><Select name="type" options={ACTIVITY_TYPES} required blank="選択" /></Field>
        <Field label="実施日 *"><input name="date" type="date" required defaultValue={todayJST()} className={inputCls} /></Field>
        <Field label="実施者"><Select name="performedBy" options={userOptions(users)} defaultValue={me.id} /></Field>
        <Field label="関連案件"><Select name="related" options={related} blank="—" /></Field>
        <Field label="コンタクト（複数選択可）" wide>
          <select name="contactIds" multiple className={`${inputCls} h-20`}>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}（{c.roleType}）</option>)}
          </select>
        </Field>
        <Field label="内容" wide><textarea name="body" rows={3} className={inputCls} /></Field>
      </div>
      <div className="mt-3"><Button>記録</Button></div>
    </>
  );
}

export function NextActionFields({ n, users, me, related }: { n?: NextAction; users: User[]; me: User; related: RelatedOption[] }) {
  const rel = n?.opportunityId ? `opp:${n.opportunityId}` : n?.engagementId ? `eng:${n.engagementId}` : "";
  return (
    <>
      <div className={grid}>
        <Field label="内容 *" wide><input name="content" required defaultValue={n?.content} className={inputCls} /></Field>
        <Field label="担当 *"><Select name="ownerId" options={userOptions(users)} defaultValue={n?.ownerId ?? me.id} required /></Field>
        <Field label="期日 *"><input name="dueDate" type="date" required defaultValue={n?.dueDate} className={inputCls} /></Field>
        <Field label="関連案件"><Select name="related" options={related} defaultValue={rel} blank="—" /></Field>
      </div>
      <div className="mt-3"><Button>{n ? "保存" : "追加"}</Button></div>
    </>
  );
}
