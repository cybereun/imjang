import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { listingStatusSchema, listingTradeTypeSchema } from "@/lib/helpers";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({
    propertyId: z.number().int().positive(),
    id: z.number().int().positive().nullable(),
    brokerName: z.string().max(80),
    brokerContact: z.string().max(80),
    dong: z.string().max(40),
    ho: z.string().max(40),
    areaSqm: z.number().min(0).max(2000).nullable(),
    tradeType: listingTradeTypeSchema,
    priceMan: z.number().int().nonnegative().max(10000000),
    monthlyRentMan: z.number().int().nonnegative().max(10000).nullable(),
    targetPriceMan: z.number().int().positive().max(10000000).nullable(),
    listingUrl: z.string().max(500).nullable(),
    status: listingStatusSchema,
    memo: z.string().max(500),
  }),
  async (args) => {
    const [property] = await db.select({ id: schema.properties.id }).from(schema.properties).where(eq(schema.properties.id, args.propertyId)).limit(1);
    if (!property) return { ok: false, id: null, message: "등록된 매물을 찾을 수 없습니다." };
    const now = new Date();
    const values = {
      propertyId: args.propertyId,
      brokerName: args.brokerName.trim(),
      brokerContact: args.brokerContact.trim(),
      dong: args.dong.trim(),
      ho: args.ho.trim(),
      areaSqm: args.areaSqm ?? null,
      tradeType: args.tradeType,
      priceMan: args.priceMan,
      monthlyRentMan: args.tradeType === "wolse" ? args.monthlyRentMan : null,
      targetPriceMan: args.targetPriceMan,
      listingUrl: args.listingUrl?.trim() ? args.listingUrl.trim() : null,
      status: args.status,
      memo: args.memo.trim(),
    };
    if (args.id !== null) {
      const [existing] = await db.select().from(schema.listings).where(eq(schema.listings.id, args.id)).limit(1);
      if (!existing) return { ok: false, id: null, message: "매물 기록을 찾을 수 없습니다." };
      await db.update(schema.listings).set({ ...values, updatedAt: now }).where(eq(schema.listings.id, args.id));
      if (existing.priceMan !== values.priceMan || existing.monthlyRentMan !== values.monthlyRentMan) {
        await db.insert(schema.listingPriceLogs).values({
          listingId: args.id,
          priceMan: values.priceMan,
          monthlyRentMan: values.monthlyRentMan,
          note: "매물 정보 수정으로 반영",
          sourceNote: "직접 입력",
          recordedAt: now,
        });
      }
      return { ok: true, id: args.id, message: null };
    }
    const [created] = await db.insert(schema.listings).values({ ...values, createdAt: now, updatedAt: now }).returning({ id: schema.listings.id });
    if (!created) return { ok: false, id: null, message: "매물 기록을 저장하지 못했습니다." };
    await db.insert(schema.listingPriceLogs).values({
      listingId: created.id,
      priceMan: values.priceMan,
      monthlyRentMan: values.monthlyRentMan,
      note: "매물 등록 시점 호가",
      sourceNote: "직접 입력",
      recordedAt: now,
    });
    return { ok: true, id: created.id, message: null };
  },
);
