import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import {
  serializePriceAlert,
  serializeWatchCheckRun,
  serializeWatchItem,
} from "@/lib/helpers";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({ watchId: z.number().int().positive() }),
  async (args) => {
    const [watch] = await db.select().from(schema.watchItems).where(eq(schema.watchItems.id, args.watchId)).limit(1);
    if (!watch) throw new Error("관심 단지를 찾을 수 없습니다.");
    const series = await db
      .select()
      .from(schema.watchPriceSeries)
      .where(eq(schema.watchPriceSeries.watchId, args.watchId))
      .orderBy(desc(schema.watchPriceSeries.month))
      .limit(24);
    const rentSeries = await db
      .select()
      .from(schema.watchRentSeries)
      .where(eq(schema.watchRentSeries.watchId, args.watchId))
      .orderBy(desc(schema.watchRentSeries.month))
      .limit(24);
    const askRecords = await db
      .select()
      .from(schema.watchAskRecords)
      .where(eq(schema.watchAskRecords.watchId, args.watchId))
      .orderBy(desc(schema.watchAskRecords.recordedAt))
      .limit(30);
    const alerts = await db
      .select()
      .from(schema.priceAlerts)
      .where(eq(schema.priceAlerts.watchId, args.watchId))
      .orderBy(desc(schema.priceAlerts.createdAt))
      .limit(30);
    const runs = await db
      .select()
      .from(schema.watchCheckRuns)
      .where(eq(schema.watchCheckRuns.watchId, args.watchId))
      .orderBy(desc(schema.watchCheckRuns.createdAt))
      .limit(10);
    return {
      watch: serializeWatchItem(watch),
      series: series.reverse().map((row) => ({
        watchId: row.watchId,
        month: row.month,
        avgPriceMan: row.avgPriceMan,
        medianPriceMan: row.medianPriceMan,
        minPriceMan: row.minPriceMan,
        maxPriceMan: row.maxPriceMan,
        tradeCount: row.tradeCount,
        fetchedAt: row.fetchedAt.toISOString(),
      })),
      rentSeries: rentSeries.reverse().map((row) => ({
        watchId: row.watchId,
        month: row.month,
        jeonseAvgMan: row.jeonseAvgMan,
        jeonseMedianMan: row.jeonseMedianMan,
        jeonseMinMan: row.jeonseMinMan,
        jeonseMaxMan: row.jeonseMaxMan,
        jeonseCount: row.jeonseCount,
        wolseAvgMan: row.wolseAvgMan,
        wolseMedianMan: row.wolseMedianMan,
        wolseAvgMonthlyMan: row.wolseAvgMonthlyMan,
        wolseCount: row.wolseCount,
        fetchedAt: row.fetchedAt.toISOString(),
      })),
      askRecords: askRecords.map((row) => ({
        id: row.id,
        watchId: row.watchId,
        amountMan: row.amountMan,
        source: row.source,
        note: row.note,
        recordedAt: row.recordedAt.toISOString(),
      })),
      alerts: alerts.map(serializePriceAlert),
      runs: runs.map(serializeWatchCheckRun),
    };
  },
);
