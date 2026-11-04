CREATE TABLE "game_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"seat" integer,
	"score" integer NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"best_hand" integer DEFAULT 0 NOT NULL,
	"counts_toward_standings" boolean DEFAULT true NOT NULL,
	CONSTRAINT "game_results_game_id_player_id_unique" UNIQUE("game_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" serial PRIMARY KEY NOT NULL,
	"played_on" date NOT NULL,
	"entered_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"tile" text,
	"avatar_url" text,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "players_first_name_unique" UNIQUE("first_name")
);
--> statement-breakpoint
ALTER TABLE "game_results" ADD CONSTRAINT "game_results_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_results" ADD CONSTRAINT "game_results_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_entered_by_players_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;