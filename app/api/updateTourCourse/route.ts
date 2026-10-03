import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { visitDateField } from "@/lib/helpers";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({
    id: z.number().int().positive(),
    title: z.string().trim().min(1).max(80),
    visitDate: visitDateField,
    notes: z.string().max(2000),
  }),
  async (args) => {
    const [existing] = await db.select({ id: schema.tourCourses.id }).from(schema.tourCourses).where(eq(schema.tourCourses.id, args.id)).limit(1);
    if (!existing) return { ok: false, message: "코스를 찾을 수 없습니다." };
    await db.update(schema.tourCourses).set({
      title: args.title,
      visitDate: args.visitDate === "" ? null : args.visitDate,
      notes: args.notes,
      updatedAt: new Date(),
    }).where(eq(schema.tourCourses.id, args.id));
    return { ok: true, message: null };
  },
);
