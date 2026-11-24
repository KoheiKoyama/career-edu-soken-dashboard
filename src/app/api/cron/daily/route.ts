import { NextResponse } from "next/server";
import { runDailyJobs } from "@/lib/domain";

// Vercel Cron から毎朝6時（日本時間）に呼ばれる。vercel.json を参照
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runDailyJobs();
  return NextResponse.json(result);
}
