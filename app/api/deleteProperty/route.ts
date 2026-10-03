import { z } from "zod";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { deleteBlob } from "@/lib/blob";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({ id: z.number().int().positive() }),
  async (args) => {
    const [photoRows, voiceRows] = await Promise.all([
      db.select({ blobKey: schema.photos.blobKey }).from(schema.photos).where(eq(schema.photos.propertyId, args.id)),
      db.select({ blobKey: schema.voiceMemos.blobKey }).from(schema.voiceMemos).where(eq(schema.voiceMemos.propertyId, args.id)),
    ]);
    await db.delete(schema.properties).where(eq(schema.properties.id, args.id));
    await Promise.all([
      ...photoRows.map((row) => deleteBlob(row.blobKey).catch(() => undefined)),
      ...voiceRows.map((row) => deleteBlob(row.blobKey).catch(() => undefined)),
    ]);
    return { ok: true };
  },
);
