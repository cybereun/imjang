import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({
    lawdCd: z.string().regex(/^\d{5}$/),
    regionLabel: z.string().trim().min(2).max(80),
    complexName: z.string().trim().min(2).max(80),
    areaSqm: z.number().positive().max(1000),
    areaToleranceSqm: z.number().min(0).max(20).default(1),
    dropAlertPct: z.number().min(0).max(50).default(3),
    targetPriceMan: z.number().int().positive().nullable().default(null),
    bargainBelowMan: z.number().int().positive().nullable().default(null),
    notes: z.string().trim().max(500).default(""),
  }),
  async (args) => {
    const existing = await db
      .select({ id: schema.watchItems.id })
      .from(schema.watchItems)
      .where(and(
        eq(schema.watchItems.lawdCd, args.lawdCd),
        eq(schema.watchItems.complexName, args.complexName),
      ))
      .limit(1);
    if (existing[0]) {
      return { ok: false, id: null, message: "이미 같은 지역의 같은 단지가 등록되어 있습니다. 조건은 기존 항목에서 수정하세요." };
    }
    const now = new Date();
    await db.insert(schema.watchItems).values({
      lawdCd: args.lawdCd,
      regionLabel: args.regionLabel,
      complexName: args.complexName,
      areaSqm: args.areaSqm,
      areaToleranceSqm: args.areaToleranceSqm,
      active: true,
      dropAlertPct: args.dropAlertPct,
      targetPriceMan: args.targetPriceMan,
      bargainBelowMan: args.bargainBelowMan,
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    });
    const [created] = await db.select().from(schema.watchItems).orderBy(desc(schema.watchItems.id)).limit(1);
    return { ok: true, id: created?.id ?? null, message: null };
  },
);
