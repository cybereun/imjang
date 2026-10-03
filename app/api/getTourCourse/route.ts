import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import {
  CHECKLIST_ITEMS,
  courseDetailSchema,
  courseStopSchema,
  distanceMeters,
  loadCourseStops,
  serializeCourse,
  walkMinutesForMeters,
} from "@/lib/helpers";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({ id: z.number().int().positive() }),
  async (args): Promise<z.infer<typeof courseDetailSchema>> => {
    const [course] = await db.select().from(schema.tourCourses).where(eq(schema.tourCourses.id, args.id)).limit(1);
    if (!course) {
      return { course: null, stops: [], totalDistanceM: 0, totalWalkMinutes: 0, walkAssumption: "직선거리 기준 · 도보 시속 4km 가정" };
    }
    const stops = await loadCourseStops(db, course.id);
    let totalDistanceM = 0;
    let totalWalkMinutes = 0;
    const payload: z.infer<typeof courseStopSchema>[] = [];
    for (let index = 0; index < stops.length; index += 1) {
      const current = stops[index];
      if (current === undefined) continue;
      const previous = index > 0 ? stops[index - 1] : undefined;
      let legFromPrevious: z.infer<typeof courseStopSchema>["legFromPrevious"] = null;
      if (previous !== undefined) {
        const distanceM = distanceMeters(previous.property.latitude, previous.property.longitude, current.property.latitude, current.property.longitude);
        const walkMinutes = walkMinutesForMeters(distanceM);
        totalDistanceM += distanceM;
        totalWalkMinutes += walkMinutes;
        legFromPrevious = { distanceM, walkMinutes };
      }
      const [revisitRows, checklistRows] = await Promise.all([
        db.select({ id: schema.revisitTasks.id }).from(schema.revisitTasks).where(and(eq(schema.revisitTasks.propertyId, current.property.id), eq(schema.revisitTasks.completed, false))),
        db.select({ checked: schema.checklistEntries.checked }).from(schema.checklistEntries).where(eq(schema.checklistEntries.propertyId, current.property.id)),
      ]);
      payload.push({
        id: current.stop.id,
        position: current.stop.position,
        property: {
          id: current.property.id,
          name: current.property.name,
          address: current.property.address,
          latitude: current.property.latitude,
          longitude: current.property.longitude,
        },
        memo: current.stop.memo,
        completed: current.stop.completed,
        legFromPrevious,
        revisitOpenCount: revisitRows.length,
        checklistDone: checklistRows.filter((entry) => entry.checked).length,
        checklistTotal: CHECKLIST_ITEMS.length,
        updatedAt: current.stop.updatedAt.toISOString(),
      });
    }
    return {
      course: serializeCourse(course),
      stops: payload,
      totalDistanceM,
      totalWalkMinutes,
      walkAssumption: "직선거리 기준 · 도보 시속 4km 가정",
    };
  },
);
