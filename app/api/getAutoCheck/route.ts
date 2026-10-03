import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { AUTO_CHECK_ENABLED_KEY } from "@/lib/helpers";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({}),
  async () => {
    const [setting] = await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, AUTO_CHECK_ENABLED_KEY)).limit(1);
    const enabled = setting?.value === "1";
    return {
      enabled,
      supported: true,
      message: enabled
        ? "자동 확인이 켜져 있습니다. 설정 화면의 '서버 인증키'에 저장된 인증키로 매일 이른 아침 확인하고, 조건을 충족하면 알림함에 저장됩니다. 서버 인증키가 등록되지 않은 상태에서는 그날 확인이 '인증키 필요'로 기록됩니다."
        : "자동 확인을 켜면 서버 예약 실행이 매일 이른 아침 실거래를 확인합니다. 자동 확인은 설정 화면의 '서버 인증키'로 동작하고, 브라우저에 저장한 인증키는 이 브라우저에서의 수동 확인에만 쓰입니다.",
    };
  },
);
