import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({ id: z.number().int().positive() }),
  async (args) => {
    await db.delete(schema.tourCourses).where(eq(schema.tourCourses.id, args.id));
    return { ok: true };
  },
);
