import { z } from "zod";
import { defineRoute } from "@/lib/route";
import { fetchMolitApartmentTrades, fetchMolitApartmentRents } from "@/lib/molit";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  z.object({ serviceKey: z.string().trim().min(10).max(500).optional() }),
  async (args) => {
    const date = new Date();
    date.setUTCMonth(date.getUTCMonth() - 1);
    const dealYmd = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const result = await fetchMolitApartmentTrades({
      lawdCd: "11680",
      dealYmd,
      serviceKey: args.serviceKey,
    });
    if (result.status === "ok") {
      const rent = await fetchMolitApartmentRents({
        lawdCd: "11680",
        dealYmd,
        serviceKey: args.serviceKey,
      });
      const rentAvailable = rent.status === "ok";
      const baseMessage = result.variant === "detail"
        ? "아파트 매매 실거래 API 연결을 확인했습니다."
        : "기본 실거래 API 연결을 확인했습니다. 상세 API 활용신청 상태를 확인해 주세요.";
      return {
        status: "ok" as const,
        message: rentAvailable
          ? `${baseMessage} 전월세 실거래 API도 같은 인증키로 연결됩니다.`
          : `${baseMessage} 전월세 실거래 API는 연결되지 않았습니다. 공공데이터포털에서 '아파트 전월세 실거래가' API의 활용신청 상태를 확인해 주세요.`,
        variant: result.variant,
        rentAvailable,
      };
    }
    if (result.status === "not_configured") return { status: "not_configured" as const, message: "인증키를 입력해 주세요.", variant: null, rentAvailable: false };
    if (result.status === "rate_limited") return { status: "rate_limited" as const, message: "공공데이터포털 호출 한도에 도달했습니다.", variant: null, rentAvailable: false };
    return { status: "error" as const, message: result.message ?? "인증키 또는 활용신청 상태를 확인해 주세요.", variant: null, rentAvailable: false };
  },
);
