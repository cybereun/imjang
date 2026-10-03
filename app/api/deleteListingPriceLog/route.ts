import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({ id: z.number().int().positive() }),
  async (args) => {
    const [log] = await db
      .select({ id: schema.listingPriceLogs.id, listingId: schema.listingPriceLogs.listingId })
      .from(schema.listingPriceLogs)
      .where(eq(schema.listingPriceLogs.id, args.id))
      .limit(1);
    if (!log) return { ok: false, message: "호가 기록을 찾을 수 없습니다." };
    const countRows = await db.select({ id: schema.listingPriceLogs.id }).from(schema.listingPriceLogs).where(eq(schema.listingPriceLogs.listingId, log.listingId));
    if (countRows.length <= 1) return { ok: false, message: "마지막 호가 기록은 삭제할 수 없습니다." };
    await db.delete(schema.listingPriceLogs).where(eq(schema.listingPriceLogs.id, args.id));
    const [latest] = await db
      .select({ priceMan: schema.listingPriceLogs.priceMan, monthlyRentMan: schema.listingPriceLogs.monthlyRentMan })
      .from(schema.listingPriceLogs)
      .where(eq(schema.listingPriceLogs.listingId, log.listingId))
      .orderBy(desc(schema.listingPriceLogs.recordedAt), desc(schema.listingPriceLogs.id))
      .limit(1);
    if (latest) {
      await db.update(schema.listings).set({ priceMan: latest.priceMan, monthlyRentMan: latest.monthlyRentMan, updatedAt: new Date() }).where(eq(schema.listings.id, log.listingId));
    }
    return { ok: true, message: null };
  },
);
