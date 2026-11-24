CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"name" text NOT NULL,
	"prefecture" text NOT NULL,
	"city" text,
	"school_type" text NOT NULL,
	"establishment" text NOT NULL,
	"course_type" text,
	"student_count" integer,
	"owner_id" uuid,
	"focus" boolean DEFAULT false NOT NULL,
	"focus_comment" text,
	"focus_set_by" uuid,
	"focus_set_on" date,
	"focus_due" date,
	"address" text,
	"phone" text,
	"website" text,
	"memo" text
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"account_id" uuid NOT NULL,
	"opportunity_id" uuid,
	"engagement_id" uuid,
	"contact_ids" uuid[] DEFAULT '{}' NOT NULL,
	"type" text NOT NULL,
	"date" date NOT NULL,
	"performed_by" uuid,
	"title" text NOT NULL,
	"body" text,
	"next_action_id" uuid
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role_type" text NOT NULL,
	"role_detail" text,
	"email" text,
	"phone" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT '在籍' NOT NULL,
	"memo" text
);
--> statement-breakpoint
CREATE TABLE "engagements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"account_id" uuid NOT NULL,
	"opportunity_id" uuid,
	"status" text DEFAULT 'Onboarding' NOT NULL,
	"seats" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"months" integer NOT NULL,
	"amount" bigint NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"fiscal_year" integer NOT NULL,
	"active_users" integer,
	"owner_id" uuid,
	"renewal_created" boolean DEFAULT false NOT NULL,
	"churn_reason" text,
	"memo" text
);
--> statement-breakpoint
CREATE TABLE "next_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"account_id" uuid NOT NULL,
	"opportunity_id" uuid,
	"engagement_id" uuid,
	"content" text NOT NULL,
	"owner_id" uuid,
	"due_date" date NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"done_date" date,
	"source" text DEFAULT '手入力' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"stage" text NOT NULL,
	"probability" integer NOT NULL,
	"seats" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"months" integer NOT NULL,
	"amount" bigint NOT NULL,
	"expected_close_date" date NOT NULL,
	"expected_start_date" date NOT NULL,
	"fiscal_year" integer NOT NULL,
	"owner_id" uuid,
	"source_engagement_id" uuid,
	"won_date" date,
	"lost_reason" text,
	"memo" text
);
--> statement-breakpoint
CREATE TABLE "stage_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"account_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"field" text NOT NULL,
	"before" text,
	"after" text NOT NULL,
	"changed_by" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"fiscal_year" integer NOT NULL,
	"target_seats" integer NOT NULL,
	"target_amount" bigint,
	CONSTRAINT "targets_fiscal_year_unique" UNIQUE("fiscal_year")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT '編集' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_focus_set_by_users_id_fk" FOREIGN KEY ("focus_set_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagements" ADD CONSTRAINT "engagements_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagements" ADD CONSTRAINT "engagements_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagements" ADD CONSTRAINT "engagements_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "next_actions" ADD CONSTRAINT "next_actions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "next_actions" ADD CONSTRAINT "next_actions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_history" ADD CONSTRAINT "stage_history_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_owner_idx" ON "accounts" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "activities_account_idx" ON "activities" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "contacts_account_idx" ON "contacts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "engs_account_idx" ON "engagements" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "na_account_idx" ON "next_actions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "na_due_idx" ON "next_actions" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "opps_account_idx" ON "opportunities" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "opps_stage_idx" ON "opportunities" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "history_target_idx" ON "stage_history" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "history_changed_idx" ON "stage_history" USING btree ("changed_at");