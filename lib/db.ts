import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";

// Vercel 서버리스 환경에서도 동작하는 node-postgres 풀.
// Neon / Supabase / Vercel Postgres 모두 DATABASE_URL 하나로 연결됩니다.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});

export const db = drizzle(pool, { schema });
export type Db = typeof db;
export { schema };
