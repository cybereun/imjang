import { z } from "zod";
import { and, desc, eq, like } from "drizzle-orm";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { fetchMolitApartmentTrades } from "@/lib/molit";
import {
  OFFICIAL_SOURCE_URL,
  geocodeExactAddress,
  parseMolitTradeRows,
  readStoredServiceKey,
  serializeOfficialTransaction,
} from "@/lib/helpers";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({
    lawdCd: z.string().regex(/^\d{5}$/),
    regionLabel: z.string().trim().min(2).max(80),
    dealMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    serviceKey: z.string().trim().min(10).max(500).optional(),
  }),
  async (args) => {
    const cached = async () => {
      const rows = await db.select().from(schema.officialTransactions)
        .where(and(eq(schema.officialTransactions.lawdCd, args.lawdCd), like(schema.officialTransactions.dealYmd, `${args.dealMonth}%`)))
        .orderBy(desc(schema.officialTransactions.dealYmd), desc(schema.officialTransactions.dealAmountMan));
      return rows.map(serializeOfficialTransaction);
    };
    try {
      const serviceKey = args.serviceKey ?? (await readStoredServiceKey(db));
      const result = await fetchMolitApartmentTrades({ lawdCd: args.lawdCd, dealYmd: args.dealMonth.replace("-", ""), serviceKey });
      if (result.status === "not_configured") {
        const transactions = await cached();
        return {
          status: "needs_connection" as const,
          message: "설정에서 공공데이터포털 일반 인증키를 연결해 주세요.",
          sourceUrl: OFFICIAL_SOURCE_URL,
          fetchedAt: transactions[0]?.fetchedAt ?? null,
          transactions,
        };
      }
      if (result.status !== "ok" || result.variant === null) {
        const transactions = await cached();
        return { status: "error" as const, message: result.status === "rate_limited" ? "공공데이터포털 호출 한도에 도달했습니다. 다음 갱신 시점에 다시 시도해 주세요." : (result.message ?? "국토교통부 실거래가 API에 연결하지 못했습니다."), sourceUrl: OFFICIAL_SOURCE_URL, fetchedAt: transactions[0]?.fetchedAt ?? null, transactions };
      }
      const apiVariant = result.variant;
      const xml = result.xml;

      const fetchedAt = new Date();
      const parsedRows = parseMolitTradeRows(xml, args.lawdCd, args.regionLabel, apiVariant, fetchedAt);

      const oldRows = await db.select().from(schema.officialTransactions)
        .where(and(eq(schema.officialTransactions.lawdCd, args.lawdCd), like(schema.officialTransactions.dealYmd, `${args.dealMonth}%`)));
      const oldCoordinates = new Map(oldRows.filter((row) => row.latitude !== null && row.longitude !== null).map((row) => [row.fingerprint, { latitude: row.latitude, longitude: row.longitude }]));
      const uniqueAddresses = new Map<string, { latitude: number; longitude: number }>();
      for (const old of oldRows) {
        if (old.roadAddress && old.latitude !== null && old.longitude !== null) uniqueAddresses.set(old.roadAddress, { latitude: old.latitude, longitude: old.longitude });
      }
      let geocodeCount = 0;
      for (const row of parsedRows) {
        const existing = oldCoordinates.get(row.fingerprint);
        if (existing) {
          row.latitude = existing.latitude;
          row.longitude = existing.longitude;
          continue;
        }
        if (!row.roadAddress) continue;
        const reused = uniqueAddresses.get(row.roadAddress);
        if (reused) {
          row.latitude = reused.latitude;
          row.longitude = reused.longitude;
          continue;
        }
        if (geocodeCount >= 8) continue;
        const found = await geocodeExactAddress(row.roadAddress);
        geocodeCount += 1;
        if (found) {
          row.latitude = found.latitude;
          row.longitude = found.longitude;
          uniqueAddresses.set(row.roadAddress, { latitude: found.latitude, longitude: found.longitude });
        }
        if (geocodeCount < 8) await new Promise((resolve) => setTimeout(resolve, 1050));
      }

      await db.delete(schema.officialTransactions).where(and(eq(schema.officialTransactions.lawdCd, args.lawdCd), like(schema.officialTransactions.dealYmd, `${args.dealMonth}%`)));
      if (parsedRows.length > 0) await db.insert(schema.officialTransactions).values(parsedRows);
      const transactions = await cached();
      return { status: "ok" as const, message: transactions.length === 0 ? "선택한 달에 신고된 아파트 매매 거래가 없습니다." : null, sourceUrl: OFFICIAL_SOURCE_URL, fetchedAt: fetchedAt.toISOString(), transactions };
    } catch {
      const transactions = await cached();
      return { status: "error" as const, message: "실거래가를 불러오는 중 문제가 생겼습니다. 저장된 결과가 있으면 그대로 표시합니다.", sourceUrl: OFFICIAL_SOURCE_URL, fetchedAt: transactions[0]?.fetchedAt ?? null, transactions };
    }
  },
);
