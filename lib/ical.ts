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
function localStamp(date: string, time: string) {
  return `${date.replace(/-/g, "")}T${time.slice(0, 5).replace(":", "")}00`;
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
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Yekaterinburg",
    "X-LIC-LOCATION:Asia/Yekaterinburg",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0500",
    "TZOFFSETTO:+0500",
    "TZNAME:+05",
    "DTSTART:19700101T000000",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];
  for (const l of lessons)
    lines.push(
      "BEGIN:VEVENT",
      `UID:${l.id}@bf-schedule`,
      `DTSTAMP:${stamp(Date.parse(l.updatedAt))}`,
      `LAST-MODIFIED:${stamp(Date.parse(l.updatedAt))}`,
      `DTSTART;TZID=Asia/Yekaterinburg:${localStamp(l.date, l.timeStart)}`,
      `DTEND;TZID=Asia/Yekaterinburg:${localStamp(l.date, l.timeEnd)}`,
      `SUMMARY:${escapeIcal(l.subject)}`,
      `LOCATION:${escapeIcal(l.classroom)}`,
      `DESCRIPTION:${escapeIcal(`${l.group} · ${l.teacher} · ${l.sourceType}`)}`,
      "END:VEVENT",
    );
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
