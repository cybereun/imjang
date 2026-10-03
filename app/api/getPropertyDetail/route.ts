import { z } from "zod";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { asc, desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const purposeSchema = z.enum(["both", "invest", "reside"]);
const referenceKindSchema = z.enum(["price", "location"]);

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

const checklistSchema = z.object({
  itemKey: z.string(),
  checked: z.boolean(),
  note: z.string(),
  updatedAt: z.string(),
});

const photoSchema = z.object({
  id: z.number(),
  url: z.string(),
  caption: z.string(),
  createdAt: z.string(),
});

const voiceMemoSchema = z.object({
  id: z.number(),
  propertyId: z.number(),
  listingId: z.number().nullable(),
  checklistItemKey: z.string().nullable(),
  title: z.string(),
  url: z.string(),
  mimeType: z.string(),
  durationSec: z.number().nullable(),
  createdAt: z.string(),
});

const referenceSchema = z.object({
  id: z.number(),
  kind: referenceKindSchema,
  title: z.string(),
  url: z.string(),
  source: z.string().nullable(),
  snippet: z.string().nullable(),
  publishedAt: z.string().nullable(),
  rank: z.number(),
  fetchedAt: z.string(),
});

const nearbySchema = z.object({
  id: z.number(),
  category: z.enum(["transit", "school", "market", "hospital"]),
  name: z.string(),
  address: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  distanceM: z.number(),
  fetchedAt: z.string(),
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
  z.object({ id: z.number().int().positive() }),
  async (args) => {
    const [property] = await db.select().from(schema.properties).where(eq(schema.properties.id, args.id)).limit(1);
    if (!property) return { property: null, checklist: [], photos: [], voiceMemos: [], references: [], nearby: [] };

    const [checklistRows, photoRows, voiceMemoRows, referenceRows, nearbyRows] = await Promise.all([
      db.select().from(schema.checklistEntries).where(eq(schema.checklistEntries.propertyId, args.id)).orderBy(asc(schema.checklistEntries.itemKey)),
      db.select().from(schema.photos).where(eq(schema.photos.propertyId, args.id)).orderBy(desc(schema.photos.createdAt)),
      db.select().from(schema.voiceMemos).where(eq(schema.voiceMemos.propertyId, args.id)).orderBy(desc(schema.voiceMemos.createdAt), desc(schema.voiceMemos.id)),
      db.select().from(schema.referenceResults).where(eq(schema.referenceResults.propertyId, args.id)).orderBy(asc(schema.referenceResults.kind), asc(schema.referenceResults.rank)),
      db.select().from(schema.nearbyPlaces).where(eq(schema.nearbyPlaces.propertyId, args.id)).orderBy(asc(schema.nearbyPlaces.distanceM)),
    ]);

    // Vercel Blob은 blobKey 컬럼에 저장된 공개 URL을 그대로 사용
    const photos = photoRows.map((row) => ({
      id: row.id,
      url: row.blobKey,
      caption: row.caption,
      createdAt: row.createdAt.toISOString(),
    }));

    const voiceMemos = voiceMemoRows.map((row) => ({
      id: row.id,
      propertyId: row.propertyId,
      listingId: row.listingId,
      checklistItemKey: row.checklistItemKey,
      title: row.title,
      url: row.blobKey,
      mimeType: row.mimeType,
      durationSec: row.durationSec,
      createdAt: row.createdAt.toISOString(),
    }));

    return {
      property: serializeProperty(property),
      checklist: checklistRows.map((row) => ({
        itemKey: row.itemKey,
        checked: row.checked,
        note: row.note,
        updatedAt: row.updatedAt.toISOString(),
      })),
      photos,
      voiceMemos,
      references: referenceRows.map((row) => ({
        id: row.id,
        kind: row.kind,
        title: row.title,
        url: row.url,
        source: row.source,
        snippet: row.snippet,
        publishedAt: row.publishedAt,
        rank: row.rank,
        fetchedAt: row.fetchedAt.toISOString(),
      })),
      nearby: nearbyRows.map((row) => ({
        id: row.id,
        category: row.category,
        name: row.name,
        address: row.address,
        latitude: row.latitude,
        longitude: row.longitude,
        distanceM: row.distanceM,
        fetchedAt: row.fetchedAt.toISOString(),
      })),
    };
  },
);
