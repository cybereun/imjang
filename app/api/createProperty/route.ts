import { z } from "zod";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

const purposeSchema = z.enum(["both", "invest", "reside"]);

export const POST = defineRoute(
  z.object({
    name: z.string().trim().min(1).max(80),
    address: z.string().trim().min(4).max(200),
    resolvedAddress: z.string().trim().min(4).max(300),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    areaSqm: z.number().positive().max(10000),
    askingPriceMan: z.number().int().nonnegative().max(10000000),
    depositMan: z.number().int().nonnegative().max(10000000).nullable(),
    monthlyRentMan: z.number().int().nonnegative().max(1000000).nullable(),
    purpose: purposeSchema,
    visitDate: z.string().nullable(),
    memo: z.string().max(2000),
  }),
  async (args) => {
    const now = new Date();
    const result = await db.insert(schema.properties).values({ ...args, geocodeSource: "OpenStreetMap Nominatim", createdAt: now, updatedAt: now }).returning({ id: schema.properties.id });
    const inserted = result[0];
    if (!inserted) throw new Error("매물을 저장하지 못했습니다.");
    return { id: inserted.id };
  },
);
