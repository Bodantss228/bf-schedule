import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq, gte, lte, asc } from "drizzle-orm";
import { database } from "./db";
import * as schema from "./schema";
import type { Mode, Snapshot, Schedule } from "./types";
export async function localSnapshot(): Promise<Snapshot> {
  try {
    return JSON.parse(
      await readFile(path.join(process.cwd(), "data/snapshot.json"), "utf8"),
    );
  } catch {
    throw new Error(
      "Нет базы или локального снимка. Настройте DATABASE_URL или выполните npm run sync.",
    );
  }
}
export async function catalog() {
  if (!process.env.DATABASE_URL) {
    const s = await localSnapshot();
    return { groups: s.groups, teachers: s.teachers };
  }
  const db = database();
  const [groups, teachers] = await Promise.all([
    db
      .select({ id: schema.groups.id, name: schema.groups.name })
      .from(schema.groups)
      .where(eq(schema.groups.active, true))
      .orderBy(asc(schema.groups.name)),
    db
      .select({ id: schema.teachers.id, name: schema.teachers.fullName })
      .from(schema.teachers)
      .orderBy(asc(schema.teachers.fullName)),
  ]);
  return { groups, teachers };
}
export async function schedule(
  mode: Mode,
  id: string,
  from: string,
  to: string,
): Promise<Schedule> {
  let rows: Schedule["lessons"];
  let stamps: Snapshot["coverage"];
  let groupCount: number;
  if (!process.env.DATABASE_URL) {
    const s = await localSnapshot();
    groupCount = s.groups.length;
    rows = s.lessons
      .filter(
        (l) =>
          (mode === "group" ? l.groupId === id : l.teacherId === id) &&
          s.groups.some((g) => g.id === l.groupId) &&
          l.date >= from &&
          l.date <= to,
      )
      .map((l) => ({
        ...l,
        group: s.groups.find((g) => g.id === l.groupId)?.name || "",
        teacher: s.teachers.find((t) => t.id === l.teacherId)?.name || "",
      }));
    stamps = s.coverage.filter(
      (c) =>
        (mode === "teacher" || c.groupId === id) &&
        s.groups.some((g) => g.id === c.groupId),
    );
  } else {
    const db = database();
    rows = (
      await db
        .select({
          lesson: schema.lessons,
          group: schema.groups.name,
          teacher: schema.teachers.fullName,
        })
        .from(schema.lessons)
        .innerJoin(schema.groups, eq(schema.lessons.groupId, schema.groups.id))
        .leftJoin(
          schema.teachers,
          eq(schema.lessons.teacherId, schema.teachers.id),
        )
        .where(
          and(
            eq(
              mode === "group"
                ? schema.lessons.groupId
                : schema.lessons.teacherId,
              id,
            ),
            gte(schema.lessons.date, from),
            lte(schema.lessons.date, to),
            eq(schema.groups.active, true),
          ),
        )
    ).map((r) => ({ ...r.lesson, teacher: r.teacher || "", group: r.group }));
    stamps = await db
      .select({
        groupId: schema.coverage.groupId,
        from: schema.coverage.from,
        to: schema.coverage.to,
        updatedAt: schema.coverage.updatedAt,
      })
      .from(schema.coverage)
      .innerJoin(schema.groups, eq(schema.coverage.groupId, schema.groups.id))
      .where(
        and(
          eq(schema.groups.active, true),
          mode === "group" ? eq(schema.coverage.groupId, id) : undefined,
        ),
      );
    groupCount = (
      await db
        .select({ id: schema.groups.id })
        .from(schema.groups)
        .where(eq(schema.groups.active, true))
    ).length;
  }
  const covered =
    stamps.length > 0 &&
    (mode === "group" || stamps.length === groupCount) &&
    stamps.every((c) => c.from <= from && c.to >= to);
  const updatedAt = stamps.length
    ? stamps
        .map((c) => c.updatedAt)
        .sort((a, b) => Date.parse(a) - Date.parse(b))[0]
    : null;
  return {
    lessons: rows.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.timeStart.localeCompare(b.timeStart) ||
        a.group.localeCompare(b.group),
    ),
    updatedAt,
    covered,
    stale: !updatedAt || Date.now() - Date.parse(updatedAt) > 7 * 3600000,
  };
}
