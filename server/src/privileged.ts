import { definePrivilegedContracts, definePrivilegedHandlers, z } from "@hatch/space-sdk";

const detailedEndpoint = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev";
const fallbackEndpoint = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade";
const rentEndpoint = "https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent";

export const privileged = definePrivilegedContracts({
  fetchMolitApartmentTrades: {
    request: z.object({
      lawdCd: z.string().regex(/^\d{5}$/),
      dealYmd: z.string().regex(/^\d{6}$/),
      serviceKey: z.string().trim().min(10).max(500).optional(),
    }),
    response: z.object({
      status: z.enum(["ok", "not_configured", "error", "rate_limited"]),
      variant: z.enum(["detail", "basic"]).nullable(),
      xml: z.string(),
      message: z.string().nullable(),
    }),
    capabilities: ["network.fetch", "environment.read"],
    timeoutMs: 30000,
  },
  fetchMolitApartmentRents: {
    request: z.object({
      lawdCd: z.string().regex(/^\d{5}$/),
      dealYmd: z.string().regex(/^\d{6}$/),
      serviceKey: z.string().trim().min(10).max(500).optional(),
    }),
    response: z.object({
      status: z.enum(["ok", "not_configured", "error", "rate_limited"]),
      variant: z.enum(["detail", "basic"]).nullable(),
      xml: z.string(),
      message: z.string().nullable(),
    }),
    capabilities: ["network.fetch", "environment.read"],
    timeoutMs: 30000,
  },
});

function resultCode(xml: string): string {
  return xml.match(/<resultCode>([\s\S]*?)<\/resultCode>/i)?.[1]?.trim() ?? "";
}

function resultMessage(xml: string): string | null {
  return xml.match(/<(?:resultMsg|returnAuthMsg|errMsg)>([\s\S]*?)<\/(?:resultMsg|returnAuthMsg|errMsg)>/i)?.[1]?.trim() ?? null;
}

/**
 * data.go.kr publishes both an Encoding key and a Decoding key. An Encoding
 * key already contains `%HH` escapes and must be appended verbatim; a Decoding
 * key must be encoded exactly once. Constructing this parameter separately
 * prevents URLSearchParams from turning `%2B` into `%252B`.
 */
function serviceKeyQueryValue(value: string): string {
  const trimmed = value.trim();
  return /%[0-9a-f]{2}/i.test(trimmed) ? trimmed : encodeURIComponent(trimmed);
}

