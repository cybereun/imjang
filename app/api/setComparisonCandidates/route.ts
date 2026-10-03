import { z } from "zod";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({ propertyIds: z.array(z.number().int().positive()).min(1).max(3).refine((ids) => new Set(ids).size === ids.length) }),
  async (args) => {
    const existing = await db.select().from(schema.propertyComparisons);
    const selectedIds: number[] = [];
    for (const propertyId of args.propertyIds) {
      const [property] = await db.select({ id: schema.properties.id }).from(schema.properties).where(eq(schema.properties.id, propertyId)).limit(1);
      if (property) selectedIds.push(property.id);
    }
    for (const row of existing) {
      if (!selectedIds.includes(row.propertyId)) await db.delete(schema.propertyComparisons).where(eq(schema.propertyComparisons.id, row.id));
    }
    const now = new Date();
    for (const [position, propertyId] of selectedIds.entries()) {
      await db.insert(schema.propertyComparisons).values({ propertyId, position, updatedAt: now }).onConflictDoUpdate({
        target: schema.propertyComparisons.propertyId,
        set: { position, updatedAt: now },
      });
    }
    return { ok: selectedIds.length > 0, selectedIds };
  },
);
