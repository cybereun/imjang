import { z } from "zod";
import { asc, desc, eq } from "drizzle-orm";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { serializeListing } from "@/lib/helpers";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({ propertyId: z.number().int().positive() }),
  async (args) => {
    const rows = await db.select().from(schema.listings).where(eq(schema.listings.propertyId, args.propertyId)).orderBy(desc(schema.listings.updatedAt));
    const summaries = await Promise.all(
      rows.map(async (row) => {
        const logs = await db
          .select({ priceMan: schema.listingPriceLogs.priceMan })
          .from(schema.listingPriceLogs)
          .where(eq(schema.listingPriceLogs.listingId, row.id))
          .orderBy(asc(schema.listingPriceLogs.recordedAt), asc(schema.listingPriceLogs.id));
        const first = logs[0]?.priceMan ?? null;
        return {
          ...serializeListing(row),
          firstPriceMan: first,
          priceChangeMan: first === null ? null : row.priceMan - first,
          logCount: logs.length,
        };
      }),
    );
    return { listings: summaries };
  },
);
