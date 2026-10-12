export const TIMEZONE = "Asia/Yekaterinburg";
export function today(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TIMEZONE }).format(now);
}
export function addDays(date: string, days: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function monday(date: string) {
  const day = new Date(date + "T12:00:00Z").getUTCDay();
  return addDays(date, -((day + 6) % 7));
}
export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function sourceDate(date: string) {
  return date.split("-").reverse().join(".");
}
export function lessonInstant(date: string, time: string) {
  return new Date(`${date}T${time.slice(0, 5)}:00+05:00`).getTime();
}
