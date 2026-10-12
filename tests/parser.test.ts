import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseCatalog,
  parseReport,
  entityId,
  encodeForm,
  fetchSource,
} from "../lib/parser";
import { calendar, fold } from "../lib/ical";
import { monday, addDays, today, lessonInstant, validDate } from "../lib/dates";
import { queryParams } from "../lib/api";
import { mergeTeacherPhysicalEducation } from "../lib/store";

const group = { id: entityId("group", "ПОВТ-24д"), name: "ПОВТ-24д" };
const form =
  '<select name="Name1"><option selected>ПОВТ-24д</option><option>Измайлова Елена Владимировна</option></select><input name="ctl_dateFrom" value="12.10.2026"><input name="ctl_dateTo" value="25.10.2026">';
const header =
  '<tr class="reportheader">' +
  [
    "Дата_",
    "Начало",
    "Окончание",
    "Пара",
    "Группа",
    "Дисциплина",
    "Тип",
    "Ауд",
    "Преподаватель",
  ]
    .map((c) => `<td>${c}</td>`)
    .join("") +
  "</tr>";
const row =
  '<tr class="reportitem">' +
  [
    "12.10.26 (Понедельник)",
    " 8.30",
    "10.00",
    "1",
    "ПОВТ-24д",
    " Администрирование\n опер. систем ",
    "ПЗ",
    "31",
    "Измайлова Елена Владимировна",
  ]
    .map((c) => `<td>${c}</td>`)
    .join("") +
  "</tr>";
const html = form + "<table>" + header + row + "</table>";
const parse = (value: string) =>
  parseReport(value, group, "2026-10-12", "2026-10-25");
test("Реальный формат ASP: кодировка, каталог, дата, время и тип", () => {
  assert.equal(parseCatalog(html).groups[0].name, group.name);
  assert.equal(
    encodeForm({ Name1: "ПОВТ-24д" }),
    "%4e%61%6d%65%31=%cf%ce%c2%d2%2d%32%34%e4",
  );
  const l = parse(html).lessons[0];
  assert.equal(l.date, "2026-10-12");
  assert.equal(l.timeStart, "08:30");
  assert.equal(l.lessonType, "practice");
  assert.equal(l.subject, "Администрирование опер. систем");
  assert.equal(l.dayOfWeek, 1);
  assert.equal(parse(html.replace("ПЗ", "Л/Р")).lessons[0].lessonType, "lab");
  assert.equal(
    parse(html.replace("<td>1</td>", "<td>0</td>")).lessons[0].lessonNumber,
    0,
  );
});
test("Дубликаты схлопываются; изменения имеют новый ID", () => {
  assert.equal(parse(html.replace(row, row + row)).lessons.length, 1);
  assert.equal(parse(html).lessons[0].id, parse(html).lessons[0].id);
  assert.notEqual(
    parse(html).lessons[0].id,
    parse(html.replace("<td>31</td>", "<td>32</td>")).lessons[0].id,
  );
});
test("Пустой валидный отчёт допускает отмену; поломанный отчёт отвергается", () => {
  assert.equal(parse(html.replace(row, "")).lessons.length, 0);
  assert.throws(() => parse(form));
  assert.throws(() => parse(html.replace("selected", "")));
  assert.throws(() =>
    parse(html.replace("12.10.26 (Понедельник)", "31.02.26 (Понедельник)")),
  );
  assert.throws(() => parse(html.replace("8.30", "25.30")));
  assert.throws(() =>
    parse(html.replace('value="25.10.2026"', 'value="26.10.2026"')),
  );
});
test("UTC+5 независимо от часового пояса браузера, переход месяца", () => {
  assert.equal(today(new Date("2026-10-11T20:00:00Z")), "2026-10-12");
  assert.equal(monday("2026-10-18"), "2026-10-12");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(
    new Date(lessonInstant("2026-10-12", "08:30")).toISOString(),
    "2026-10-12T03:30:00.000Z",
  );
  assert.equal(validDate("2026-02-31"), false);
});
test("iCal: стабильный UID, местное время, экранирование, UTF-8 folding", () => {
  const l = parse(html).lessons[0];
  const output = calendar("ПОВТ-24д", [
    {
      ...l,
      subject: "Тема; с запятой,\nновая строка",
      teacher: "Преподаватель",
      group: group.name,
    },
  ]).replace(/\r\n /g, "");
  assert.ok(output.includes("BEGIN:VTIMEZONE"));
  assert.ok(output.includes("DTSTART;TZID=Asia/Yekaterinburg:20261012T083000"));
  assert.ok(!output.includes("DTSTART:20261012T033000Z"));
  assert.ok(output.includes(`UID:${l.id}@bf-schedule`));
  assert.ok(output.includes("Тема\\; с запятой\\,\\nновая строка"));
  assert.ok(output.endsWith("END:VCALENDAR\r\n"));
  const long = "SUMMARY:" + "Я".repeat(100);
  const folded = fold(long);
  assert.equal(folded.replace(/\r\n /g, ""), long);
  assert.ok(
    folded.split("\r\n").every((line) => Buffer.byteLength(line) <= 75),
  );
});
test("у преподавателя объединяется только одинаковая физкультура разных групп", () => {
  const lesson = {
    ...parse(html).lessons[0],
    subject: "Прикладная физическая культура",
    classroom: "Спортзал",
    teacher: "Преподаватель",
    group: "ПОВТ-24д",
  };
  const second = {
    ...lesson,
    id: "second-lesson",
    groupId: "second-group",
    group: "ТМО-24д",
  };
  const merged = mergeTeacherPhysicalEducation([lesson, second]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].group, "ПОВТ-24д, ТМО-24д");
  assert.equal(
    mergeTeacherPhysicalEducation([
      { ...lesson, subject: "Социология" },
      { ...second, subject: "Социология" },
    ]).length,
    2,
  );
});
test("API отвергает неверные даты, режимы и огромные периоды", () => {
  const base = `http://localhost/api/schedule?mode=group&id=${group.id}&from=2026-10-12&to=2026-10-18`;
  assert.equal(queryParams(base).id, group.id);
  assert.throws(() => queryParams(base.replace("mode=group", "mode=all")));
  assert.throws(() => queryParams(base.replace("2026-10-12", "2026-02-31")));
  assert.throws(() => queryParams(base.replace("2026-10-18", "2027-10-18")));
});
test("Повтор запроса после HTTP 503, корректное чтение Windows-1251", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls++;
      return calls === 1
        ? new Response("unavailable", { status: 503 })
        : new Response(
            new Uint8Array([0xcf, 0xee, 0xe2, 0xf2, ...Array(120).fill(32)]),
          );
    };
    assert.ok((await fetchSource("/RepRasp.asp", {}, 2)).startsWith("Повт"));
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
  }
});
