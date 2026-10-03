import { z } from "zod";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({ propertyId: z.number().int().positive() }),
  async (args) => {
    const rows = await db.select().from(schema.propertyComparisons);
    if (!rows.some((row) => row.propertyId === args.propertyId)) return { ok: false };
    for (const row of rows) {
      await db.update(schema.propertyComparisons).set({ finalSelected: row.propertyId === args.propertyId, updatedAt: new Date() }).where(eq(schema.propertyComparisons.id, row.id));
    }
    return { ok: true };
  },
);
