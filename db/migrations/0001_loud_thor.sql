CREATE TABLE "contact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"ig_id" text NOT NULL,
	"username" text,
	"is_follower" boolean,
	"follower_checked_at" timestamp with time zone,
	"opted_in_recurring" boolean DEFAULT false NOT NULL,
	"opted_in_at" timestamp with time zone,
	"last_interaction_at" timestamp with time zone,
	"messaging_window_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_tag" (
	"contact_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "automation" ADD COLUMN "require_follow" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "automation" ADD COLUMN "opener_text" text;--> statement-breakpoint
ALTER TABLE "automation" ADD COLUMN "follow_button_label" text DEFAULT 'Já sigo ✅' NOT NULL;--> statement-breakpoint
ALTER TABLE "automation" ADD COLUMN "not_follower_text" text;--> statement-breakpoint
ALTER TABLE "automation" ADD COLUMN "link_button_label" text;--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_tag" ADD CONSTRAINT "contact_tag_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_tag" ADD CONSTRAINT "contact_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag" ADD CONSTRAINT "tag_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contact_account_ig_idx" ON "contact" USING btree ("account_id","ig_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_tag_pk_idx" ON "contact_tag" USING btree ("contact_id","tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tag_account_name_idx" ON "tag" USING btree ("account_id","name");