import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import {
  ensureWatchRentSlice,
  ensureWatchTradeSlice,
  monthKeys,
  upsertWatchMonthRentSeries,
  upsertWatchMonthSeries,
} from "@/lib/helpers";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({
    watchId: z.number().int().positive(),
    months: z.number().int().min(1).max(24).optional(),
    serviceKey: z.string().trim().min(10).max(500).optional(),
  }),
  async (args) => {
    const monthsTotal = args.months ?? 12;
    const [watch] = await db.select().from(schema.watchItems).where(eq(schema.watchItems.id, args.watchId)).limit(1);
    if (!watch) {
      return { status: "error" as const, message: "관심 단지를 찾을 수 없습니다.", monthsFetched: 0, monthsTotal, newTrades: 0, newRents: 0 };
    }
    const months = monthKeys(monthsTotal);
    let monthsFetched = 0;
    let newTrades = 0;
    let newRents = 0;
    let needsKey = false;
    let rateLimited = false;
    let errorCount = 0;
    const fetchedMonths: string[] = [];
    for (const month of months) {
      const slice = await ensureWatchTradeSlice(db, { lawdCd: watch.lawdCd, regionLabel: watch.regionLabel, month, serviceKey: args.serviceKey });
      if (slice.status === "ok") {
        monthsFetched += 1;
        newTrades += slice.inserted;
        fetchedMonths.push(month);
      } else if (slice.status === "not_configured") {
        needsKey = true;
        break;
      } else if (slice.status === "rate_limited") {
        rateLimited = true;
        break;
      } else {
        errorCount += 1;
        fetchedMonths.push(month);
      }
      const rent = await ensureWatchRentSlice(db, { lawdCd: watch.lawdCd, regionLabel: watch.regionLabel, month, serviceKey: args.serviceKey });
      if (rent.status === "ok") {
        newRents += rent.inserted;
        if (!fetchedMonths.includes(month)) fetchedMonths.push(month);
      } else if (rent.status === "not_configured") {
        needsKey = true;
        break;
      } else if (rent.status === "rate_limited") {
        rateLimited = true;
        break;
      } else {
        errorCount += 1;
      }
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
    if (fetchedMonths.length > 0) {
      try {
        await upsertWatchMonthSeries(db, watch, fetchedMonths);
        await upsertWatchMonthRentSeries(db, watch, fetchedMonths);
      } catch {
        errorCount += 1;
      }
    }
    if (needsKey) {
      return { status: "needs_key" as const, message: "인증키가 없어 과거 실거래를 가져오지 못했습니다. 설정 화면에서 브라우저 인증키를 입력하거나 '서버 인증키'를 등록해 주세요.", monthsFetched, monthsTotal, newTrades, newRents };
    }
    if (rateLimited) {
      return { status: "rate_limited" as const, message: `과거 실거래 ${monthsFetched}/${monthsTotal}개월을 가져왔습니다. API 호출 한도에 도달해 중단됐습니다. 잠시 후 다시 시도해 주세요.`, monthsFetched, monthsTotal, newTrades, newRents };
    }
    if (errorCount > 0 && monthsFetched === 0) {
      return { status: "error" as const, message: "과거 실거래를 가져오지 못했습니다. 인증키와 네트워크 상태를 확인해 주세요.", monthsFetched, monthsTotal, newTrades, newRents };
    }
    return { status: "ok" as const, message: `과거 실거래 ${monthsFetched}/${monthsTotal}개월을 저장했습니다. 새 신고 거래 ${newTrades}건, 새 신고 전월세 ${newRents}건. 알림은 별도로 발생시키지 않았습니다.`, monthsFetched, monthsTotal, newTrades, newRents };
  },
);
