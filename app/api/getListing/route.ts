import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { serializeListing } from "@/lib/helpers";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({ id: z.number().int().positive() }),
  async (args) => {
    const [row] = await db.select().from(schema.listings).where(eq(schema.listings.id, args.id)).limit(1);
    if (!row) return { listing: null, logs: [] };
    const logRows = await db
      .select()
      .from(schema.listingPriceLogs)
      .where(eq(schema.listingPriceLogs.listingId, row.id))
      .orderBy(desc(schema.listingPriceLogs.recordedAt), desc(schema.listingPriceLogs.id));
    return {
      listing: serializeListing(row),
      logs: logRows.map((log) => ({
        id: log.id,
        listingId: log.listingId,
        priceMan: log.priceMan,
        monthlyRentMan: log.monthlyRentMan,
        note: log.note,
        sourceNote: log.sourceNote,
        recordedAt: log.recordedAt.toISOString(),
      })),
    };
  },
);
