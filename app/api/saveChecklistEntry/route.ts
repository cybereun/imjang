import { z } from "zod";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({
    propertyId: z.number().int().positive(),
    itemKey: z.string().min(1).max(80),
    checked: z.boolean(),
    note: z.string().max(500),
  }),
  async (args) => {
    await db.insert(schema.checklistEntries).values({ ...args, updatedAt: new Date() }).onConflictDoUpdate({
      target: [schema.checklistEntries.propertyId, schema.checklistEntries.itemKey],
      set: { checked: args.checked, note: args.note, updatedAt: new Date() },
    });
    await db.update(schema.properties).set({ updatedAt: new Date() }).where(eq(schema.properties.id, args.propertyId));
    return { ok: true };
  },
);
