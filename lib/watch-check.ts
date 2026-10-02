/**
 * 관심 단지 시세 확인 핵심 로직.
 * checkWatchPrices 액션의 handler 로직을 분리한 것으로,
 * POST /api/checkWatchPrices 라우트와 Vercel Cron(GET /api/cron/price-check)이 공유합니다.
 */
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  AUTO_CHECK_ENABLED_KEY,
  ensureWatchRentSlice,
  ensureWatchTradeSlice,
  evaluateWatchAlerts,
  monthKeys,
  upsertWatchMonthRentSeries,
} from "@/lib/helpers";

export const watchPriceCheckRequestSchema = z.object({
  serviceKey: z.string().trim().min(10).max(500).optional(),
  watchIds: z.array(z.number().int().positive()).optional(),
  months: z.number().int().min(1).max(3).optional(),
  scheduled: z.boolean().optional(),
});

export const watchPriceCheckResponseSchema = z.object({
  status: z.enum(["ok", "needs_key", "rate_limited", "error", "skipped", "owner_only"]),
  message: z.string(),
  checked: z.number(),
  totalNewTrades: z.number(),
  totalNewRents: z.number(),
  totalAlerts: z.number(),
});

export type WatchPriceCheckResult = z.infer<typeof watchPriceCheckResponseSchema>;

/**
 * checkWatchPrices 액션 handler의 원본 로직 그대로.
 * Vercel 배포판은 소유자/뷰어 구분이 없으므로 owner_only 경로는 발생하지 않습니다.
 */
export async function runWatchPriceCheck(
  args: z.infer<typeof watchPriceCheckRequestSchema>,
): Promise<WatchPriceCheckResult> {
  const scheduled = args.scheduled ?? false;
  if (scheduled) {
    const [setting] = await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, AUTO_CHECK_ENABLED_KEY)).limit(1);
    if (setting?.value !== "1") {
      return { status: "skipped" as const, message: "자동 확인이 꺼져 있어 건너뜁니다.", checked: 0, totalNewTrades: 0, totalNewRents: 0, totalAlerts: 0 };
    }
  }
  const targets = args.watchIds === undefined
    ? await db.select().from(schema.watchItems).where(eq(schema.watchItems.active, true)).orderBy(desc(schema.watchItems.createdAt))
    : args.watchIds.length === 0
      ? []
      : await db.select().from(schema.watchItems).where(and(inArray(schema.watchItems.id, args.watchIds), eq(schema.watchItems.active, true)));
  if (targets.length === 0) {
    return { status: "ok" as const, message: "확인할 관심 단지가 없습니다.", checked: 0, totalNewTrades: 0, totalNewRents: 0, totalAlerts: 0 };
  }
  const checkedMonths = monthKeys(args.months ?? 3);
  let checked = 0;
  let totalNewTrades = 0;
  let totalNewRents = 0;
  let totalAlerts = 0;
  let firstFailure: { kind: "needs_key" | "rate_limited"; message: string } | null = null;
  for (const watch of targets) {
    let itemNewTrades = 0;
    let itemNewRents = 0;
    let itemAlerts = 0;
    let itemStatus: "ok" | "needs_key" | "rate_limited" | "error" = "ok";
    let itemMessage: string | null = null;
    for (const month of checkedMonths) {
      const slice = await ensureWatchTradeSlice(db, { lawdCd: watch.lawdCd, regionLabel: watch.regionLabel, month, serviceKey: args.serviceKey });
      if (slice.status === "ok") {
        itemNewTrades += slice.inserted;
      } else {
        itemStatus = slice.status === "not_configured" ? "needs_key" : slice.status;
        itemMessage = slice.message;
        if ((slice.status === "not_configured" || slice.status === "rate_limited") && firstFailure === null) {
          firstFailure = slice.status === "not_configured" ? { kind: "needs_key", message: slice.message } : { kind: "rate_limited", message: slice.message };
        }
        if (slice.status === "not_configured" || slice.status === "rate_limited") break;
      }
      // 전월세도 함께 확보한다. 매매는 이미 확인한 달이므로 전월세 실패가 있어도 매매 결과는 살린다.
      const rent = await ensureWatchRentSlice(db, { lawdCd: watch.lawdCd, regionLabel: watch.regionLabel, month, serviceKey: args.serviceKey });
      if (rent.status === "ok") {
        itemNewRents += rent.inserted;
      } else if (rent.status === "error") {
        itemMessage = rent.message;
      } else if ((rent.status === "not_configured" || rent.status === "rate_limited") && firstFailure === null) {
        firstFailure = rent.status === "not_configured" ? { kind: "needs_key", message: rent.message } : { kind: "rate_limited", message: rent.message };
      }
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
    if (itemStatus === "ok") {
      try {
        const evaluated = await evaluateWatchAlerts(db, watch, checkedMonths, { createAlerts: true });
        itemAlerts = evaluated.alertsCreated;
        await upsertWatchMonthRentSeries(db, watch, checkedMonths);
      } catch {
        itemStatus = "error";
        itemMessage = "시세를 집계하지 못했습니다. 잠시 후 다시 확인해 주세요.";
      }
    }
    await db.insert(schema.watchCheckRuns).values({
      watchId: watch.id,
      status: itemStatus,
      monthsChecked: checkedMonths.join(","),
      newTrades: itemNewTrades,
      alertsCreated: itemAlerts,
      message: itemMessage,
      createdAt: new Date(),
    });
    checked += 1;
    totalNewTrades += itemNewTrades;
    totalNewRents += itemNewRents;
    totalAlerts += itemAlerts;
    if (itemStatus === "needs_key" || itemStatus === "rate_limited") break;
  }
  if (firstFailure !== null) {
    if (firstFailure.kind === "needs_key") {
      return { status: "needs_key" as const, message: firstFailure.message, checked, totalNewTrades, totalNewRents, totalAlerts };
    }
    return { status: "rate_limited" as const, message: firstFailure.message, checked, totalNewTrades, totalNewRents, totalAlerts };
  }
  return {
    status: "ok" as const,
    message: `${checked}개 단지를 확인했습니다. 새 신고 거래 ${totalNewTrades}건, 새 신고 전월세 ${totalNewRents}건, 새 알림 ${totalAlerts}건.`,
    checked,
    totalNewTrades,
    totalNewRents,
    totalAlerts,
  };
}
