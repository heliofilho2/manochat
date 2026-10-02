CREATE TABLE "bio_view" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"source" text NOT NULL,
	"device" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "link_click" ADD COLUMN "device" text;--> statement-breakpoint
ALTER TABLE "bio_view" ADD CONSTRAINT "bio_view_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bio_view_account_time_idx" ON "bio_view" USING btree ("account_id","created_at");