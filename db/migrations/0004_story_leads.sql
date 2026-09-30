CREATE TABLE "lead" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"automation_id" uuid,
	"ig_id" text NOT NULL,
	"username" text,
	"source" text DEFAULT 'story' NOT NULL,
	"trigger" text,
	"email" text,
	"phone" text,
	"step" text DEFAULT 'done' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "leads_webhook_url" text;--> statement-breakpoint
ALTER TABLE "automation" ADD COLUMN "kind" text DEFAULT 'comment' NOT NULL;--> statement-breakpoint
ALTER TABLE "automation" ADD COLUMN "react_heart" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "automation" ADD COLUMN "collect_email" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "automation" ADD COLUMN "collect_phone" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "automation" ADD COLUMN "email_prompt" text;--> statement-breakpoint
ALTER TABLE "automation" ADD COLUMN "phone_prompt" text;--> statement-breakpoint
ALTER TABLE "automation" ADD COLUMN "thanks_text" text;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_automation_id_automation_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."automation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_account_created_idx" ON "lead" USING btree ("account_id","created_at");