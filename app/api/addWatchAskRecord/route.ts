import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { currentKstMonthKey, formatMoneyMan, insertPriceAlertIfNew } from "@/lib/helpers";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({
    watchId: z.number().int().positive(),
    amountMan: z.number().int().positive().max(10000000),
    source: z.string().trim().max(120).nullable().default(null),
    note: z.string().trim().max(500).nullable().default(null),
  }),
  async (args) => {
    const [watch] = await db.select().from(schema.watchItems).where(eq(schema.watchItems.id, args.watchId)).limit(1);
    if (!watch) return { ok: false, alertsCreated: 0, message: "관심 단지를 찾을 수 없습니다." };
    await db.insert(schema.watchAskRecords).values({
      watchId: args.watchId,
      amountMan: args.amountMan,
      source: args.source ?? "",
      note: args.note ?? "",
      recordedAt: new Date(),
    });
    let alertsCreated = 0;
    const month = currentKstMonthKey();
    if (watch.targetPriceMan !== null && args.amountMan <= watch.targetPriceMan) {
      const created = await insertPriceAlertIfNew(db, {
        watchId: args.watchId,
        type: "target_reached",
        month,
        title: `${watch.complexName} 호가가 목표가에 도달했습니다`,
        detail: `직접 기록한 호가 ${formatMoneyMan(args.amountMan)}${args.source ? ` (출처: ${args.source})` : ""}이 목표가 ${formatMoneyMan(watch.targetPriceMan)} 이하입니다. 매물 조건을 꼭 다시 확인하세요.`,
        trigger: args.amountMan,
        baseline: watch.targetPriceMan,
        changePct: null,
      });
      if (created) alertsCreated += 1;
    }
    if (watch.bargainBelowMan !== null && args.amountMan <= watch.bargainBelowMan) {
      const created = await insertPriceAlertIfNew(db, {
        watchId: args.watchId,
        type: "bargain",
        month,
        title: `${watch.complexName} 급매 기준 이하 호가를 기록했습니다`,
        detail: `직접 기록한 호가 ${formatMoneyMan(args.amountMan)}${args.source ? ` (출처: ${args.source})` : ""}이 급매 기준 ${formatMoneyMan(watch.bargainBelowMan)} 이하입니다. "급매"는 기준가 이하의 직접 기록을 뜻하며, 실제 매물 여부와 계약 조건은 원문과 현장에서 다시 확인하세요.`,
        trigger: args.amountMan,
        baseline: watch.bargainBelowMan,
        changePct: null,
      });
      if (created) alertsCreated += 1;
    }
    return { ok: true, alertsCreated, message: null };
  },
);
