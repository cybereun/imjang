import { z } from "zod";
import { desc } from "drizzle-orm";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import {
  courseListItemSchema,
  distanceMeters,
  loadCourseStops,
  serializeCourse,
  walkMinutesForMeters,
} from "@/lib/helpers";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({}),
  async () => {
    const rows = await db.select().from(schema.tourCourses).orderBy(desc(schema.tourCourses.updatedAt));
    const items: z.infer<typeof courseListItemSchema>[] = [];
    for (const row of rows) {
      const stops = await loadCourseStops(db, row.id);
      let totalDistanceM = 0;
      let totalWalkMinutes = 0;
      let completedCount = 0;
      for (let index = 0; index < stops.length; index += 1) {
        const current = stops[index];
        if (current === undefined) continue;
        if (current.stop.completed) completedCount += 1;
        const previous = index > 0 ? stops[index - 1] : undefined;
        if (previous !== undefined) {
          const distanceM = distanceMeters(previous.property.latitude, previous.property.longitude, current.property.latitude, current.property.longitude);
          totalDistanceM += distanceM;
          totalWalkMinutes += walkMinutesForMeters(distanceM);
        }
      }
      items.push({
        ...serializeCourse(row),
        stopCount: stops.length,
        completedCount,
        totalDistanceM,
        totalWalkMinutes,
      });
    }
    return { courses: items };
  },
);
