import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { VWORLD_API_KEY_SETTING_KEY, maskServiceKey } from "@/lib/helpers";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({}),
  async () => {
    const [setting] = await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, VWORLD_API_KEY_SETTING_KEY)).limit(1);
    const value = setting?.value.trim() ?? "";
    if (value.length < 10) return { configured: false, masked: null, updatedAt: null, ownerOnly: false };
    return { configured: true, masked: maskServiceKey(value), updatedAt: setting?.updatedAt.toISOString() ?? null, ownerOnly: false };
  },
);
