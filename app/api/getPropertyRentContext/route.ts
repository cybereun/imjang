import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import {
  OFFICIAL_RENT_SOURCE_URL,
  OFFICIAL_SOURCE_URL,
  medianOf,
  resolveLawdCdFromProperty,
} from "@/lib/helpers";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({
    propertyId: z.number().int().positive(),
    lawdCd: z.string().regex(/^\d{5}$/).nullable(),
    areaSqm: z.number().positive().max(1000),
    depositPropertyAreaToleranceSqm: z.number().min(0).max(20).default(1.5),
  }),
  async (args) => {
    const [property] = await db.select().from(schema.properties).where(eq(schema.properties.id, args.propertyId)).limit(1);
    if (!property) {
      return { status: "no_data" as const, message: "임장 자료를 찾을 수 없습니다.", rentSourceUrl: OFFICIAL_RENT_SOURCE_URL, tradeSourceUrl: OFFICIAL_SOURCE_URL, summary: null };
    }
    const lawdCd = resolveLawdCdFromProperty({ address: property.address, resolvedAddress: property.resolvedAddress }, args.lawdCd);
    if (!lawdCd) {
      return { status: "no_data" as const, message: "저장된 주소에서 시·군·구 법정동 코드를 확인하지 못했습니다. 주소에 시·구 이름이 들어가 있는지 매물 수정을 확인해 주세요.", rentSourceUrl: OFFICIAL_RENT_SOURCE_URL, tradeSourceUrl: OFFICIAL_SOURCE_URL, summary: null };
    }
    const normalizedName = property.name.trim();
    const rentRows = await db.select().from(schema.officialRentTransactions)
      .where(and(eq(schema.officialRentTransactions.lawdCd, lawdCd), eq(schema.officialRentTransactions.apartmentName, normalizedName)));
    const inAreaRent = rentRows.filter((row) => Math.abs(row.areaSqm - args.areaSqm) <= args.depositPropertyAreaToleranceSqm);
    const jeonse = inAreaRent.filter((row) => row.monthlyRentMan === 0).map((row) => row.depositMan);
    const wolse = inAreaRent.filter((row) => row.monthlyRentMan > 0);
    const tradeRows = await db.select().from(schema.officialTransactions)
      .where(and(eq(schema.officialTransactions.lawdCd, lawdCd), eq(schema.officialTransactions.apartmentName, normalizedName)));
    const inAreaTrade = tradeRows.filter((row) => Math.abs(row.areaSqm - args.areaSqm) <= args.depositPropertyAreaToleranceSqm);
    const jeonseMedianMan = medianOf(jeonse);
    const saleMedianMan = medianOf(inAreaTrade.map((row) => row.dealAmountMan));
    if (jeonseMedianMan === null && saleMedianMan === null && inAreaRent.length === 0) {
      // 구역을 확보했지만 단지·면적에 신고 자료가 비는 경우, '조회가 없었다'는 안내와 실제 부재를 구분한다.
      const [districtRows] = await db.select({ id: schema.officialRentTransactions.id }).from(schema.officialRentTransactions).where(eq(schema.officialRentTransactions.lawdCd, lawdCd)).limit(1);
      const [saleRows] = await db.select({ id: schema.officialTransactions.id }).from(schema.officialTransactions).where(eq(schema.officialTransactions.lawdCd, lawdCd)).limit(1);
      const guidance = districtRows !== undefined || saleRows !== undefined
        ? "조회된 자료에 따르면 같은 시·군·구에서 이 단지·면적대(±1.5㎡)의 신고 거래가 없습니다. 다른 단지·면적을 비교하려면 지도 화면에서 전월세 조회를 실행해 보세요."
        : "같은 단지·면적의 실거래 전월세 자료가 아직 조회되지 않았습니다. 지도 화면에서 전월세 조회를 먼저 실행하면 전세 시세가 계산됩니다.";
      return { status: "no_data" as const, message: guidance, rentSourceUrl: OFFICIAL_RENT_SOURCE_URL, tradeSourceUrl: OFFICIAL_SOURCE_URL, summary: null };
    }
    const months: string[] = [...inAreaRent, ...tradeRows].map((row) => row.dealYmd.slice(0, 7)).filter((value) => /^\d{4}-\d{2}$/.test(value)).sort();
    const monthRange = months.length > 0 ? `${months[0]} ~ ${months[months.length - 1]}` : null;
    const latestFetched = [...inAreaRent, ...tradeRows].map((row) => row.fetchedAt.getTime());
    return {
      status: "ok" as const,
      message: null,
      rentSourceUrl: OFFICIAL_RENT_SOURCE_URL,
      tradeSourceUrl: OFFICIAL_SOURCE_URL,
      summary: {
        jeonseMedianMan,
        jeonseCount: jeonse.length,
        wolseMedianMan: medianOf(wolse.map((row) => row.depositMan)),
        wolseAvgMonthlyMan: wolse.length > 0 ? Math.round(wolse.reduce((sum, row) => sum + row.monthlyRentMan, 0) / wolse.length) : null,
        wolseCount: wolse.length,
        saleMedianMan,
        saleCount: inAreaTrade.length,
        jeonseRatioPct: jeonseMedianMan !== null && saleMedianMan !== null && saleMedianMan > 0 ? Math.round((jeonseMedianMan / saleMedianMan) * 1000) / 10 : null,
        gapMan: jeonseMedianMan !== null && saleMedianMan !== null ? saleMedianMan - jeonseMedianMan : null,
        monthRange,
        fetchedAt: latestFetched.length > 0 ? new Date(Math.max(...latestFetched)).toISOString() : null,
      },
    };
  },
);
