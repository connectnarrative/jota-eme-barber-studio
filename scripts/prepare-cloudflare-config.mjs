import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const configPath = resolve("dist/server/wrangler.json");
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID?.trim();
const databaseName =
  process.env.CLOUDFLARE_D1_DATABASE_NAME?.trim() || "jota-eme-bookings";
const workerName =
  process.env.CLOUDFLARE_WORKER_NAME?.trim() || "jota-eme-barber-studio";

if (!databaseId) {
  throw new Error(
    "CLOUDFLARE_D1_DATABASE_ID is required. Create the D1 database in Cloudflare, then add its database ID to the Worker build environment variables."
  );
}

const config = JSON.parse(await readFile(configPath, "utf8"));
config.name = workerName;
config.topLevelName = workerName;
config.d1_databases = [
  {
    binding: "DB",
    database_name: databaseName,
    database_id: databaseId,
  },
];

await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Prepared ${workerName} for Cloudflare D1 database ${databaseName}.`);
