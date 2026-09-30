CREATE TABLE "bio_config" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"theme" text DEFAULT 'papel' NOT NULL,
	"shape" text DEFAULT 'arredondado' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"photo" text,
	"show_followers" boolean DEFAULT true NOT NULL,
	"show_posts" boolean DEFAULT true NOT NULL,
	"post_layout" text DEFAULT 'grid3' NOT NULL,
	"order" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hidden" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"manual" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deletion_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"protocol" text NOT NULL,
	"ig_username" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deletion_request_protocol_unique" UNIQUE("protocol")
);
--> statement-breakpoint
ALTER TABLE "bio_config" ADD CONSTRAINT "bio_config_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;