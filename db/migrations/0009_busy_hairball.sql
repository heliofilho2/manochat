CREATE TABLE "flow" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"match_mode" text DEFAULT 'exact_word' NOT NULL,
	"scope" text DEFAULT 'all_posts' NOT NULL,
	"post_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"applies_from" timestamp with time zone,
	"reply_enabled" boolean DEFAULT false NOT NULL,
	"reply_variants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"graph" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flow_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"ig_id" text NOT NULL,
	"username" text,
	"trigger_ref" text NOT NULL,
	"comment_id" text,
	"private_reply_used" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"current_node_id" text,
	"resume_at" timestamp with time zone,
	"variables" jsonb DEFAULT '{"branches":{}}'::jsonb NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "flow" ADD CONSTRAINT "flow_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_run" ADD CONSTRAINT "flow_run_flow_id_flow_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_run" ADD CONSTRAINT "flow_run_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "flow_account_status_idx" ON "flow" USING btree ("account_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "flow_run_trigger_ref_idx" ON "flow_run" USING btree ("trigger_ref");--> statement-breakpoint
CREATE INDEX "flow_run_due_idx" ON "flow_run" USING btree ("status","resume_at");--> statement-breakpoint
CREATE INDEX "flow_run_flow_time_idx" ON "flow_run" USING btree ("flow_id","created_at");