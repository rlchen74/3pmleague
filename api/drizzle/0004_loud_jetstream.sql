CREATE TABLE "hands" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"hand_number" integer NOT NULL,
	"winner_id" integer,
	"discarder_id" integer,
	"self_draw" boolean DEFAULT false NOT NULL,
	"faan" integer,
	CONSTRAINT "hands_game_id_hand_number_unique" UNIQUE("game_id","hand_number")
);
--> statement-breakpoint
ALTER TABLE "game_results" ADD COLUMN "deal_ins" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "hands" ADD CONSTRAINT "hands_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hands" ADD CONSTRAINT "hands_winner_id_players_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hands" ADD CONSTRAINT "hands_discarder_id_players_id_fk" FOREIGN KEY ("discarder_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;