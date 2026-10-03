import { z } from "zod";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({ id: z.number().int().positive(), completed: z.boolean(), note: z.string().max(500) }),
  async (args) => {
    await db.update(schema.revisitTasks).set({ completed: args.completed, note: args.note, updatedAt: new Date() }).where(eq(schema.revisitTasks.id, args.id));
    return { ok: true };
  },
);
