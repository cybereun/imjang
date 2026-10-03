import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineRoute } from "@/lib/route";
import { db, schema } from "@/lib/db";
import { distanceMeters, nominatimSchema } from "@/lib/helpers";

export const dynamic = "force-dynamic";

// 자료 탭의 "자료 새로 찾기".
// Vercel 서버에는 웹 검색 API 키가 없으므로, 실거래·시세는 주소 기반 바로가기
// 링크를 참고자료 카드로 저장하고, 주변 시설 좌표는 Nominatim으로 조회한다.
export const POST = defineRoute(
  z.object({ propertyId: z.number().int().positive() }),
  async (args) => {
    const [property] = await db
      .select()
      .from(schema.properties)
      .where(eq(schema.properties.id, args.propertyId))
      .limit(1);
    if (!property) return { ok: false, count: 0, message: "매물을 찾을 수 없습니다." };

    const fetchedAt = new Date();
    const keyword = `${property.name} ${property.address}`.trim();
    const encoded = encodeURIComponent(keyword);

    const rows: Array<typeof schema.referenceResults.$inferInsert> = [
      {
        propertyId: args.propertyId,
        kind: "price",
        title: "국토교통부 실거래가 공개시스템",
        url: "https://rt.molit.go.kr",
        source: "국토교통부",
        snippet:
          "아파트 매매·전월세 실거래가를 직접 조회할 수 있는 공식 창구입니다. 신고일 기준 자료이며 호가와 다를 수 있습니다.",
        publishedAt: null,
        rank: 0,
        fetchedAt,
      },
      {
        propertyId: args.propertyId,
        kind: "price",
        title: `${keyword} 실거래가 검색`,
        url: `https://search.naver.com/search.naver?query=${encoded} 실거래가`,
        source: "네이버 검색",
        snippet:
          "포털에서 집계한 실거래·호가 정보를 한 번에 훑어볼 때 사용합니다. 숫자는 계약 조건과 시점을 원문에서 다시 확인하세요.",
        publishedAt: null,
        rank: 1,
        fetchedAt,
      },
      {
        propertyId: args.propertyId,
        kind: "price",
        title: `${keyword} 시세 검색`,
        url: `https://www.google.com/search?q=${encoded} 아파트 시세`,
        source: "Google 검색",
        snippet: "시세·분양·입주 관련 기사와 중개업소 정보를 함께 확인할 때 사용합니다.",
        publishedAt: null,
        rank: 2,
        fetchedAt,
      },
      {
        propertyId: args.propertyId,
        kind: "location",
        title: `${keyword} 지도 검색`,
        url: `https://map.naver.com/v5/search/${encoded}`,
        source: "네이버 지도",
        snippet: "단지 위치와 주변 상권·교통을 지도에서 직접 확인할 때 사용합니다.",
        publishedAt: null,
        rank: 0,
        fetchedAt,
      },
      {
        propertyId: args.propertyId,
        kind: "location",
        title: `${keyword} 길찾기`,
        url: `https://map.kakao.com/?q=${encoded}`,
        source: "카카오맵",
        snippet: "출퇴근·통학 동선과 소요 시간을 잴 때 사용합니다.",
        publishedAt: null,
        rank: 1,
        fetchedAt,
      },
    ];

    // 주변 시설 좌표 (원본 로직 이식)
    const nearbyQueries: Array<{
      category: "transit" | "school" | "market" | "hospital";
      query: string;
      expectedCategory: string;
      expectedType: string;
    }> = [
      { category: "transit", query: "railway station", expectedCategory: "railway", expectedType: "station" },
      { category: "school", query: "school", expectedCategory: "amenity", expectedType: "school" },
      { category: "market", query: "supermarket", expectedCategory: "shop", expectedType: "supermarket" },
      { category: "hospital", query: "hospital", expectedCategory: "amenity", expectedType: "hospital" },
    ];
    const west = property.longitude - 0.025;
    const east = property.longitude + 0.025;
    const north = property.latitude + 0.02;
    const south = property.latitude - 0.02;
    const nearbyRows: Array<typeof schema.nearbyPlaces.$inferInsert> = [];
    let nearbyFetchSucceeded = true;
    for (const [index, item] of nearbyQueries.entries()) {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&countrycodes=kr&bounded=1&viewbox=${west},${north},${east},${south}&q=${encodeURIComponent(item.query)}`;
        const response = await fetch(url, { headers: { "User-Agent": "MuseRealEstateArtifact/1.0" } });
        if (!response.ok) throw new Error("nearby fetch failed");
        const parsed = nominatimSchema.safeParse(await response.json());
        if (!parsed.success) throw new Error("nearby parse failed");
        const matches = parsed.data
          .filter((place) => place.name && place.category === item.expectedCategory && place.type === item.expectedType)
          .map((place) => ({ place, lat: Number(place.lat), lng: Number(place.lon) }))
          .filter((entry) => Number.isFinite(entry.lat) && Number.isFinite(entry.lng))
          .map((entry) => ({
            propertyId: args.propertyId,
            category: item.category,
            name: entry.place.name ?? entry.place.display_name,
            address: entry.place.display_name,
            latitude: entry.lat,
            longitude: entry.lng,
            distanceM: Math.round(distanceMeters(property.latitude, property.longitude, entry.lat, entry.lng)),
            fetchedAt,
          }))
          .sort((a, b) => a.distanceM - b.distanceM)
          .slice(0, 3);
        nearbyRows.push(...matches);
        if (index < nearbyQueries.length - 1) await new Promise((resolve) => setTimeout(resolve, 1100));
      } catch {
        nearbyFetchSucceeded = false;
        break;
      }
    }

    await db.delete(schema.referenceResults).where(eq(schema.referenceResults.propertyId, args.propertyId));
    if (rows.length > 0) await db.insert(schema.referenceResults).values(rows);
    if (nearbyFetchSucceeded) {
      await db.delete(schema.nearbyPlaces).where(eq(schema.nearbyPlaces.propertyId, args.propertyId));
      if (nearbyRows.length > 0) await db.insert(schema.nearbyPlaces).values(nearbyRows);
    }

    const count = rows.length + nearbyRows.length;
    return {
      ok: true,
      count,
      message:
        count === 0
          ? "관련 자료를 찾지 못했습니다. 주소를 더 구체적으로 입력해 보세요."
          : nearbyFetchSucceeded
            ? null
            : "참고자료는 저장했지만 주변 시설 좌표는 이번에 불러오지 못했습니다.",
    };
  },
);
