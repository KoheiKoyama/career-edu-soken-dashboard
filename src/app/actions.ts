"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  accounts,
  activities,
  contacts,
  engagements,
  nextActions,
  opportunities,
  targets,
  users,
} from "@/db/schema";
import { requireEditor } from "@/lib/session";
import { todayJST } from "@/lib/dates";
import {
  completeNextAction as completeNA,
  createOpportunity as createOpp,
  reopenNextAction as reopenNA,
  runDailyJobs,
  updateEngagement as updateEng,
  updateOpportunity as updateOpp,
  type OpportunityInput,
} from "@/lib/domain";
import { OPP_STAGES, PROBABILITIES, type OppStage } from "@/lib/options";

// ---------- エラーを画面に返すためのラッパー ----------
export type ActionResult = { error?: string; ok?: boolean };

async function guard(fn: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e); // redirect() などはそのまま投げ直す
    console.error(e);
    return { error: e instanceof Error ? e.message : "エラーが発生しました" };
  }
}

// ---------- FormData helpers ----------
const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" ? v.trim() : "";
};
const opt = (f: FormData, k: string) => str(f, k) || null;
const req = (f: FormData, k: string, label: string) => {
  const v = str(f, k);
  if (!v) throw new Error(`${label}を入力してください`);
  return v;
};
const int = (f: FormData, k: string, label: string) => {
  const v = Number(str(f, k).replace(/[,，]/g, ""));
  if (!Number.isFinite(v)) throw new Error(`${label}は数値で入力してください`);
  return Math.round(v);
};
const optInt = (f: FormData, k: string) => {
  const s = str(f, k).replace(/[,，]/g, "");
  if (!s) return null;
  const v = Number(s);
  return Number.isFinite(v) ? Math.round(v) : null;
};
const bool = (f: FormData, k: string) => f.get(k) === "on" || f.get(k) === "true";

function refresh(accountId?: string) {
  revalidatePath("/", "layout");
  if (accountId) revalidatePath(`/accounts/${accountId}`);
}

// ---------- アカウント ----------
function accountValues(f: FormData) {
  return {
    name: req(f, "name", "学校名"),
    prefecture: req(f, "prefecture", "都道府県"),
    city: opt(f, "city"),
    schoolType: req(f, "schoolType", "学校種別"),
    establishment: req(f, "establishment", "設置区分"),
    courseType: opt(f, "courseType"),
    studentCount: optInt(f, "studentCount"),
    ownerId: opt(f, "ownerId"),
    address: opt(f, "address"),
    phone: opt(f, "phone"),
    website: opt(f, "website"),
    memo: opt(f, "memo"),
  };
}

export async function createAccount(f: FormData) {
  return guard(async () => {
    const me = await requireEditor();
    const [a] = await db
      .insert(accounts)
      .values({ ...accountValues(f), createdBy: me.id, updatedBy: me.id })
      .returning();
    refresh();
    redirect(`/accounts/${a.id}`);
  });
}

export async function updateAccount(id: string, f: FormData) {
  return guard(async () => {
    const me = await requireEditor();
    await db
      .update(accounts)
      .set({ ...accountValues(f), updatedAt: new Date(), updatedBy: me.id })
      .where(eq(accounts.id, id));
    refresh(id);
  });
}

export async function updateFocus(id: string, f: FormData) {
  return guard(async () => {
    const me = await requireEditor();
    const [prev] = await db.select().from(accounts).where(eq(accounts.id, id));
    const focus = bool(f, "focus");
    const turnedOn = focus && !prev.focus;
    await db
      .update(accounts)
      .set({
        focus,
        focusComment: opt(f, "focusComment"),
        focusDue: opt(f, "focusDue"),
        focusSetBy: focus ? (turnedOn ? me.id : prev.focusSetBy) : null,
        focusSetOn: focus ? (turnedOn ? todayJST() : prev.focusSetOn) : null,
        updatedAt: new Date(),
        updatedBy: me.id,
      })
      .where(eq(accounts.id, id));
    refresh(id);
  });
}

export async function deleteAccount(id: string, f: FormData) {
  return guard(async () => {
    await requireEditor();
    if (!bool(f, "confirm")) throw new Error("削除の確認にチェックを入れてください");
    // 子データは外部キーの cascade で消える（履歴・活動・案件・契約を含む）
    await db.delete(engagements).where(eq(engagements.accountId, id));
    await db.delete(opportunities).where(eq(opportunities.accountId, id));
    await db.delete(accounts).where(eq(accounts.id, id));
    refresh();
    redirect("/");
  });
}

// ---------- コンタクト ----------
function contactValues(f: FormData) {
  return {
    name: req(f, "name", "氏名"),
    roleType: req(f, "roleType", "役職区分"),
    roleDetail: opt(f, "roleDetail"),
    email: opt(f, "email"),
    phone: opt(f, "phone"),
    isPrimary: bool(f, "isPrimary"),
    status: str(f, "status") || "在籍",
    memo: opt(f, "memo"),
  };
}

