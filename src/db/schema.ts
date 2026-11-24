import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  date,
  timestamp,
  bigint,
  index,
} from "drizzle-orm/pg-core";

// 全テーブル共通：ID、作成日時、作成者、更新日時、更新者
const common = {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by"),
};

export const users = pgTable("users", {
  ...common,
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("編集"), // 編集 / 閲覧
  active: boolean("active").notNull().default(true),
});

export const accounts = pgTable(
  "accounts",
  {
    ...common,
    name: text("name").notNull(), // 学校名
    prefecture: text("prefecture").notNull(),
    city: text("city"),
    schoolType: text("school_type").notNull(),
    establishment: text("establishment").notNull(), // 設置区分
    courseType: text("course_type"), // 課程（普通制/通信制）
    studentCount: integer("student_count"), // 在籍生徒数
    ownerId: uuid("owner_id").references(() => users.id),
    focus: boolean("focus").notNull().default(false),
    focusComment: text("focus_comment"),
    focusSetBy: uuid("focus_set_by").references(() => users.id),
    focusSetOn: date("focus_set_on"),
    focusDue: date("focus_due"),
    address: text("address"),
    phone: text("phone"),
    website: text("website"),
    memo: text("memo"),
  },
  (t) => [index("accounts_owner_idx").on(t.ownerId)],
);

export const contacts = pgTable(
  "contacts",
  {
    ...common,
    accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    roleType: text("role_type").notNull(), // 役職区分
    roleDetail: text("role_detail"),
    email: text("email"),
    phone: text("phone"),
    isPrimary: boolean("is_primary").notNull().default(false),
    status: text("status").notNull().default("在籍"),
    memo: text("memo"),
  },
  (t) => [index("contacts_account_idx").on(t.accountId)],
);

export const opportunities = pgTable(
  "opportunities",
  {
    ...common,
    accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(), // 新規 / 更新 / アップセル
    stage: text("stage").notNull(),
    probability: integer("probability").notNull(), // %
    seats: integer("seats").notNull(), // 利用人数
    unitPrice: integer("unit_price").notNull(), // 円/人/月（税込）
    months: integer("months").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(), // 自動：人数×単価×月数
    expectedCloseDate: date("expected_close_date").notNull(),
    expectedStartDate: date("expected_start_date").notNull(),
    fiscalYear: integer("fiscal_year").notNull(), // 自動：契約開始予定日から
    ownerId: uuid("owner_id").references(() => users.id),
    sourceEngagementId: uuid("source_engagement_id"),
    wonDate: date("won_date"),
    lostReason: text("lost_reason"),
    memo: text("memo"),
  },
  (t) => [index("opps_account_idx").on(t.accountId), index("opps_stage_idx").on(t.stage)],
);

export const engagements = pgTable(
  "engagements",
  {
    ...common,
    accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
    opportunityId: uuid("opportunity_id").references(() => opportunities.id),
    status: text("status").notNull().default("Onboarding"),
    seats: integer("seats").notNull(),
    unitPrice: integer("unit_price").notNull(),
    months: integer("months").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    fiscalYear: integer("fiscal_year").notNull(),
    activeUsers: integer("active_users"), // 実利用人数
    ownerId: uuid("owner_id").references(() => users.id),
    renewalCreated: boolean("renewal_created").notNull().default(false),
    churnReason: text("churn_reason"), // 解約（更新しなかった）理由
    memo: text("memo"),
  },
  (t) => [index("engs_account_idx").on(t.accountId)],
);

export const activities = pgTable(
  "activities",
  {
    ...common,
    accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
    opportunityId: uuid("opportunity_id"),
    engagementId: uuid("engagement_id"),
    contactIds: uuid("contact_ids").array().notNull().default([]),
    type: text("type").notNull(),
    date: date("date").notNull(),
    performedBy: uuid("performed_by").references(() => users.id),
    title: text("title").notNull(),
    body: text("body"),
    nextActionId: uuid("next_action_id"),
  },
  (t) => [index("activities_account_idx").on(t.accountId)],
);

export const nextActions = pgTable(
  "next_actions",
  {
    ...common,
    accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
    opportunityId: uuid("opportunity_id"),
    engagementId: uuid("engagement_id"),
    content: text("content").notNull(),
    ownerId: uuid("owner_id").references(() => users.id),
    dueDate: date("due_date").notNull(),
    done: boolean("done").notNull().default(false),
    doneDate: date("done_date"),
    source: text("source").notNull().default("手入力"),
  },
  (t) => [index("na_account_idx").on(t.accountId), index("na_due_idx").on(t.dueDate)],
);

export const stageHistory = pgTable(
  "stage_history",
  {
    ...common,
    accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(), // Opportunity / Engagement
    targetId: uuid("target_id").notNull(),
    field: text("field").notNull(), // ステージ / 確度 / 金額 / ステータス
    before: text("before"),
    after: text("after").notNull(),
    changedBy: uuid("changed_by"),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("history_target_idx").on(t.targetId), index("history_changed_idx").on(t.changedAt)],
);

export const targets = pgTable("targets", {
  ...common,
  fiscalYear: integer("fiscal_year").notNull().unique(),
  targetSeats: integer("target_seats").notNull(),
  targetAmount: bigint("target_amount", { mode: "number" }),
});

export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Opportunity = typeof opportunities.$inferSelect;
export type Engagement = typeof engagements.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type NextAction = typeof nextActions.$inferSelect;
export type StageHistory = typeof stageHistory.$inferSelect;
export type Target = typeof targets.$inferSelect;
