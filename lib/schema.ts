import {
  pgTable,
  text,
  date,
  integer,
  time,
  timestamp,
  index,
  pgEnum,
  boolean,
} from "drizzle-orm/pg-core";
export const lessonType = pgEnum("lesson_type", [
  "lecture",
  "practice",
  "lab",
  "other",
]);
export const groups = pgTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  active: boolean("active").notNull().default(true),
});
export const teachers = pgTable("teachers", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull().unique(),
});
export const lessons = pgTable(
  "lessons",
  {
    id: text("id").primaryKey(),
    date: date("date").notNull(),
    dayOfWeek: integer("day_of_week").notNull(),
    lessonNumber: integer("lesson_number").notNull(),
    timeStart: time("time_start").notNull(),
    timeEnd: time("time_end").notNull(),
    subject: text("subject").notNull(),
    lessonType: lessonType("lesson_type").notNull(),
    sourceType: text("source_type").notNull(),
    classroom: text("classroom").notNull(),
    teacherId: text("teacher_id").references(() => teachers.id),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("lessons_group_date_idx").on(t.groupId, t.date),
    index("lessons_teacher_date_idx").on(t.teacherId, t.date),
  ],
);
export const coverage = pgTable("coverage", {
  groupId: text("group_id")
    .primaryKey()
    .references(() => groups.id),
  from: date("date_from").notNull(),
  to: date("date_to").notNull(),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
});
