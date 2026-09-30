CREATE TABLE "link_click" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"link_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "followers_count" integer;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "followers_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "link_click" ADD CONSTRAINT "link_click_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "link_click_account_time_idx" ON "link_click" USING btree ("account_id","created_at");