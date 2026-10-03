import { z } from "zod";
import { desc, isNull } from "drizzle-orm";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { serializePriceAlert } from "@/lib/helpers";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({ unreadOnly: z.boolean().optional(), limit: z.number().int().min(1).max(100).optional() }),
  async (args) => {
    const unreadOnly = args.unreadOnly ?? false;
    const limit = args.limit ?? 50;
    const rows = unreadOnly
      ? await db.select().from(schema.priceAlerts).where(isNull(schema.priceAlerts.readAt)).orderBy(desc(schema.priceAlerts.createdAt)).limit(limit)
      : await db.select().from(schema.priceAlerts).orderBy(desc(schema.priceAlerts.createdAt)).limit(limit);
    const watches = await db.select().from(schema.watchItems);
    const watchById = new Map<number, { complexName: string; regionLabel: string }>();
    for (const watch of watches) watchById.set(watch.id, { complexName: watch.complexName, regionLabel: watch.regionLabel });
    const unreadCountRows = await db.select({ id: schema.priceAlerts.id }).from(schema.priceAlerts).where(isNull(schema.priceAlerts.readAt));
    return {
      alerts: rows.map((row) => {
        const info = watchById.get(row.watchId);
        return {
          ...serializePriceAlert(row),
          watchComplex: info?.complexName ?? "알 수 없는 단지",
          watchLabel: info?.regionLabel ?? "",
        };
      }),
      unreadCount: unreadCountRows.length,
    };
  },
);
