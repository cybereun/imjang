import { z } from "zod";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({
    propertyId: z.number().int().positive(),
    comparisonNote: z.string().max(2000),
    valueAssessment: z.string().max(2000),
    conclusion: z.string().max(2000),
  }),
  async (args) => {
    const { propertyId, ...values } = args;
    await db.update(schema.propertyComparisons).set({ ...values, updatedAt: new Date() }).where(eq(schema.propertyComparisons.propertyId, propertyId));
    return { ok: true };
  },
);
