import { z } from "zod";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({ propertyId: z.number().int().positive(), amountMan: z.number().int().nonnegative().max(10000000), kind: z.enum(["asking", "official_trade"]), note: z.string().max(300) }),
  async (args) => {
    const [property] = await db.select({ sourceReference: schema.properties.sourceReference }).from(schema.properties).where(eq(schema.properties.id, args.propertyId)).limit(1);
    if (!property) return { ok: false };
    await db.insert(schema.priceSnapshots).values({ ...args, sourceUrl: args.kind === "official_trade" ? property.sourceReference : null, recordedAt: new Date() });
    await db.update(schema.priceTrackers).set({ updatedAt: new Date() }).where(eq(schema.priceTrackers.propertyId, args.propertyId));
    return { ok: true };
  },
);
