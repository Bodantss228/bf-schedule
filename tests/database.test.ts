import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { applyReport } from "../lib/sync-group";
import * as schema from "../lib/schema";
import type { Lesson } from "../lib/types";

test("PostgreSQL: повтор, замена, отмена и откат транзакции без потери других групп", async () => {
  const engine = new PGlite();
  try {
    const db = drizzle(engine);
    await migrate(db, { migrationsFolder: "drizzle" });
    await db.insert(schema.groups).values([
      { id: "g1", name: "ПОВТ-24д" },
      { id: "g2", name: "ТМО-24д" },
    ]);
    const original: Lesson = {
      id: "original",
      date: "2026-10-12",
      dayOfWeek: 1,
      lessonNumber: 1,
      timeStart: "08:30",
      timeEnd: "10:00",
      subject: "Предмет",
      lessonType: "practice",
      sourceType: "ПЗ",
      classroom: "31",
      groupId: "g1",
      teacherId: null,
      updatedAt: "2026-10-12T00:00:00Z",
    };
    const stamp = {
      groupId: "g1",
      from: "2026-10-12",
      to: "2026-10-18",
      updatedAt: "2026-10-12T01:00:00Z",
    };
    await db.insert(schema.lessons).values([
      { ...original, id: "other-group", groupId: "g2" },
      { ...original, id: "outside-window", date: "2026-10-01" },
    ]);
    await db.transaction((tx) =>
      applyReport(tx, { teachers: [], lessons: [original] }, stamp),
    );
    await db.transaction((tx) =>
      applyReport(
        tx,
        {
          teachers: [],
          lessons: [{ ...original, updatedAt: "2026-10-12T02:00:00Z" }],
        },
        { ...stamp, updatedAt: "2026-10-12T03:00:00Z" },
      ),
    );
    let rows = await db.select().from(schema.lessons);
    assert.equal(rows.length, 3);
    assert.equal(
      Date.parse(rows.find((r) => r.id === original.id)!.updatedAt),
      Date.parse(original.updatedAt),
    );
    assert.equal(
      Date.parse((await db.select().from(schema.coverage))[0].updatedAt),
      Date.parse("2026-10-12T03:00:00Z"),
    );
    const changed = { ...original, id: "changed", classroom: "32" };
    await db.transaction((tx) =>
      applyReport(tx, { teachers: [], lessons: [changed] }, stamp),
    );
    rows = await db.select().from(schema.lessons);
    assert.equal(
      rows.some((r) => r.id === "original"),
      false,
    );
    assert.equal(
      rows.some((r) => r.id === "changed"),
      true,
    );
    await assert.rejects(
      db.transaction(async (tx) => {
        await applyReport(tx, { teachers: [], lessons: [] }, stamp);
        throw new Error("simulated failure");
      }),
    );
    assert.equal(
      (await db.select().from(schema.lessons)).some((r) => r.id === "changed"),
      true,
    );
    await db.transaction((tx) =>
      applyReport(tx, { teachers: [], lessons: [] }, stamp),
    );
    rows = await db.select().from(schema.lessons);
    assert.deepEqual(rows.map((r) => r.id).sort(), [
      "other-group",
      "outside-window",
    ]);
  } finally {
    await engine.close();
  }
});
