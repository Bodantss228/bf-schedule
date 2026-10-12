CREATE TYPE "public"."lesson_type" AS ENUM('lecture', 'practice', 'lab', 'other');--> statement-breakpoint
CREATE TABLE "coverage" (
	"group_id" text PRIMARY KEY NOT NULL,
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "groups_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" text PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"day_of_week" integer NOT NULL,
	"lesson_number" integer NOT NULL,
	"time_start" time NOT NULL,
	"time_end" time NOT NULL,
	"subject" text NOT NULL,
	"lesson_type" "lesson_type" NOT NULL,
	"source_type" text NOT NULL,
	"classroom" text NOT NULL,
	"teacher_id" text,
	"group_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teachers" (
	"id" text PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	CONSTRAINT "teachers_full_name_unique" UNIQUE("full_name")
);
--> statement-breakpoint
ALTER TABLE "coverage" ADD CONSTRAINT "coverage_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lessons_group_date_idx" ON "lessons" USING btree ("group_id","date");--> statement-breakpoint
CREATE INDEX "lessons_teacher_date_idx" ON "lessons" USING btree ("teacher_id","date");