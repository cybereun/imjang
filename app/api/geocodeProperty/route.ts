import { z } from "zod";
import { defineRoute } from "@/lib/route";

export const dynamic = "force-dynamic";

// 원본 nominatimSchema를 그대로 포팅
const nominatimSchema = z.array(
  z.object({
    place_id: z.number(),
    lat: z.string(),
    lon: z.string(),
    name: z.string().optional(),
    display_name: z.string(),
    category: z.string().optional(),
    type: z.string().optional(),
    boundingbox: z.array(z.string()).length(4).optional(),
  }),
);

export const POST = defineRoute(
  z.object({ query: z.string().trim().min(4).max(200) }),
  async (args) => {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3&countrycodes=kr&q=${encodeURIComponent(args.query)}`;
      const response = await fetch(url, {
        headers: { "User-Agent": "MuseRealEstateArtifact/1.0" },
      });
      if (!response.ok) {
        return { ok: false, message: "주소 검색 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.", candidates: [] };
      }
      const parsed = nominatimSchema.safeParse(await response.json());
      if (!parsed.success) {
        return { ok: false, message: "주소 검색 결과를 읽지 못했습니다.", candidates: [] };
      }
      const candidates = parsed.data
        .map((item) => ({
          id: String(item.place_id),
          label: item.display_name,
          name: item.name ?? null,
          latitude: Number(item.lat),
          longitude: Number(item.lon),
          type: item.type ?? item.category ?? null,
        }))
        .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
      return {
        ok: true,
        message: candidates.length === 0 ? "검색 결과가 없습니다. 도로명과 건물 번호를 함께 입력해 주세요." : null,
        candidates,
      };
    } catch {
      return { ok: false, message: "주소 검색 중 문제가 생겼습니다. 입력을 확인하고 다시 시도해 주세요.", candidates: [] };
    }
  },
);
