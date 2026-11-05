CREATE TABLE "seasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "site_content" (
	"key" text PRIMARY KEY NOT NULL,
	"body" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "season_id" integer;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "site_content" ADD CONSTRAINT "site_content_updated_by_players_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;