async function clearOtherPrimary(accountId: string, keepId?: string) {
  const rows = await db.select().from(contacts).where(and(eq(contacts.accountId, accountId), eq(contacts.isPrimary, true)));
  for (const r of rows) if (r.id !== keepId) await db.update(contacts).set({ isPrimary: false }).where(eq(contacts.id, r.id));
}

export async function createContact(accountId: string, f: FormData) {
  return guard(async () => {
    const me = await requireEditor();
    const v = contactValues(f);
    const [c] = await db.insert(contacts).values({ ...v, accountId, createdBy: me.id, updatedBy: me.id }).returning();
    if (v.isPrimary) await clearOtherPrimary(accountId, c.id);
    refresh(accountId);
  });
}

export async function updateContact(id: string, accountId: string, f: FormData) {
  return guard(async () => {
    const me = await requireEditor();
    const v = contactValues(f);
    await db.update(contacts).set({ ...v, updatedAt: new Date(), updatedBy: me.id }).where(eq(contacts.id, id));
    if (v.isPrimary) await clearOtherPrimary(accountId, id);
    refresh(accountId);
  });
}

export async function deleteContact(id: string, accountId: string) {
  return guard(async () => {
    await requireEditor();
    await db.delete(contacts).where(eq(contacts.id, id));
    refresh(accountId);
  });
}

// ---------- Opportunity ----------
function oppValues(accountId: string, f: FormData): OpportunityInput {
  const stage = req(f, "stage", "ステージ") as OppStage;
  if (!OPP_STAGES.includes(stage)) throw new Error("ステージが不正です");
  const probability = int(f, "probability", "確度");
  if (!(PROBABILITIES as readonly number[]).includes(probability) && probability !== 100 && probability !== 0)
    throw new Error("確度が不正です");
  const lostReason = opt(f, "lostReason");
  if ((stage === "失注" || stage === "保留") && !lostReason)
    throw new Error("失注・保留のときは理由を入力してください");
  return {
    accountId,
    name: req(f, "name", "案件名"),
    type: req(f, "type", "種別"),
    stage,
    probability,
    seats: int(f, "seats", "利用人数"),
    unitPrice: int(f, "unitPrice", "単価"),
    months: int(f, "months", "契約月数"),
    expectedCloseDate: req(f, "expectedCloseDate", "受注予定日"),
    expectedStartDate: req(f, "expectedStartDate", "契約開始予定日"),
    ownerId: opt(f, "ownerId"),
    sourceEngagementId: opt(f, "sourceEngagementId"),
    lostReason,
    memo: opt(f, "memo"),
  };
}

export async function createOpportunity(accountId: string, f: FormData) {
  return guard(async () => {
    const me = await requireEditor();
    await createOpp(oppValues(accountId, f), me.id);
    refresh(accountId);
  });
}

export async function updateOpportunity(id: string, accountId: string, f: FormData) {
  return guard(async () => {
    const me = await requireEditor();
    await updateOpp(id, oppValues(accountId, f), me.id);
    refresh(accountId);
  });
}

/** パイプライン画面からのステージ変更 */
export async function changeOppStage(id: string, f: FormData) {
  return guard(async () => {
    const me = await requireEditor();
    const [o] = await db.select().from(opportunities).where(eq(opportunities.id, id));
    if (!o) return;
    const stage = str(f, "stage") as OppStage;
    if (!OPP_STAGES.includes(stage) || stage === o.stage) return;
    if ((stage === "失注" || stage === "保留") && !o.lostReason) {
      // 理由が未入力なら詳細画面で入力してもらう
      redirect(`/accounts/${o.accountId}?edit=${o.id}&stage=${encodeURIComponent(stage)}#opp-${o.id}`);
    }
    const probability = stage === "受注" || stage === "失注" ? o.probability : o.probability === 100 || o.probability === 0 ? 30 : o.probability;
    await updateOpp(
      id,
      {
        accountId: o.accountId,
        name: o.name,
        type: o.type,
        stage,
        probability,
        seats: o.seats,
        unitPrice: o.unitPrice,
        months: o.months,
        expectedCloseDate: o.expectedCloseDate,
        expectedStartDate: o.expectedStartDate,
        ownerId: o.ownerId,
        sourceEngagementId: o.sourceEngagementId,
        lostReason: o.lostReason,
        memo: o.memo,
      },
      me.id,
    );
    refresh(o.accountId);
  });
}

export async function deleteOpportunity(id: string, accountId: string) {
  return guard(async () => {
    await requireEditor();
    const eng = await db.select().from(engagements).where(eq(engagements.opportunityId, id));
    if (eng.length) throw new Error("契約（Engagement）がある案件は削除できません");
    await db.delete(opportunities).where(eq(opportunities.id, id));
    refresh(accountId);
  });
}

