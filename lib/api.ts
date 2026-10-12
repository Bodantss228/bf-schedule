import { validDate } from "./dates";
import type { Mode } from "./types";
export function queryParams(url: string) {
  const q = new URL(url).searchParams;
  const mode = q.get("mode");
  const id = q.get("id");
  const from = q.get("from");
  const to = q.get("to");
  if (
    (mode !== "group" && mode !== "teacher") ||
    !id ||
    !/^[a-f0-9]{24}$/.test(id) ||
    !from ||
    !to ||
    !validDate(from) ||
    !validDate(to) ||
    to < from ||
    Date.parse(to) - Date.parse(from) > 62 * 86400000
  )
    throw new Error("Некорректный запрос расписания");
  return { mode: mode as Mode, id, from, to };
}
export function unavailable(error: unknown) {
  console.error(error);
  return Response.json(
    {
      error:
        "Расписание пока недоступно. Проверьте подключение базы и первый запуск парсера.",
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
