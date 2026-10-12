import { load } from "cheerio";
import iconv from "iconv-lite";
import { createHash } from "node:crypto";
import { validDate, sourceDate } from "./dates";
import type { Entity, Lesson, LessonType } from "./types";
export const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
export const entityId = (kind: string, name: string) =>
  createHash("sha256")
    .update(`${kind}:${normalize(name)}`)
    .digest("hex")
    .slice(0, 24);
export function parseCatalog(html: string) {
  const $ = load(html);
  const groups: Entity[] = [];
  const teachers: Entity[] = [];
  $('select[name="Name1"] option').each((_, el) => {
    const name = normalize($(el).text());
    if (!name) return;
    const kind = /-\d{2}/.test(name) ? "group" : "teacher";
    const target = kind === "group" ? groups : teachers;
    if (!target.some((x) => x.name === name))
      target.push({ id: entityId(kind, name), name });
  });
  if (!groups.length || !teachers.length)
    throw new Error("Не распознана форма выбора групп/преподавателей");
  return { groups, teachers };
}
export function parseReport(
  html: string,
  group: Entity,
  from: string,
  to: string,
): { lessons: Lesson[]; teachers: Entity[] } {
  const $ = load(html);
  const headers = $("tr.reportheader")
    .first()
    .children("td")
    .map((_, el) => normalize($(el).text()))
    .get();
  if (
    headers.length !== 9 ||
    headers[4] !== "Группа" ||
    headers[5] !== "Дисциплина" ||
    headers[8] !== "Преподаватель"
  )
    throw new Error(
      "Структура отчёта изменилась: данные сохранены без изменений",
    );
  const selected = normalize($('select[name="Name1"] option[selected]').text());
  if (
    selected !== group.name ||
    $('input[name="ctl_dateFrom"]').attr("value") !== sourceDate(from) ||
    $('input[name="ctl_dateTo"]').attr("value") !== sourceDate(to)
  )
    throw new Error("Источник вернул отчёт для другого запроса");
  const lessons: Lesson[] = [];
  const teachers = new Map<string, Entity>();
  $("tr.reportitem").each((_, row) => {
    const c = $(row)
      .children("td")
      .map((_, el) => normalize($(el).text()))
      .get();
    if (c.length !== 9) throw new Error("Неполная строка отчёта");
    const m = c[0].match(/^(\d{2})\.(\d{2})\.(\d{4}|\d{2})(?:\s|$)/);
    if (!m) throw new Error(`Неизвестная дата: ${c[0]}`);
    const date = `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2]}-${m[1]}`;
    const parseTime = (v: string) => {
      const t = v.match(/^(\d{1,2})[.:](\d{2})$/);
      if (!t || +t[1] > 23 || +t[2] > 59)
        throw new Error(`Неизвестное время: ${v}`);
      return `${t[1].padStart(2, "0")}:${t[2]}`;
    };
    const timeStart = parseTime(c[1]);
    const timeEnd = parseTime(c[2]);
    const lessonNumber = Number(c[3]);
    if (
      !validDate(date) ||
      date < from ||
      date > to ||
      c[4] !== group.name ||
      !c[5] ||
      !Number.isInteger(lessonNumber) ||
      lessonNumber < 0 ||
      timeEnd <= timeStart
    )
      throw new Error(
        `Недопустимые данные в строке отчёта: ${JSON.stringify(c)}`,
      );
    const teacherId = c[8] ? entityId("teacher", c[8]) : null;
    if (teacherId) teachers.set(teacherId, { id: teacherId, name: c[8] });
    const type = c[6].toUpperCase();
    const lessonType: LessonType = /^(ЛК|ЛЕК|ЛЕКЦ)/.test(type)
      ? "lecture"
      : /^(ПЗ|ПР|ПРАК)/.test(type)
        ? "practice"
        : /^(Л\/Р|ЛР|ЛАБ)/.test(type)
          ? "lab"
          : "other";
    const identity = [
      date,
      timeStart,
      timeEnd,
      lessonNumber,
      group.id,
      c[5],
      c[6],
      c[7],
      teacherId,
    ];
    const id = createHash("sha256")
      .update(JSON.stringify(identity))
      .digest("hex");
    if (!lessons.some((l) => l.id === id))
      lessons.push({
        id,
        date,
        dayOfWeek: new Date(date + "T12:00:00Z").getUTCDay() || 7,
        lessonNumber,
        timeStart,
        timeEnd,
        subject: c[5],
        lessonType,
        sourceType: c[6],
        classroom: c[7],
        teacherId,
        groupId: group.id,
        updatedAt: new Date().toISOString(),
      });
  });
  return { lessons, teachers: [...teachers.values()] };
}
export function encodeForm(fields: Record<string, string>) {
  const encode = (v: string) =>
    [...iconv.encode(v, "windows-1251")]
      .map((b) => "%" + b.toString(16).padStart(2, "0"))
      .join("");
  return Object.entries(fields)
    .map(([k, v]) => `${encode(k)}=${encode(v)}`)
    .join("&");
}
export async function fetchSource(
  path: string,
  init: RequestInit = {},
  attempts = 4,
) {
  const base = process.env.SOURCE_URL || "http://raspisanie.bf.pstu.ru";
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(new URL(path, base), {
        ...init,
        signal: AbortSignal.timeout(25000),
        headers: { "User-Agent": "BF-Schedule/1.0", ...init.headers },
      });
      if (!response.ok) throw new Error(`Источник: HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 100) throw new Error("Пустой ответ источника");
      return iconv.decode(bytes, "windows-1251");
    } catch (error) {
      last = error;
      if (attempt + 1 < attempts)
        await new Promise((r) =>
          setTimeout(r, 1000 * 2 ** attempt + Math.random() * 300),
        );
    }
  }
  throw last;
}
export async function fetchReport(group: Entity, from: string, to: string) {
  const hidden = "{'U','0','0','0','0','0',''}";
  const action = [..."Сформировать"]
    .map((c) => "%u" + c.charCodeAt(0).toString(16).padStart(4, "0"))
    .join("");
  return parseReport(
    await fetchSource(`/RepRasp.asp?action=${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: encodeForm({
        ctl_dateFrom: sourceDate(from),
        ctl_dateTo: sourceDate(to),
        Name1: group.name,
        ctl_n0x1: hidden,
        ctl_n0x2: hidden,
      }),
    }),
    group,
    from,
    to,
  );
}
