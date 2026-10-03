import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { VWORLD_API_KEY_SETTING_KEY } from "@/lib/helpers";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({}),
  async () => {
    await db.delete(schema.appSettings).where(eq(schema.appSettings.key, VWORLD_API_KEY_SETTING_KEY));
    return { ok: true, message: "VWorld 키를 삭제했습니다. 지도 배경 타일은 키를 다시 등록해야 표시됩니다." };
  },
);
