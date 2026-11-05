CREATE TABLE "unavailability" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"day" date NOT NULL,
	CONSTRAINT "unavailability_player_id_day_unique" UNIQUE("player_id","day")
);
--> statement-breakpoint
ALTER TABLE "unavailability" ADD CONSTRAINT "unavailability_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;