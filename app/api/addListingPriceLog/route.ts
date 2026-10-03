import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({
    listingId: z.number().int().positive(),
    priceMan: z.number().int().nonnegative().max(10000000),
    monthlyRentMan: z.number().int().nonnegative().max(10000).nullable(),
    note: z.string().max(300),
    sourceNote: z.string().max(80),
    recordedAt: z.string().nullable(),
  }),
  async (args) => {
    const [listing] = await db.select().from(schema.listings).where(eq(schema.listings.id, args.listingId)).limit(1);
    if (!listing) return { ok: false, message: "매물 기록을 찾을 수 없습니다." };
    let recordedAt = new Date();
    if (args.recordedAt) {
      const parsed = new Date(`${args.recordedAt}T12:00:00`);
      if (!Number.isNaN(parsed.getTime())) recordedAt = parsed;
    }
    await db.insert(schema.listingPriceLogs).values({
      listingId: args.listingId,
      priceMan: args.priceMan,
      monthlyRentMan: listing.tradeType === "wolse" ? args.monthlyRentMan : null,
      note: args.note.trim(),
      sourceNote: args.sourceNote.trim(),
      recordedAt,
    });
    const [latest] = await db
      .select({ priceMan: schema.listingPriceLogs.priceMan, monthlyRentMan: schema.listingPriceLogs.monthlyRentMan })
      .from(schema.listingPriceLogs)
      .where(eq(schema.listingPriceLogs.listingId, args.listingId))
      .orderBy(desc(schema.listingPriceLogs.recordedAt), desc(schema.listingPriceLogs.id))
      .limit(1);
    await db
      .update(schema.listings)
      .set({ priceMan: latest?.priceMan ?? args.priceMan, monthlyRentMan: latest?.monthlyRentMan ?? null, updatedAt: new Date() })
      .where(eq(schema.listings.id, args.listingId));
    return { ok: true, message: null };
  },
);
