import { and, eq, gte, lte, notInArray } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import type { Entity, Lesson, Coverage } from "./types";
export async function applyReport(
  tx: Pick<PgDatabase<PgQueryResultHKT>, "insert" | "delete">,
  report: { teachers: Entity[]; lessons: Lesson[] },
  stamp: Coverage,
) {
  if (report.teachers.length)
    await tx
      .insert(schema.teachers)
      .values(report.teachers.map((t) => ({ id: t.id, fullName: t.name })))
      .onConflictDoNothing();
  if (report.lessons.length)
    await tx
      .insert(schema.lessons)
      .values(report.lessons)
      .onConflictDoNothing();
  const scope = and(
    eq(schema.lessons.groupId, stamp.groupId),
    gte(schema.lessons.date, stamp.from),
    lte(schema.lessons.date, stamp.to),
  );
  await tx.delete(schema.lessons).where(
    report.lessons.length
      ? and(
          scope,
          notInArray(
            schema.lessons.id,
            report.lessons.map((l) => l.id),
          ),
        )
      : scope,
  );
  await tx
    .insert(schema.coverage)
    .values(stamp)
    .onConflictDoUpdate({ target: schema.coverage.groupId, set: stamp });
}
