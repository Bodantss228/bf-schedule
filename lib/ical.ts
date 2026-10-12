import { lessonInstant } from "./dates";
import type { Schedule } from "./types";
export function escapeIcal(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}
function stamp(ms: number) {
  return new Date(ms)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}
// RFC 5545: fold by UTF-8 octets, never inside a Cyrillic codepoint.
export function fold(line: string) {
  let result = "";
  let bytes = 0;
  for (const char of line) {
    const size = Buffer.byteLength(char);
    if (bytes + size > 75) {
      result += "\r\n ";
      bytes = 1;
    }
    result += char;
    bytes += size;
  }
  return result;
}
export function calendar(name: string, lessons: Schedule["lessons"]) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BF Schedule//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcal(name)}`,
    "X-WR-TIMEZONE:Asia/Yekaterinburg",
    "REFRESH-INTERVAL;VALUE=DURATION:PT3H",
    "X-PUBLISHED-TTL:PT3H",
  ];
  for (const l of lessons)
    lines.push(
      "BEGIN:VEVENT",
      `UID:${l.id}@bf-schedule`,
      `DTSTAMP:${stamp(Date.parse(l.updatedAt))}`,
      `LAST-MODIFIED:${stamp(Date.parse(l.updatedAt))}`,
      `DTSTART:${stamp(lessonInstant(l.date, l.timeStart))}`,
      `DTEND:${stamp(lessonInstant(l.date, l.timeEnd))}`,
      `SUMMARY:${escapeIcal(l.subject)}`,
      `LOCATION:${escapeIcal(l.classroom)}`,
      `DESCRIPTION:${escapeIcal(`${l.group} · ${l.teacher} · ${l.sourceType}`)}`,
      "END:VEVENT",
    );
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
