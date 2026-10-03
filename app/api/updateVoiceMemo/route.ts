import { z } from "zod";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({ id: z.number().int().positive(), title: z.string().max(100) }),
  async (args) => {
    const [row] = await db.select({ propertyId: schema.voiceMemos.propertyId }).from(schema.voiceMemos).where(eq(schema.voiceMemos.id, args.id)).limit(1);
    if (!row) throw new Error("음성 메모를 찾을 수 없습니다.");
    await db.update(schema.voiceMemos).set({ title: args.title.trim() }).where(eq(schema.voiceMemos.id, args.id));
    await db.update(schema.properties).set({ updatedAt: new Date() }).where(eq(schema.properties.id, row.propertyId));
    return { ok: true };
  },
);
