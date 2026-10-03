import { z } from "zod";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

const purposeSchema = z.enum(["both", "invest", "reside"]);

const propertySchema = z.object({
  id: z.number(),
  name: z.string(),
  address: z.string(),
  resolvedAddress: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  areaSqm: z.number(),
  askingPriceMan: z.number(),
  depositMan: z.number().nullable(),
  monthlyRentMan: z.number().nullable(),
  purpose: purposeSchema,
  visitDate: z.string().nullable(),
  memo: z.string(),
  priceBasis: z.enum(["asking", "official_trade"]),
  sourceReference: z.string().nullable(),
  geocodeSource: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// 원본 serializeProperty를 그대로 포팅
function serializeProperty(row: typeof schema.properties.$inferSelect): z.infer<typeof propertySchema> {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    resolvedAddress: row.resolvedAddress,
    latitude: row.latitude,
    longitude: row.longitude,
    areaSqm: row.areaSqm,
    askingPriceMan: row.askingPriceMan,
    depositMan: row.depositMan,
    monthlyRentMan: row.monthlyRentMan,
    purpose: row.purpose as "both" | "invest" | "reside",
    visitDate: row.visitDate,
    memo: row.memo,
    priceBasis: row.priceBasis as "asking" | "official_trade",
    sourceReference: row.sourceReference,
    geocodeSource: row.geocodeSource,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const POST = defineRoute(
  z.object({}),
  async () => {
    const rows = await db.select().from(schema.properties).orderBy(desc(schema.properties.updatedAt));
    return { properties: rows.map(serializeProperty) };
  },
);
