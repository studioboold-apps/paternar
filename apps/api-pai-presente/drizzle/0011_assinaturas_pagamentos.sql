CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provider" varchar(32) NOT NULL,
	"external_id" varchar(120) NOT NULL,
	"type" varchar(32) NOT NULL,
	"provider_event_type" varchar(120) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"subscription_id" uuid,
	"user_id" uuid,
	"customer_email" varchar(255),
	"offer_code" varchar(120),
	"transaction_id" varchar(120),
	"amount_cents" integer,
	"currency" varchar(3),
	CONSTRAINT "payment_events_provider_external_id_key" UNIQUE("provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid,
	"provider" varchar(32) NOT NULL,
	"external_id" varchar(120) NOT NULL,
	"customer_email" varchar(255),
	"plan_code" varchar(32) NOT NULL,
	"offer_code" varchar(120),
	"status" varchar(32) NOT NULL,
	"period_ends_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"last_event_at" timestamp with time zone NOT NULL,
	CONSTRAINT "subscriptions_provider_external_id_key" UNIQUE("provider","external_id")
);
--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_events_created_at_idx" ON "payment_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "payment_events_subscription_id_idx" ON "payment_events" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_customer_email_idx" ON "subscriptions" USING btree (lower("customer_email"));--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");