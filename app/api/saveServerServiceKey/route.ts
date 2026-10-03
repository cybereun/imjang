import { z } from "zod";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { MOLIT_SERVICE_KEY_SETTING_KEY, maskServiceKey } from "@/lib/helpers";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({ serviceKey: z.string().trim().min(10).max(500) }),
  async (args) => {
    const value = args.serviceKey.trim();
    const now = new Date();
    await db
      .insert(schema.appSettings)
      .values({ key: MOLIT_SERVICE_KEY_SETTING_KEY, value, updatedAt: now })
      .onConflictDoUpdate({ target: schema.appSettings.key, set: { value, updatedAt: now } });
    return { ok: true, masked: maskServiceKey(value), updatedAt: now.toISOString(), message: "서버 인증키를 등록했습니다. 자동 확인에 사용됩니다." };
  },
);
