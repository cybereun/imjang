import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { MOLIT_SERVICE_KEY_SETTING_KEY } from "@/lib/helpers";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({}),
  async () => {
    await db.delete(schema.appSettings).where(eq(schema.appSettings.key, MOLIT_SERVICE_KEY_SETTING_KEY));
    return { ok: true, message: "서버 인증키를 삭제했습니다. 자동 확인을 사용하려면 다시 등록해 주세요." };
  },
);
