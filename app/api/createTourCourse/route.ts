import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { visitDateField } from "@/lib/helpers";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({
    title: z.string().trim().min(1).max(80),
    visitDate: visitDateField,
    notes: z.string().max(2000),
    propertyIds: z.array(z.number().int().positive()).max(30).default([]),
  }),
  async (args) => {
    const now = new Date();
    const inserted = await db.insert(schema.tourCourses).values({
      title: args.title,
      visitDate: args.visitDate === "" ? null : args.visitDate,
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    }).returning({ id: schema.tourCourses.id });
    const created = inserted[0];
    if (!created) return { ok: false, id: null, message: "코스를 저장하지 못했습니다." };
    const uniqueIds = Array.from(new Set(args.propertyIds));
    let position = 0;
    for (const propertyId of uniqueIds) {
      const [property] = await db.select({ id: schema.properties.id }).from(schema.properties).where(eq(schema.properties.id, propertyId)).limit(1);
      if (!property) continue;
      await db.insert(schema.tourCourseStops).values({ courseId: created.id, propertyId, position, memo: "", completed: false, createdAt: now, updatedAt: now });
      position += 1;
    }
    return { ok: true, id: created.id, message: null };
  },
);
