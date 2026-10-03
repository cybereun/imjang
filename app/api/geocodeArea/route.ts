import { z } from "zod";
import { defineRoute } from "@/lib/route";
import { nominatimSchema } from "@/lib/helpers";
import { resolveRegion } from "@/lib/regions";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({ query: z.string().trim().min(2).max(100) }),
  async (args) => {
    try {
      const localityParts = args.query.trim().split(/\s+/).filter(Boolean).reverse();
      const query = `${localityParts.join(", ")}, 대한민국`;
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=kr&q=${encodeURIComponent(query)}`;
      const response = await fetch(url, { headers: { "User-Agent": "MuseRealEstateArtifact/1.0" } });
      if (!response.ok) return { ok: false, message: "지역 검색 서비스에 연결하지 못했습니다.", candidates: [] };
      const parsed = nominatimSchema.safeParse(await response.json());
      if (!parsed.success) return { ok: false, message: "지역 검색 결과를 읽지 못했습니다.", candidates: [] };
      const candidates = parsed.data.flatMap((item) => {
        const latitude = Number(item.lat);
        const longitude = Number(item.lon);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
        const raw = item.boundingbox;
        const parsedBounds = raw ? raw.map(Number) : [];
        const bounds: [number, number, number, number] | null = parsedBounds.length === 4 && parsedBounds.every(Number.isFinite)
          ? [parsedBounds[0] ?? latitude, parsedBounds[1] ?? latitude, parsedBounds[2] ?? longitude, parsedBounds[3] ?? longitude]
          : null;
        const region = resolveRegion(args.query, item.display_name);
        return [{ id: String(item.place_id), label: item.display_name, latitude, longitude, bounds, lawdCd: region?.code ?? null, regionName: region?.name ?? null }];
      });
      return { ok: true, message: candidates.length === 0 ? "검색 결과가 없습니다. 시·구 이름을 확인해 주세요." : null, candidates };
    } catch {
      return { ok: false, message: "지역 검색 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.", candidates: [] };
    }
  },
);
