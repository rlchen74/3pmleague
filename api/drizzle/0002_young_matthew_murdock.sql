CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"day" date NOT NULL,
	"title" text NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_players_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;