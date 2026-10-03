import { z } from "zod";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({ propertyId: z.number().int().positive(), targetPriceMan: z.number().int().nonnegative().nullable() }),
  async (args) => {
    const [property] = await db.select().from(schema.properties).where(eq(schema.properties.id, args.propertyId)).limit(1);
    if (!property) return { ok: false };
    const now = new Date();
    await db.insert(schema.priceTrackers).values({ propertyId: args.propertyId, active: true, targetPriceMan: args.targetPriceMan, createdAt: now, updatedAt: now }).onConflictDoUpdate({
      target: schema.priceTrackers.propertyId,
      set: { active: true, targetPriceMan: args.targetPriceMan, updatedAt: now },
    });
    const existing = await db.select({ id: schema.priceSnapshots.id }).from(schema.priceSnapshots).where(eq(schema.priceSnapshots.propertyId, args.propertyId)).limit(1);
    if (!existing[0]) {
      await db.insert(schema.priceSnapshots).values({ propertyId: args.propertyId, amountMan: property.askingPriceMan, kind: property.priceBasis, note: "추적 시작 기준값", sourceUrl: property.sourceReference, recordedAt: now });
    }
    return { ok: true };
  },
);
