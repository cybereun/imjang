import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({
    courseId: z.number().int().positive(),
    propertyIds: z.array(z.number().int().positive()).max(30).default([]),
  }),
  async (args) => {
    const [course] = await db.select({ id: schema.tourCourses.id }).from(schema.tourCourses).where(eq(schema.tourCourses.id, args.courseId)).limit(1);
    if (!course) return { ok: false, stopCount: 0, message: "코스를 찾을 수 없습니다." };
    const existing = await db.select().from(schema.tourCourseStops).where(eq(schema.tourCourseStops.courseId, args.courseId));
    const preserved = new Map(existing.map((stop) => [stop.propertyId, { memo: stop.memo, completed: stop.completed }]));
    await db.delete(schema.tourCourseStops).where(eq(schema.tourCourseStops.courseId, args.courseId));
    const uniqueIds = Array.from(new Set(args.propertyIds));
    const now = new Date();
    let position = 0;
    for (const propertyId of uniqueIds) {
      const [property] = await db.select({ id: schema.properties.id }).from(schema.properties).where(eq(schema.properties.id, propertyId)).limit(1);
      if (!property) continue;
      const prev = preserved.get(propertyId);
      await db.insert(schema.tourCourseStops).values({
        courseId: args.courseId,
        propertyId,
        position,
        memo: prev?.memo ?? "",
        completed: prev?.completed ?? false,
        createdAt: now,
        updatedAt: now,
      });
      position += 1;
    }
    await db.update(schema.tourCourses).set({ updatedAt: now }).where(eq(schema.tourCourses.id, args.courseId));
    return { ok: true, stopCount: position, message: null };
  },
);
