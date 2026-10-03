import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { deleteBlob } from "@/lib/blob";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({ id: z.number().int().positive() }),
  async (args) => {
    const voiceRows = await db.select({ blobKey: schema.voiceMemos.blobKey }).from(schema.voiceMemos).where(eq(schema.voiceMemos.listingId, args.id));
    await db.delete(schema.listings).where(eq(schema.listings.id, args.id));
    await Promise.all(voiceRows.map((row) => deleteBlob(row.blobKey).catch(() => undefined)));
    return { ok: true, message: null };
  },
);
