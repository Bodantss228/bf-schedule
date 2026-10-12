import { catalog } from "@/lib/store";
import { unavailable } from "@/lib/api";
export const runtime = "nodejs";
export async function GET() {
  try {
    return Response.json(await catalog(), {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    return unavailable(error);
  }
}
