/**
 * Vercel Cron 엔드포인트 (vercel.json: 매일 06:53 KST = 21:53 UTC).
 * Authorization: Bearer <CRON_SECRET> 헤더를 검사하고,
 * 통과하면 checkWatchPrices와 동일한 핵심 로직을 scheduled 모드로 실행합니다.
 */
import { runWatchPriceCheck } from "@/lib/watch-check";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = req.headers.get("authorization") ?? "";
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runWatchPriceCheck({ scheduled: true });
  return Response.json(result);
}
