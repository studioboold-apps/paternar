CREATE TABLE "plan_limits" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"free_chat_messages_per_week" integer DEFAULT 10 NOT NULL,
	"free_max_children" integer DEFAULT 1 NOT NULL,
	"subscriber_revenue_cents_brl" integer DEFAULT 1990 NOT NULL,
	"ai_share_of_revenue_pct" integer DEFAULT 30 NOT NULL,
	"usd_brl_rate_cents" integer DEFAULT 550 NOT NULL,
	"individual_cap_micro_usd" integer DEFAULT 5000000 NOT NULL,
	"warn_at_pct" integer DEFAULT 80 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(120)
);
