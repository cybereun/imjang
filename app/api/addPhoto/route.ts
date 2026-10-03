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
    mimeType: z.enum(["image/jpeg", "image/png"]),
    caption: z.string().max(200),
  }),
  async (args) => {
    const extension = args.mimeType === "image/png" ? "png" : "jpg";
    const key = `properties/${args.propertyId}/${crypto.randomUUID()}.${extension}`;
    const bytes = Uint8Array.from(Buffer.from(args.dataBase64, "base64"));
    // Vercel Blob에 저장하고 공개 URL을 blobKey 컬럼에 저장
    const url = await putBlob(key, bytes, args.mimeType);
    const result = await db.insert(schema.photos).values({ propertyId: args.propertyId, blobKey: url, caption: args.caption, createdAt: new Date() }).returning({ id: schema.photos.id });
    const inserted = result[0];
    if (!inserted) throw new Error("사진을 저장하지 못했습니다.");
    await db.update(schema.properties).set({ updatedAt: new Date() }).where(eq(schema.properties.id, args.propertyId));
    return { id: inserted.id };
  },
);
