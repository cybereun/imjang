import { z } from "zod";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { AUTO_CHECK_ENABLED_KEY, readStoredServiceKey } from "@/lib/helpers";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({ enabled: z.boolean() }),
  async (args) => {
    const value = args.enabled ? "1" : "0";
    await db
      .insert(schema.appSettings)
      .values({ key: AUTO_CHECK_ENABLED_KEY, value, updatedAt: new Date() })
      .onConflictDoUpdate({ target: schema.appSettings.key, set: { value, updatedAt: new Date() } });
    const hasServerKey = args.enabled ? (await readStoredServiceKey(db)) !== undefined : false;
    return {
      ok: true,
      enabled: args.enabled,
      message: args.enabled
        ? hasServerKey
          ? "자동 확인을 켰습니다. 매일 이른 아침 서버 인증키로 실거래를 확인합니다."
          : "자동 확인을 켰습니다. 설정 화면의 '서버 인증키'를 등록해야 매일 이른 아침에 실제 확인이 동작합니다."
        : "자동 확인을 껐습니다. 필요할 때 수동 확인을 사용하세요.",
    };
  },
);
