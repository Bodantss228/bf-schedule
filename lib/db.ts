import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
let client: ReturnType<typeof postgres> | undefined;
export function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL не настроен");
  client ??= postgres(process.env.DATABASE_URL, {
    prepare: false,
    max: 2,
    idle_timeout: 20,
    connect_timeout: 15,
  });
  return drizzle(client, { schema });
}
export async function closeDatabase() {
  await client?.end();
  client = undefined;
}
