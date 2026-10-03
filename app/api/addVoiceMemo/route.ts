import { z } from "zod";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { putBlob } from "@/lib/blob";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({
    propertyId: z.number().int().positive(),
    dataBase64: z.string().min(20).max(12_000_000),
    mimeType: z.enum(["audio/webm", "audio/mp4", "audio/ogg", "audio/wav"]),
    durationSec: z.number().min(0).max(36000).nullable(),
    title: z.string().max(100),
    listingId: z.number().int().positive().nullable().optional(),
    checklistItemKey: z.string().max(80).nullable().optional(),
  }),
  async (args) => {
    const [property] = await db.select({ id: schema.properties.id }).from(schema.properties).where(eq(schema.properties.id, args.propertyId)).limit(1);
    if (!property) throw new Error("매물을 찾을 수 없습니다.");
    let listingId: number | null = null;
    if (args.listingId) {
      const [listing] = await db.select({ id: schema.listings.id, propertyId: schema.listings.propertyId }).from(schema.listings).where(eq(schema.listings.id, args.listingId)).limit(1);
      if (!listing || listing.propertyId !== args.propertyId) throw new Error("매물 기록을 찾을 수 없습니다.");
      listingId = listing.id;
    }
    const extension = { "audio/webm": "webm", "audio/mp4": "m4a", "audio/ogg": "ogg", "audio/wav": "wav" }[args.mimeType];
    const key = `voice_memos/${args.propertyId}/${crypto.randomUUID()}.${extension}`;
    const bytes = Uint8Array.from(Buffer.from(args.dataBase64, "base64"));
    // Vercel Blob에 저장하고 공개 URL을 blobKey 컬럼에 저장
    const url = await putBlob(key, bytes, args.mimeType);
    const checklistItemKey = args.checklistItemKey?.trim() ? args.checklistItemKey.trim() : null;
    const result = await db
      .insert(schema.voiceMemos)
      .values({
        propertyId: args.propertyId,
        listingId,
        checklistItemKey,
        title: args.title.trim(),
        blobKey: url,
        mimeType: args.mimeType,
        durationSec: args.durationSec === null ? null : Math.round(args.durationSec * 10) / 10,
        createdAt: new Date(),
      })
      .returning({ id: schema.voiceMemos.id });
    const inserted = result[0];
    if (!inserted) throw new Error("음성 메모를 저장하지 못했습니다.");
    await db.update(schema.properties).set({ updatedAt: new Date() }).where(eq(schema.properties.id, args.propertyId));
    return { id: inserted.id };
  },
);
