import { z } from "zod";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { deleteBlob } from "@/lib/blob";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({ id: z.number().int().positive() }),
  async (args) => {
    const [row] = await db.select().from(schema.voiceMemos).where(eq(schema.voiceMemos.id, args.id)).limit(1);
    if (row) {
      await db.delete(schema.voiceMemos).where(eq(schema.voiceMemos.id, args.id));
      await deleteBlob(row.blobKey).catch(() => undefined);
      await db.update(schema.properties).set({ updatedAt: new Date() }).where(eq(schema.properties.id, row.propertyId));
    }
    return { ok: true };
  },
);
