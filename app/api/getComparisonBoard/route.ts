import { z } from "zod";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { asc, desc, eq } from "drizzle-orm";

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

const photoSchema = z.object({
  id: z.number(),
  url: z.string(),
  caption: z.string(),
  createdAt: z.string(),
});

const comparisonItemSchema = z.object({
  property: propertySchema,
  position: z.number(),
  comparisonNote: z.string(),
  valueAssessment: z.string(),
  conclusion: z.string(),
  finalSelected: z.boolean(),
  updatedAt: z.string(),
  checklistDone: z.number(),
  checklistTotal: z.number(),
  photos: z.array(photoSchema),
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
    const rows = await db.select().from(schema.propertyComparisons).orderBy(asc(schema.propertyComparisons.position));
    const items = await Promise.all(rows.map(async (row): Promise<z.infer<typeof comparisonItemSchema> | null> => {
      const [property] = await db.select().from(schema.properties).where(eq(schema.properties.id, row.propertyId)).limit(1);
      if (!property) return null;
      const [photoRows, checklistRows] = await Promise.all([
        db.select().from(schema.photos).where(eq(schema.photos.propertyId, row.propertyId)).orderBy(desc(schema.photos.createdAt)),
        db.select().from(schema.checklistEntries).where(eq(schema.checklistEntries.propertyId, row.propertyId)),
      ]);
      // Vercel Blob은 blobKey 컬럼에 저장된 공개 URL을 그대로 사용
      const photos = photoRows.map((photo) => ({
        id: photo.id,
        url: photo.blobKey,
        caption: photo.caption,
        createdAt: photo.createdAt.toISOString(),
      }));
      return {
        property: serializeProperty(property),
        position: row.position,
        comparisonNote: row.comparisonNote,
        valueAssessment: row.valueAssessment,
        conclusion: row.conclusion,
        finalSelected: row.finalSelected,
        updatedAt: row.updatedAt.toISOString(),
        checklistDone: checklistRows.filter((entry) => entry.checked).length,
        checklistTotal: 13,
        photos,
      };
    }));
    return { items: items.filter((item): item is z.infer<typeof comparisonItemSchema> => item !== null) };
  },
);
