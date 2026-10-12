import { catalog, schedule } from "@/lib/store";
import { queryParams, unavailable } from "@/lib/api";
export const runtime = "nodejs";
export async function GET(request: Request) {
  let q;
  try {
    q = queryParams(request.url);
  } catch {
    return Response.json(
      { error: "Укажите mode, id, from и to (YYYY-MM-DD), период до 63 дней." },
      { status: 400 },
    );
  }
  try {
    const c = await catalog();
    if (
      !(q.mode === "group" ? c.groups : c.teachers).some((e) => e.id === q.id)
    )
      return Response.json(
        { error: "Группа или преподаватель не найдены" },
        { status: 404 },
      );
    return Response.json(await schedule(q.mode, q.id, q.from, q.to), {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    return unavailable(error);
  }
}