export const privilegedHandlers = definePrivilegedHandlers(privileged, {
  async fetchMolitApartmentTrades(args) {
    const configuredKey = args.serviceKey?.trim() || process.env.MOLIT_API_KEY || process.env.DATA_GO_KR_SERVICE_KEY;
    if (!configuredKey) return { status: "not_configured" as const, variant: null, xml: "", message: null };
    const encodedKey = serviceKeyQueryValue(configuredKey);

    const request = async (endpoint: string) => {
      const query = [
        `serviceKey=${encodedKey}`,
        `LAWD_CD=${encodeURIComponent(args.lawdCd)}`,
        `DEAL_YMD=${encodeURIComponent(args.dealYmd)}`,
        "pageNo=1",
        "numOfRows=1000",
      ].join("&");
      const response = await fetch(`${endpoint}?${query}`, {
        headers: { "User-Agent": "MuseRealEstateArtifact/1.0", Accept: "application/xml,text/xml,*/*" },
      });
      const xml = await response.text();
      const code = resultCode(xml);
      const hasValidEnvelope = ["0", "00", "000"].includes(code)
        || /<items(?:\s[^>]*)?>/i.test(xml)
        || /<totalCount>\s*0\s*<\/totalCount>/i.test(xml);
      return {
        httpStatus: response.status,
        xml,
        code,
        message: resultMessage(xml),
        valid: response.ok && hasValidEnvelope,
      };
    };

    try {
      const detail = await request(detailedEndpoint);
      if (detail.httpStatus === 429) return { status: "rate_limited" as const, variant: null, xml: "", message: "공공데이터포털 호출 한도에 도달했습니다." };
      if (detail.valid) return { status: "ok" as const, variant: "detail" as const, xml: detail.xml, message: null };

      const basic = await request(fallbackEndpoint);
      if (basic.httpStatus === 429) return { status: "rate_limited" as const, variant: null, xml: "", message: "공공데이터포털 호출 한도에 도달했습니다." };
      if (basic.valid) return { status: "ok" as const, variant: "basic" as const, xml: basic.xml, message: null };

      const rejected = [detail, basic].find((item) => item.httpStatus === 401 || item.httpStatus === 403);
      if (rejected) {
        return { status: "error" as const, variant: null, xml: "", message: "인증키는 전달됐지만 이 실거래 API의 활용승인을 확인하지 못했습니다. 공공데이터포털 활용신청 상태를 확인해 주세요." };
      }
      const upstreamMessage = basic.message ?? detail.message;
      return {
        status: "error" as const,
        variant: null,
        xml: "",
        message: upstreamMessage ? `공공데이터포털 응답: ${upstreamMessage}` : "국토교통부 실거래가 API가 응답하지 않았습니다. 잠시 후 다시 시도해 주세요.",
      };
    } catch {
      return { status: "error" as const, variant: null, xml: "", message: "국토교통부 실거래가 API에 연결하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요." };
    }
  },

  async fetchMolitApartmentRents(args) {
    const configuredKey = args.serviceKey?.trim() || process.env.MOLIT_API_KEY || process.env.DATA_GO_KR_SERVICE_KEY;
    if (!configuredKey) return { status: "not_configured" as const, variant: null, xml: "", message: null };
    const encodedKey = serviceKeyQueryValue(configuredKey);

    const request = async (endpoint: string) => {
      const query = [
        `serviceKey=${encodedKey}`,
        `LAWD_CD=${encodeURIComponent(args.lawdCd)}`,
        `DEAL_YMD=${encodeURIComponent(args.dealYmd)}`,
        "pageNo=1",
        "numOfRows=1000",
      ].join("&");
      const response = await fetch(`${endpoint}?${query}`, {
        headers: { "User-Agent": "MuseRealEstateArtifact/1.0", Accept: "application/xml,text/xml,*/*" },
      });
      const xml = await response.text();
      const code = resultCode(xml);
      const hasValidEnvelope = ["0", "00", "000"].includes(code)
        || /<items(?:\s[^>]*)?>/i.test(xml)
        || /<totalCount>\s*0\s*<\/totalCount>/i.test(xml);
      return {
        httpStatus: response.status,
        xml,
        code,
        message: resultMessage(xml),
        valid: response.ok && hasValidEnvelope,
      };
    };

    try {
      const rent = await request(rentEndpoint);
      if (rent.httpStatus === 429) return { status: "rate_limited" as const, variant: null, xml: "", message: "공공데이터포털 호출 한도에 도달했습니다." };
      if (rent.valid) return { status: "ok" as const, variant: "detail" as const, xml: rent.xml, message: null };

      if (rent.httpStatus === 401 || rent.httpStatus === 403) {
        return { status: "error" as const, variant: null, xml: "", message: "인증키는 전달됐지만 이 전월세 실거래 API의 활용승인을 확인하지 못했습니다. 공공데이터포털 활용신청 상태를 확인해 주세요." };
      }
      return {
        status: "error" as const,
        variant: null,
        xml: "",
        message: rent.message ? `공공데이터포털 응답: ${rent.message}` : "국토교통부 전월세 실거래가 API가 응답하지 않았습니다. 잠시 후 다시 시도해 주세요.",
      };
    } catch {
      return { status: "error" as const, variant: null, xml: "", message: "국토교통부 전월세 실거래가 API에 연결하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요." };
    }
  },
});
