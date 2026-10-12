import "../lib/env";
import { mkdir, writeFile, rename } from "node:fs/promises";
import { lte, notInArray } from "drizzle-orm";
import { applyReport } from "../lib/sync-group";
import { database, closeDatabase } from "../lib/db";
import * as schema from "../lib/schema";
import { today, monday, addDays } from "../lib/dates";
import { fetchSource, parseCatalog, fetchReport } from "../lib/parser";
import { localSnapshot } from "../lib/store";
import type { Snapshot } from "../lib/types";

async function sync() {
  const from = addDays(monday(today()), -7);
  const to = addDays(from, 34);
  const names = parseCatalog(await fetchSource("/RepRasp.asp"));
  const db = process.env.DATABASE_URL ? database() : null;
  let snapshot: Snapshot;
  try {
    snapshot = await localSnapshot();
  } catch {
    snapshot = { groups: [], teachers: [], lessons: [], coverage: [] };
  }
  snapshot.groups = names.groups;
  snapshot.teachers = [
    ...new Map(
      [...snapshot.teachers, ...names.teachers].map((t) => [t.id, t]),
    ).values(),
  ];
  if (db) {
    await db.transaction(async (tx) => {
      await tx
        .insert(schema.groups)
        .values(names.groups)
        .onConflictDoUpdate({
          target: schema.groups.id,
          set: { active: true },
        });
      await tx
        .update(schema.groups)
        .set({ active: false })
        .where(
          notInArray(
            schema.groups.id,
            names.groups.map((g) => g.id),
          ),
        );
    });
    await db
      .insert(schema.teachers)
      .values(names.teachers.map((t) => ({ id: t.id, fullName: t.name })))
      .onConflictDoNothing();
  }
  const requested = process.env.SYNC_GROUP;
  const selected = requested
    ? names.groups.filter((g) => g.name === requested)
    : names.groups;
  if (!selected.length) throw new Error("SYNC_GROUP не найдена в источнике");
  let failed = 0;
  let consecutiveFailures = 0;
  for (const [index, group] of selected.entries()) {
    try {
      const report = await fetchReport(group, from, to);
      const stamp = {
        groupId: group.id,
        from,
        to,
        updatedAt: new Date().toISOString(),
      };
      if (db) await db.transaction((tx) => applyReport(tx, report, stamp));
      else {
        const previous = new Map(snapshot.lessons.map((l) => [l.id, l]));
        snapshot.lessons = [
          ...snapshot.lessons.filter(
            (l) => l.groupId !== group.id || l.date < from || l.date > to,
          ),
          ...report.lessons.map((l) => previous.get(l.id) || l),
        ];
        snapshot.teachers = [
          ...new Map(
            [...snapshot.teachers, ...report.teachers].map((t) => [t.id, t]),
          ).values(),
        ];
        snapshot.coverage = [
          ...snapshot.coverage.filter((c) => c.groupId !== group.id),
          stamp,
        ];
        await mkdir("data", { recursive: true });
        await writeFile("data/snapshot.tmp", JSON.stringify(snapshot));
        await rename("data/snapshot.tmp", "data/snapshot.json");
      }
      console.log(`${group.name}: ${report.lessons.length} пар`);
      consecutiveFailures = 0;
    } catch (error) {
      failed++;
      consecutiveFailures++;
      console.error(
        `${group.name}:`,
        error instanceof Error ? error.message : error,
      );
      if (consecutiveFailures >= 3) {
        const skipped = selected.length - index - 1;
        failed += skipped;
        console.error(`Три сбоя подряд: источник не нагружаем, пропущено групп: ${skipped}.`);
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  if (db)
    await db
      .delete(schema.lessons)
      .where(lte(schema.lessons.date, addDays(today(), -90)));
  if (failed)
    throw new Error(
      `Не обновлено групп: ${failed}. Предыдущие данные этих групп сохранены.`,
    );
}
sync()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDatabase);
