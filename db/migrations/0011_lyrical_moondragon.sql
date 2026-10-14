ALTER TABLE "contact" ADD COLUMN "fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "bot_paused_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "flow" ADD COLUMN "rerun" text DEFAULT 'always' NOT NULL;