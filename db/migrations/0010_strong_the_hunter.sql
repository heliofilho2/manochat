ALTER TABLE "flow" ADD COLUMN "trigger_kind" text DEFAULT 'comment' NOT NULL;--> statement-breakpoint
CREATE INDEX "flow_run_contact_idx" ON "flow_run" USING btree ("account_id","ig_id","status");