import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Database = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { db?: Database };

// 最初に使われたときに接続を作る。
// ビルド時（DATABASE_URL がまだない状態）にモジュールを読み込んでもエラーにしないため。
function getDb(): Database {
  if (globalForDb.db) return globalForDb.db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL が設定されていません");
  // Neon のプール接続（pgbouncer）では prepared statement を使わない
  const instance = drizzle(postgres(url, { prepare: false, max: 5 }), { schema });
  globalForDb.db = instance;
  return instance;
}

export const db = new Proxy({} as Database, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export type DB = Database;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
