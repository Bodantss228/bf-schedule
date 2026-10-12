import { catalog, schedule } from "@/lib/store";
import { calendar } from "@/lib/ical";
import { today, monday, addDays } from "@/lib/dates";
import { unavailable } from "@/lib/api";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const mode = q.get("mode");
  const id = q.get("id");
  if (
    (mode !== "group" && mode !== "teacher") ||
    !id ||
    !/^[a-f0-9]{24}$/.test(id)
  )
    return Response.json({ error: "Укажите mode и id" }, { status: 400 });
  try {
    const c = await catalog();
    const entity = (mode === "group" ? c.groups : c.teachers).find(
      (e) => e.id === id,
    );
    if (!entity) return Response.json({ error: "Не найдено" }, { status: 404 });
    const from = addDays(monday(today()), -7);
    const data = await schedule(mode, id, from, addDays(from, 34));
    // An incomplete feed could make a subscribed calendar delete valid events.
    if (!data.covered)
      return Response.json(
        { error: "Первичная синхронизация ещё не завершена" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    return new Response(calendar(entity.name, data.lessons), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="schedule.ics"',
        "Cache-Control": "public, s-maxage=300",
      },
    });
  } catch (error) {
    return unavailable(error);
  }
}
