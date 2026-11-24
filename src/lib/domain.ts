// 業務ルール（自動処理）をまとめたモジュール。
// 画面のサーバーアクションと日次ジョブの両方から呼ばれる。
import { and, eq, lt, ne } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  engagements,
  nextActions,
  activities,
  opportunities,
  stageHistory,
  type Engagement,
  type Opportunity,
} from "@/db/schema";
import { addDays, addMonths, contractEndDate, fiscalYearOf, todayJST } from "./dates";
import {
  RENEWAL_DEFAULT_PROBABILITY,
  RENEWAL_LEAD_MONTHS,
  type OppStage,
} from "./options";

type Actor = string | null; // users.id（自動処理は null）

async function history(
  tx: Tx,
  p: {
    accountId: string;
    targetType: "Opportunity" | "Engagement";
    targetId: string;
    field: "ステージ" | "確度" | "金額" | "ステータス";
    before: string | null;
    after: string;
    actor: Actor;
  },
) {
  await tx.insert(stageHistory).values({
    accountId: p.accountId,
    targetType: p.targetType,
    targetId: p.targetId,
    field: p.field,
    before: p.before,
    after: p.after,
    changedBy: p.actor,
    createdBy: p.actor,
    updatedBy: p.actor,
  });
}

// ---------- Opportunity ----------

export type OpportunityInput = {
  accountId: string;
  name: string;
  type: string;
  stage: OppStage;
  probability: number;
  seats: number;
  unitPrice: number;
  months: number;
  expectedCloseDate: string;
  expectedStartDate: string;
  ownerId: string | null;
  sourceEngagementId: string | null;
  lostReason: string | null;
  memo: string | null;
};

function normalizeOpp(input: OpportunityInput) {
  let probability = input.probability;
  if (input.stage === "受注") probability = 100;
  if (input.stage === "失注") probability = 0;
  return {
    ...input,
    probability,
    amount: input.seats * input.unitPrice * input.months,
    fiscalYear: fiscalYearOf(input.expectedStartDate),
  };
}

export async function createOpportunity(input: OpportunityInput, actor: Actor) {
  return db.transaction(async (tx) => {
    const v = normalizeOpp(input);
    const [opp] = await tx
      .insert(opportunities)
      .values({
        ...v,
        wonDate: v.stage === "受注" ? todayJST() : null,
        createdBy: actor,
        updatedBy: actor,
      })
      .returning();
    await history(tx, {
      accountId: opp.accountId,
      targetType: "Opportunity",
      targetId: opp.id,
      field: "ステージ",
      before: null,
      after: opp.stage,
      actor,
    });
    if (opp.stage === "受注") await createEngagementFromOpp(tx, opp, actor);
    return opp;
  });
}

export async function updateOpportunity(id: string, input: OpportunityInput, actor: Actor) {
  return db.transaction(async (tx) => {
    const [prev] = await tx.select().from(opportunities).where(eq(opportunities.id, id));
    if (!prev) throw new Error("案件が見つかりません");
    const v = normalizeOpp(input);
    const becameWon = prev.stage !== "受注" && v.stage === "受注";
    const [opp] = await tx
      .update(opportunities)
      .set({
        ...v,
        wonDate: v.stage === "受注" ? (prev.wonDate ?? todayJST()) : null,
        updatedAt: new Date(),
        updatedBy: actor,
      })
      .where(eq(opportunities.id, id))
      .returning();

    const base = { accountId: opp.accountId, targetType: "Opportunity" as const, targetId: id, actor };
    if (prev.stage !== opp.stage)
      await history(tx, { ...base, field: "ステージ", before: prev.stage, after: opp.stage });
    if (prev.probability !== opp.probability)
      await history(tx, { ...base, field: "確度", before: `${prev.probability}%`, after: `${opp.probability}%` });
    if (prev.amount !== opp.amount)
      await history(tx, { ...base, field: "金額", before: String(prev.amount), after: String(opp.amount) });

    if (becameWon) await createEngagementFromOpp(tx, opp, actor);
    return opp;
  });
}

/** 受注したら Engagement を自動作成（同じ Opportunity から二重に作らない） */
async function createEngagementFromOpp(tx: Tx, opp: Opportunity, actor: Actor) {
  const existing = await tx
    .select({ id: engagements.id })
    .from(engagements)
    .where(eq(engagements.opportunityId, opp.id));
  if (existing.length > 0) return;
  const [eng] = await tx
    .insert(engagements)
    .values({
      accountId: opp.accountId,
      opportunityId: opp.id,
      status: "Onboarding",
      seats: opp.seats,
      unitPrice: opp.unitPrice,
      months: opp.months,
      amount: opp.amount,
      startDate: opp.expectedStartDate,
      endDate: contractEndDate(opp.expectedStartDate, opp.months),
      fiscalYear: fiscalYearOf(opp.expectedStartDate),
      ownerId: opp.ownerId,
      createdBy: actor,
      updatedBy: actor,
    })
    .returning();
  await history(tx, {
    accountId: eng.accountId,
    targetType: "Engagement",
    targetId: eng.id,
    field: "ステータス",
    before: null,
    after: eng.status,
    actor,
  });
  await maybeCreateRenewal(tx, eng, todayJST());
}

// ---------- Engagement ----------

export type EngagementInput = {
  status: string;
  seats: number;
  unitPrice: number;
  months: number;
  startDate: string;
  endDate: string | null; // 空なら自動計算
  activeUsers: number | null;
  ownerId: string | null;
  churnReason: string | null;
  memo: string | null;
};

