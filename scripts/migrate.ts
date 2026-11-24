// Vercel のビルド時に実行され、DB のテーブルを最新の状態にする
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    console.warn("DATABASE_URL が未設定のため、マイグレーションをスキップします");
    return;
  }
  const sql = postgres(url, { max: 1 });
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  await sql.end();
  console.log("マイグレーション完了");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
