import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({ id: z.number().int().positive(), memo: z.string().max(300), completed: z.boolean() }),
  async (args) => {
    const now = new Date();
    await db.update(schema.tourCourseStops).set({ memo: args.memo, completed: args.completed, updatedAt: now }).where(eq(schema.tourCourseStops.id, args.id));
    return { ok: true };
  },
);
