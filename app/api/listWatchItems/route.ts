import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { serializeWatchItem, watchListItemSchema } from "@/lib/helpers";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({}),
  async () => {
    const rows = await db.select().from(schema.watchItems).orderBy(desc(schema.watchItems.createdAt));
    const items: Array<z.infer<typeof watchListItemSchema>> = [];
    for (const row of rows) {
      const series = await db
        .select()
        .from(schema.watchPriceSeries)
        .where(eq(schema.watchPriceSeries.watchId, row.id))
        .orderBy(desc(schema.watchPriceSeries.month));
      const withTrades = series.filter((item) => item.tradeCount > 0 && item.avgPriceMan !== null);
      const latest = withTrades[0];
      const previous = withTrades[1];
      const rentSeries = await db
        .select()
        .from(schema.watchRentSeries)
        .where(eq(schema.watchRentSeries.watchId, row.id))
        .orderBy(desc(schema.watchRentSeries.month));
      const latestRent = rentSeries.find((item) => item.jeonseCount > 0 || item.wolseCount > 0) ?? null;
      const unread = await db
        .select({ id: schema.priceAlerts.id })
        .from(schema.priceAlerts)
        .where(and(eq(schema.priceAlerts.watchId, row.id), isNull(schema.priceAlerts.readAt)));
      const [lastRun] = await db
        .select()
        .from(schema.watchCheckRuns)
        .where(eq(schema.watchCheckRuns.watchId, row.id))
        .orderBy(desc(schema.watchCheckRuns.createdAt))
        .limit(1);
      items.push({
        ...serializeWatchItem(row),
        latest: latest?.avgPriceMan === null || latest?.avgPriceMan === undefined
          ? null
          : {
              month: latest.month,
              avgMan: latest.avgPriceMan,
              tradeCount: latest.tradeCount,
              prevMonth: previous?.month ?? null,
              prevAvgMan: previous?.avgPriceMan ?? null,
              changePct: previous?.avgPriceMan != null && previous.avgPriceMan > 0
                ? ((latest.avgPriceMan - previous.avgPriceMan) / previous.avgPriceMan) * 100
                : null,
            },
        latestRent: latestRent === null
          ? null
          : {
              month: latestRent.month,
              jeonseMedianMan: latestRent.jeonseMedianMan,
              jeonseCount: latestRent.jeonseCount,
              wolseMedianMan: latestRent.wolseMedianMan,
              wolseAvgMonthlyMan: latestRent.wolseAvgMonthlyMan,
              wolseCount: latestRent.wolseCount,
            },
        unreadAlerts: unread.length,
        lastRun: lastRun ? {
          status: lastRun.status as "ok" | "needs_key" | "rate_limited" | "error" | "skipped",
          createdAt: lastRun.createdAt.toISOString(),
          message: lastRun.message,
          newTrades: lastRun.newTrades,
          alertsCreated: lastRun.alertsCreated,
        } : null,
      });
    }
    return { items };
  },
);
