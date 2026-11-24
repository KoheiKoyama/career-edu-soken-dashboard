// 開発・動作確認用のサンプルデータを入れる（本番DBでは実行しないこと）
// 使い方: DATABASE_URL=... npm run db:seed-demo
import { db } from "../src/db";
import { accounts, contacts, users, targets, activities, nextActions } from "../src/db/schema";
import { createOpportunity, runDailyJobs } from "../src/lib/domain";
import { addDays, addMonths, fiscalYearOf, todayJST } from "../src/lib/dates";

async function main() {
  const today = todayJST();
  const fy = fiscalYearOf(today);
  const [u1, u2, u3] = await db
    .insert(users)
    .values([
      { name: "営業A", email: "sales-a@example.com", role: "編集" },
      { name: "営業B", email: "sales-b@example.com", role: "編集" },
      { name: "営業C", email: "sales-c@example.com", role: "編集" },
      { name: "CTO", email: "cto@example.com", role: "閲覧" },
    ])
    .returning();
  await db.insert(targets).values({ fiscalYear: fy, targetSeats: 3000 });

  const schools = [
    ["サンプル第一高等学校", "東京都", "高等学校", "公立", u1],
    ["サンプル中高一貫校", "神奈川県", "中高一貫校", "私立", u2],
    ["サンプル第二中学校", "埼玉県", "中学校", "公立", u3],
    ["サンプル通信制高校", "大阪府", "高等学校", "私立", u1],
    ["サンプル第三高等学校", "愛知県", "高等学校", "公立", u2],
    ["サンプル特別支援学校", "福岡県", "特別支援学校", "公立", u3],
  ] as const;
  const accs: (typeof accounts.$inferSelect)[] = [];
  for (const [name, pref, type, est, owner] of schools) {
    const [a] = await db
      .insert(accounts)
      .values({ name, prefecture: pref, schoolType: type, establishment: est, ownerId: owner.id, studentCount: 600, courseType: name.includes("通信") ? "通信制" : "普通制" })
      .returning();
    accs.push(a);
    await db.insert(contacts).values({ accountId: a.id, name: "山田 太郎", roleType: "ICT担当", isPrimary: true });
  }

  const base = (i: number) => ({
    accountId: accs[i].id,
    ownerId: accs[i].ownerId,
    sourceEngagementId: null,
    lostReason: null,
    memo: null,
  });
  // 受注済み（今年度開始）→ Engagement 自動作成
  await createOpportunity({ ...base(0), name: `${fy}年度 全学年導入`, type: "新規", stage: "受注", probability: 90, seats: 720, unitPrice: 330, months: 12, expectedCloseDate: `${fy}-03-01`, expectedStartDate: `${fy}-04-01` }, u1.id);
  // 9月で契約が切れる短期契約 → 更新案件が自動で作られる
  await createOpportunity({ ...base(1), name: "試験導入", type: "新規", stage: "受注", probability: 90, seats: 300, unitPrice: 440, months: 6, expectedCloseDate: addMonths(today, -3), expectedStartDate: addMonths(today, -2) }, u2.id);
  await createOpportunity({ ...base(2), name: `${fy + 1}年度 導入`, type: "新規", stage: "商談済み", probability: 70, seats: 450, unitPrice: 330, months: 12, expectedCloseDate: addMonths(today, 2), expectedStartDate: `${fy + 1}-04-01` }, u3.id);
  await createOpportunity({ ...base(3), name: "今年度 後期導入", type: "新規", stage: "商談予定済み", probability: 50, seats: 800, unitPrice: 275, months: 6, expectedCloseDate: addDays(today, 20), expectedStartDate: addMonths(today, 1) }, u1.id);
  await createOpportunity({ ...base(4), name: "今年度 1学年導入", type: "新規", stage: "リード", probability: 10, seats: 240, unitPrice: 330, months: 4, expectedCloseDate: addDays(today, 40), expectedStartDate: addMonths(today, 1) }, u2.id);
  await createOpportunity({ ...base(0), name: "2学年追加", type: "アップセル", stage: "商談済み", probability: 50, seats: 480, unitPrice: 330, months: 4, expectedCloseDate: addDays(today, 10), expectedStartDate: addMonths(today, 1) }, u1.id);
  await createOpportunity({ ...base(5), name: "導入検討", type: "新規", stage: "保留", probability: 30, seats: 120, unitPrice: 330, months: 12, expectedCloseDate: addMonths(today, 4), expectedStartDate: `${fy + 1}-04-01`, lostReason: "来年度予算の確定待ち" }, u3.id);

  await db.insert(nextActions).values([
    { accountId: accs[2].id, content: "見積書を送付", ownerId: u3.id, dueDate: addDays(today, -2) },
    { accountId: accs[3].id, content: "校長同席の商談", ownerId: u1.id, dueDate: addDays(today, 5) },
  ]);
  await db.insert(activities).values({ accountId: accs[2].id, type: "訪問（商談）", date: addDays(today, -7), performedBy: u3.id, title: "初回商談", body: "ICT担当と面談。来年度の全学年導入を検討中。" });

  console.log(await runDailyJobs());
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
