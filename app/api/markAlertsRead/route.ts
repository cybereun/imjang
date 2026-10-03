import { z } from "zod";
import { inArray, isNull } from "drizzle-orm";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({ ids: z.array(z.number().int().positive()) }),
  async (args) => {
    const now = new Date();
    if (args.ids.length === 0) {
      await db.update(schema.priceAlerts).set({ readAt: now }).where(isNull(schema.priceAlerts.readAt));
      const rows = await db.select({ id: schema.priceAlerts.id }).from(schema.priceAlerts);
      return { ok: true, count: rows.length };
    }
    await db.update(schema.priceAlerts).set({ readAt: now }).where(inArray(schema.priceAlerts.id, args.ids));
    return { ok: true, count: args.ids.length };
  },
);
