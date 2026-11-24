import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  accounts,
  engagements,
  nextActions,
  opportunities,
  stageHistory,
  targets,
  users,
  type Account,
  type Engagement,
  type NextAction,
  type Opportunity,
  type User,
} from "@/db/schema";
import { addMonths, monthStart, todayJST } from "./dates";
import { BINARY_THRESHOLD, OPP_OPEN_STAGES, OPP_STAGES, ENG_STATUSES } from "./options";

export async function listUsers(): Promise<User[]> {
  return db.select().from(users).orderBy(asc(users.createdAt));
}

export function userName(list: User[], id: string | null | undefined): string {
  if (!id) return "—";
  return list.find((u) => u.id === id)?.name ?? "—";
}

const isOpen = (o: Opportunity) => (OPP_OPEN_STAGES as string[]).includes(o.stage);

type Sum = { count: number; amount: number; seats: number };
const sum = (rows: { amount: number; seats: number }[]): Sum => ({
  count: rows.length,
  amount: rows.reduce((a, r) => a + r.amount, 0),
  seats: rows.reduce((a, r) => a + r.seats, 0),
});

export async function loadDashboard(fy: number) {
  const today = todayJST();
  const [opps, engs, target, allUsers, hist] = await Promise.all([
    db.select().from(opportunities),
    db.select().from(engagements),
    db.select().from(targets).where(eq(targets.fiscalYear, fy)),
    listUsers(),
    db.select().from(stageHistory).orderBy(desc(stageHistory.changedAt)).limit(2000),
  ]);

  const fyOpps = opps.filter((o) => o.fiscalYear === fy);
  const won = sum(engs.filter((e) => e.fiscalYear === fy));
  const binaryRows = fyOpps.filter((o) => isOpen(o) && o.probability >= BINARY_THRESHOLD);
  const allRows = fyOpps.filter((o) => isOpen(o) || o.stage === "保留");
  const binary = sum(binaryRows);
  const all = sum(allRows);
  const firm = { amount: won.amount + binary.amount, seats: won.seats + binary.seats };
  const upsellBinary = sum(binaryRows.filter((o) => o.type === "アップセル"));
  const upsellAll = sum(allRows.filter((o) => o.type === "アップセル"));

  const targetSeats = target[0]?.targetSeats ?? null;

  const current = engs.filter((e) => e.startDate <= today && today <= e.endDate && e.status !== "契約終了");
  const currentSeats = current.reduce((a, e) => a + e.seats, 0);
  const currentActive = current.reduce((a, e) => a + (e.activeUsers ?? 0), 0);

  const byStage = OPP_STAGES.map((s) => ({ stage: s, ...sum(fyOpps.filter((o) => o.stage === s)) }));
  const byStatus = ENG_STATUSES.map((s) => ({ status: s, ...sum(engs.filter((e) => e.status === s)) }));

  const ms = monthStart(today);
  const oppById = new Map(opps.map((o) => [o.id, o]));
  const newThisMonth = sum(opps.filter((o) => todayIso(o.createdAt) >= ms));
  const wonThisMonth = sum(opps.filter((o) => o.wonDate && o.wonDate >= ms));
  const lostIds = new Set(
    hist
      .filter((h) => h.targetType === "Opportunity" && h.field === "ステージ" && h.after === "失注" && todayIso(h.changedAt) >= ms)
      .map((h) => h.targetId),
  );
  const lostThisMonth = sum([...lostIds].map((id) => oppById.get(id)).filter((o): o is Opportunity => !!o));

  const horizon = addMonths(today, 6);
  const renewals = engs
    .filter((e) => e.status !== "契約終了" && e.endDate >= today && e.endDate <= horizon)
    .sort((a, b) => a.endDate.localeCompare(b.endDate));

  return {
    today,
    won,
    binary,
    all,
    firm,
    upsellBinary,
    upsellAll,
    targetSeats,
    currentSeats,
    currentActive,
    byStage,
    byStatus,
    newThisMonth,
    wonThisMonth,
    lostThisMonth,
    renewals,
    users: allUsers,
  };
}

function todayIso(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(d);
}

export type AccountRow = Account & {
  currentStage: string;
  nextAction: NextAction | null;
  openActionCount: number;
  openAmount: number;
  needsAction: boolean;
  overdue: boolean;
  focusExpired: boolean;
};

const stageRank = (s: string) => OPP_STAGES.indexOf(s as (typeof OPP_STAGES)[number]);

export function currentStageOf(opps: Opportunity[], engs: Engagement[]): string {
  const open = opps.filter(isOpen).sort((a, b) => stageRank(b.stage) - stageRank(a.stage));
  if (open.length) return open[0].stage;
  const latestEng = [...engs].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
  if (latestEng) return latestEng.status;
  const latestOpp = [...opps].sort((a, b) => +b.updatedAt - +a.updatedAt)[0];
  return latestOpp?.stage ?? "未着手";
}

export async function loadAccountRows(): Promise<AccountRow[]> {
  const today = todayJST();
  const [accs, opps, engs, nas] = await Promise.all([
    db.select().from(accounts).orderBy(asc(accounts.name)),
    db.select().from(opportunities),
    db.select().from(engagements),
    db.select().from(nextActions).where(eq(nextActions.done, false)).orderBy(asc(nextActions.dueDate)),
  ]);
  return accs.map((a) => {
    const ao = opps.filter((o) => o.accountId === a.id);
    const ae = engs.filter((e) => e.accountId === a.id);
    const an = nas.filter((n) => n.accountId === a.id);
    const inProgress = ao.some(isOpen) || ae.some((e) => e.status === "Onboarding");
    return {
      ...a,
      currentStage: currentStageOf(ao, ae),
      nextAction: an[0] ?? null,
      openActionCount: an.length,
      openAmount: ao.filter(isOpen).reduce((s, o) => s + o.amount, 0),
      needsAction: inProgress && an.length === 0,
      overdue: an.some((n) => n.dueDate < today),
      focusExpired: a.focus && !!a.focusDue && a.focusDue < today,
    };
  });
}