export async function updateEngagement(id: string, input: EngagementInput, actor: Actor) {
  return db.transaction(async (tx) => {
    const [prev] = await tx.select().from(engagements).where(eq(engagements.id, id));
    if (!prev) throw new Error("契約が見つかりません");
    const endDate = input.endDate || contractEndDate(input.startDate, input.months);
    const [eng] = await tx
      .update(engagements)
      .set({
        ...input,
        endDate,
        amount: input.seats * input.unitPrice * input.months,
        fiscalYear: fiscalYearOf(input.startDate),
        updatedAt: new Date(),
        updatedBy: actor,
      })
      .where(eq(engagements.id, id))
      .returning();
    const base = { accountId: eng.accountId, targetType: "Engagement" as const, targetId: id, actor };
    if (prev.status !== eng.status)
      await history(tx, { ...base, field: "ステータス", before: prev.status, after: eng.status });
    if (prev.amount !== eng.amount)
      await history(tx, { ...base, field: "金額", before: String(prev.amount), after: String(eng.amount) });
    await maybeCreateRenewal(tx, eng, todayJST());
    return eng;
  });
}

/**
 * 契約終了日の6か月前を過ぎていて、まだ更新案件がなければ、
 * 更新 Opportunity と「更新提案の準備」ネクストアクションを作る。
 */
async function maybeCreateRenewal(tx: Tx, eng: Engagement, today: string) {
  if (eng.renewalCreated || eng.status === "契約終了") return false;
  if (eng.endDate < today) return false; // 既に終わっている契約は対象外
  const trigger = addMonths(eng.endDate, -RENEWAL_LEAD_MONTHS);
  if (today < trigger) return false;

  const start = addDays(eng.endDate, 1);
  const fy = fiscalYearOf(start);
  const [opp] = await tx
    .insert(opportunities)
    .values({
      accountId: eng.accountId,
      name: `${fy}年度 更新`,
      type: "更新",
      stage: "リード",
      probability: RENEWAL_DEFAULT_PROBABILITY,
      seats: eng.seats,
      unitPrice: eng.unitPrice,
      months: eng.months,
      amount: eng.seats * eng.unitPrice * eng.months,
      expectedCloseDate: eng.endDate,
      expectedStartDate: start,
      fiscalYear: fy,
      ownerId: eng.ownerId,
      sourceEngagementId: eng.id,
    })
    .returning();
  await history(tx, {
    accountId: eng.accountId,
    targetType: "Opportunity",
    targetId: opp.id,
    field: "ステージ",
    before: null,
    after: "リード",
    actor: null,
  });
  const due = addDays(today, 14) < eng.endDate ? addDays(today, 14) : eng.endDate;
  await tx.insert(nextActions).values({
    accountId: eng.accountId,
    opportunityId: opp.id,
    engagementId: eng.id,
    content: "更新提案の準備",
    ownerId: eng.ownerId,
    dueDate: due,
    source: "更新案件の自動作成",
  });
  await tx
    .update(engagements)
    .set({ renewalCreated: true, updatedAt: new Date() })
    .where(eq(engagements.id, eng.id));
  return true;
}

/** 日次ジョブ：契約終了日を過ぎた契約を「契約終了」にし、更新案件を作る */
export async function runDailyJobs(today = todayJST()) {
  return db.transaction(async (tx) => {
    let ended = 0;
    let renewals = 0;
    const expired = await tx
      .select()
      .from(engagements)
      .where(and(lt(engagements.endDate, today), ne(engagements.status, "契約終了")));
    for (const e of expired) {
      await tx
        .update(engagements)
        .set({ status: "契約終了", updatedAt: new Date() })
        .where(eq(engagements.id, e.id));
      await history(tx, {
        accountId: e.accountId,
        targetType: "Engagement",
        targetId: e.id,
        field: "ステータス",
        before: e.status,
        after: "契約終了",
        actor: null,
      });
      ended++;
    }
    const candidates = await tx
      .select()
      .from(engagements)
      .where(and(eq(engagements.renewalCreated, false), ne(engagements.status, "契約終了")));
    for (const e of candidates) {
      if (await maybeCreateRenewal(tx, e, today)) renewals++;
    }
    return { ended, renewals };
  });
}

// ---------- ネクストアクション ----------

/** 完了にすると同じ内容のアクティビティを作る */
export async function completeNextAction(id: string, actor: Actor) {
  return db.transaction(async (tx) => {
    const [na] = await tx.select().from(nextActions).where(eq(nextActions.id, id));
    if (!na || na.done) return;
    const today = todayJST();
    await tx
      .update(nextActions)
      .set({ done: true, doneDate: today, updatedAt: new Date(), updatedBy: actor })
      .where(eq(nextActions.id, id));
    await tx.insert(activities).values({
      accountId: na.accountId,
      opportunityId: na.opportunityId,
      engagementId: na.engagementId,
      type: "その他",
      date: today,
      performedBy: actor ?? na.ownerId,
      title: `完了：${na.content}`,
      nextActionId: na.id,
      createdBy: actor,
      updatedBy: actor,
    });
  });
}

export async function reopenNextAction(id: string, actor: Actor) {
  await db
    .update(nextActions)
    .set({ done: false, doneDate: null, updatedAt: new Date(), updatedBy: actor })
    .where(eq(nextActions.id, id));
}
