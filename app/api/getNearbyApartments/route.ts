import { z } from "zod";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { OFFICIAL_SOURCE_URL, haversineKm, medianOf } from "@/lib/helpers";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    radiusKm: z.union([z.literal(2), z.literal(5), z.literal(10)]),
  }),
  async (args) => {
    const tradeRows = await db.select().from(schema.officialTransactions);
    const withCoords = tradeRows.filter((row) => row.latitude !== null && row.longitude !== null);
    type Group = {
      apartmentName: string;
      legalDong: string;
      roadAddress: string | null;
      latitude: number;
      longitude: number;
      distanceKm: number;
      rows: typeof withCoords;
    };
    const groups = new Map<string, Group>();
    for (const row of withCoords) {
      if (row.latitude === null || row.longitude === null) continue;
      const distanceKm = haversineKm(args.latitude, args.longitude, row.latitude, row.longitude);
      if (distanceKm > args.radiusKm) continue;
      const key = `${row.apartmentName}__${row.roadAddress ?? row.legalDong}`;
      const existing = groups.get(key);
      if (existing) {
        existing.rows.push(row);
        if (distanceKm < existing.distanceKm) {
          existing.distanceKm = distanceKm;
          existing.latitude = row.latitude;
          existing.longitude = row.longitude;
        }
      } else {
        groups.set(key, {
          apartmentName: row.apartmentName,
          legalDong: row.legalDong,
          roadAddress: row.roadAddress,
          latitude: row.latitude,
          longitude: row.longitude,
          distanceKm,
          rows: [row],
        });
      }
    }
    const apartments = Array.from(groups.values())
      .map((group) => {
        const sorted = [...group.rows].sort((a, b) => b.dealYmd.localeCompare(a.dealYmd));
        const latest = sorted[0];
        if (!latest) return null;
        const prices = group.rows.map((r) => r.dealAmountMan);
        const latestFetched = group.rows.reduce((max, r) => (r.fetchedAt.getTime() > max ? r.fetchedAt.getTime() : max), 0);
        return {
          apartmentName: group.apartmentName,
          legalDong: group.legalDong,
          roadAddress: group.roadAddress,
          latitude: group.latitude,
          longitude: group.longitude,
          distanceKm: Math.round(group.distanceKm * 100) / 100,
          latestDealYmd: latest.dealYmd,
          latestPriceMan: latest.dealAmountMan,
          latestAreaSqm: latest.areaSqm,
          latestFloor: latest.floor,
          medianPriceMan: medianOf(prices),
          tradeCount: group.rows.length,
          fetchedAt: new Date(latestFetched).toISOString(),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 120);

    const propertyRows = await db.select().from(schema.properties);
    const savedProperties = propertyRows
      .map((row) => ({
        id: row.id,
        name: row.name,
        address: row.address,
        latitude: row.latitude,
        longitude: row.longitude,
        distanceKm: Math.round(haversineKm(args.latitude, args.longitude, row.latitude, row.longitude) * 100) / 100,
        areaSqm: row.areaSqm,
        askingPriceMan: row.askingPriceMan,
      }))
      .filter((row) => row.distanceKm <= args.radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 60);

    const fetchedAt = apartments.length > 0 ? apartments.reduce((max, item) => (item.fetchedAt > max ? item.fetchedAt : max), apartments[0]?.fetchedAt ?? "") || null : null;
    const hasAny = apartments.length > 0 || savedProperties.length > 0;
    return {
      status: hasAny ? ("ok" as const) : ("no_data" as const),
      message: hasAny ? null : "이 반경 안에서 아직 좌표가 확인된 실거래 단지가 없습니다. 지도에서 이 지역(시·구)의 실거래를 먼저 조회하면 단지가 쌓이고, 그다음부터 주변 라벨로 바로 볼 수 있습니다.",
      sourceUrl: OFFICIAL_SOURCE_URL,
      fetchedAt,
      center: { latitude: args.latitude, longitude: args.longitude },
      radiusKm: args.radiusKm,
      apartments,
      savedProperties,
    };
  },
);
