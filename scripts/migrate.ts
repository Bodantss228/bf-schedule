import "../lib/env";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { database, closeDatabase } from "../lib/db";
migrate(database(), { migrationsFolder: "drizzle" })
  .then(() => console.log("Миграции применены"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDatabase);