// ---------- Engagement ----------
export async function updateEngagement(id: string, accountId: string, f: FormData) {
  return guard(async () => {
    const me = await requireEditor();
    await updateEng(
      id,
      {
        status: req(f, "status", "ステータス"),
        seats: int(f, "seats", "契約人数"),
        unitPrice: int(f, "unitPrice", "単価"),
        months: int(f, "months", "契約月数"),
        startDate: req(f, "startDate", "契約開始日"),
        endDate: opt(f, "endDate"),
        activeUsers: optInt(f, "activeUsers"),
        ownerId: opt(f, "ownerId"),
        churnReason: opt(f, "churnReason"),
        memo: opt(f, "memo"),
      },
      me.id,
    );
    refresh(accountId);
  });
}

// ---------- アクティビティ ----------
function relatedIds(f: FormData) {
  const rel = str(f, "related"); // "opp:<id>" | "eng:<id>" | ""
  return {
    opportunityId: rel.startsWith("opp:") ? rel.slice(4) : null,
    engagementId: rel.startsWith("eng:") ? rel.slice(4) : null,
  };
}

export async function createActivity(accountId: string, f: FormData) {
  return guard(async () => {
    const me = await requireEditor();
    await db.insert(activities).values({
      accountId,
      ...relatedIds(f),
      contactIds: f.getAll("contactIds").filter((v): v is string => typeof v === "string" && !!v),
      type: req(f, "type", "種別"),
      date: req(f, "date", "実施日"),
      performedBy: opt(f, "performedBy") ?? me.id,
      title: req(f, "title", "件名"),
      body: opt(f, "body"),
      createdBy: me.id,
      updatedBy: me.id,
    });
    refresh(accountId);
  });
}

export async function deleteActivity(id: string, accountId: string) {
  return guard(async () => {
    await requireEditor();
    await db.delete(activities).where(eq(activities.id, id));
    refresh(accountId);
  });
}

// ---------- ネクストアクション ----------
export async function createNextAction(accountId: string, f: FormData) {
  return guard(async () => {
    const me = await requireEditor();
    await db.insert(nextActions).values({
      accountId,
      ...relatedIds(f),
      content: req(f, "content", "内容"),
      ownerId: opt(f, "ownerId") ?? me.id,
      dueDate: req(f, "dueDate", "期日"),
      createdBy: me.id,
      updatedBy: me.id,
    });
    refresh(accountId);
  });
}

export async function updateNextAction(id: string, accountId: string, f: FormData) {
  return guard(async () => {
    const me = await requireEditor();
    await db
      .update(nextActions)
      .set({
        ...relatedIds(f),
        content: req(f, "content", "内容"),
        ownerId: opt(f, "ownerId"),
        dueDate: req(f, "dueDate", "期日"),
        updatedAt: new Date(),
        updatedBy: me.id,
      })
      .where(eq(nextActions.id, id));
    refresh(accountId);
  });
}

export async function completeNextAction(id: string, accountId: string) {
  return guard(async () => {
    const me = await requireEditor();
    await completeNA(id, me.id);
    refresh(accountId);
  });
}

export async function reopenNextAction(id: string, accountId: string) {
  return guard(async () => {
    const me = await requireEditor();
    await reopenNA(id, me.id);
    refresh(accountId);
  });
}

export async function deleteNextAction(id: string, accountId: string) {
  return guard(async () => {
    await requireEditor();
    await db.delete(nextActions).where(eq(nextActions.id, id));
    refresh(accountId);
  });
}

// ---------- 設定 ----------
export async function upsertUser(f: FormData) {
  return guard(async () => {
    const me = await requireEditor();
    const id = opt(f, "id");
    const values = {
      name: req(f, "name", "氏名"),
      email: req(f, "email", "メールアドレス").toLowerCase(),
      role: req(f, "role", "権限"),
      active: bool(f, "active"),
    };
    if (id === me.id && (values.role !== "編集" || !values.active))
      throw new Error("自分自身の編集権限は外せません");
    if (id) await db.update(users).set({ ...values, updatedAt: new Date(), updatedBy: me.id }).where(eq(users.id, id));
    else await db.insert(users).values({ ...values, createdBy: me.id, updatedBy: me.id });
    refresh();
  });
}

export async function upsertTarget(f: FormData) {
  return guard(async () => {
    const me = await requireEditor();
    const fiscalYear = int(f, "fiscalYear", "年度");
    const values = {
      fiscalYear,
      targetSeats: int(f, "targetSeats", "目標契約人数"),
      targetAmount: optInt(f, "targetAmount"),
    };
    await db
      .insert(targets)
      .values({ ...values, createdBy: me.id, updatedBy: me.id })
      .onConflictDoUpdate({ target: targets.fiscalYear, set: { ...values, updatedAt: new Date(), updatedBy: me.id } });
    refresh();
  });
}

export async function runJobsNow() {
  return guard(async () => {
    await requireEditor();
    await runDailyJobs();
    refresh();
  });
}
