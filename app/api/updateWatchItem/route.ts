import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({
    id: z.number().int().positive(),
    complexName: z.string().trim().min(2).max(80).optional(),
    areaSqm: z.number().positive().max(1000).optional(),
    areaToleranceSqm: z.number().min(0).max(20).optional(),
    active: z.boolean().optional(),
    dropAlertPct: z.number().min(0).max(50).optional(),
    targetPriceMan: z.number().int().positive().nullable().optional(),
    bargainBelowMan: z.number().int().positive().nullable().optional(),
    notes: z.string().trim().max(500).optional(),
  }),
  async (args) => {
    const { id, ...patch } = args;
    const [existing] = await db.select().from(schema.watchItems).where(eq(schema.watchItems.id, id)).limit(1);
    if (!existing) return { ok: false, message: "관심 단지를 찾을 수 없습니다." };
    await db.update(schema.watchItems).set({ ...patch, updatedAt: new Date() }).where(eq(schema.watchItems.id, id));
    return { ok: true, message: null };
  },
);
