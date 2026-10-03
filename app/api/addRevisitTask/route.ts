import { z } from "zod";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({ propertyId: z.number().int().positive(), label: z.string().trim().min(1).max(120) }),
  async (args) => {
    const now = new Date();
    await db.insert(schema.revisitTasks).values({ propertyId: args.propertyId, itemKey: `custom-${crypto.randomUUID()}`, label: args.label, reason: "custom", completed: false, note: "", createdAt: now, updatedAt: now });
    return { ok: true };
  },
);
