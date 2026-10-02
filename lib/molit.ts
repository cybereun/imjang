// 국토교통부 실거래가 API 호출 (호스티드 버전 privileged.ts 포팅).
// Vercel에서는 Route Handler에서 직접 호출하므로 별도 권한 래퍼가 필요 없습니다.
// 인증키는 MOLIT_API_KEY 환경변수를 우선 사용하고, 호출 시 serviceKey로 덮어쓸 수 있습니다.

const detailedEndpoint =
  "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev";
const fallbackEndpoint =
  "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade";
const rentEndpoint =
  "https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent";

export type MolitResult = {
  status: "ok" | "not_configured" | "error" | "rate_limited";
  variant: "detail" | "basic" | null;
  xml: string;
  message: string | null;
};

function resultCode(xml: string): string {
  return xml.match(/<resultCode>([\s\S]*?)<\/resultCode>/i)?.[1]?.trim() ?? "";
}

function resultMessage(xml: string): string | null {
  return (
    xml
      .match(/<(?:resultMsg|returnAuthMsg|errMsg)>([\s\S]*?)<\/(?:resultMsg|returnAuthMsg|errMsg)>/i)?.[1]
      ?.trim() ?? null
  );
}

/**
 * data.go.kr은 Encoding 키와 Decoding 키를 모두 발급합니다. Encoding 키는
 * 이미 %HH 이스케이프를 포함하므로 그대로 붙이고, Decoding 키는 한 번만
 * 인코딩합니다. %2B가 %252B로 바뀌지 않게 별도로 처리합니다.
 */
function serviceKeyQueryValue(value: string): string {
  const trimmed = value.trim();
  return /%[0-9a-f]{2}/i.test(trimmed) ? trimmed : encodeURIComponent(trimmed);
}

function resolveKey(serviceKey?: string): string | null {
  return (
    serviceKey?.trim() ||
    process.env.MOLIT_API_KEY ||
    process.env.DATA_GO_KR_SERVICE_KEY ||
    null
  );
}

type FetchOutcome = {
  httpStatus: number;
  xml: string;
  code: string;
  message: string | null;
  valid: boolean;
};

async function requestMolit(
  endpoint: string,
  lawdCd: string,
  dealYmd: string,
  encodedKey: string,
): Promise<FetchOutcome> {
  const query = [
    `serviceKey=${encodedKey}`,
    `LAWD_CD=${encodeURIComponent(lawdCd)}`,
    `DEAL_YMD=${encodeURIComponent(dealYmd)}`,
    "pageNo=1",
    "numOfRows=1000",
  ].join("&");
  const response = await fetch(`${endpoint}?${query}`, {
    headers: {
      "User-Agent": "ImjangVercel/1.0",
      Accept: "application/xml,text/xml,*/*",
    },
  });
  const xml = await response.text();
  const code = resultCode(xml);
  const hasValidEnvelope =
    ["0", "00", "000"].includes(code) ||
    /<items(?:\s[^>]*)?>/i.test(xml) ||
    /<totalCount>\s*0\s*<\/totalCount>/i.test(xml);
  return {
    httpStatus: response.status,
    xml,
    code,
    message: resultMessage(xml),
    valid: response.ok && hasValidEnvelope,
  };
}

export async function fetchMolitApartmentTrades(args: {
  lawdCd: string;
  dealYmd: string;
  serviceKey?: string;
}): Promise<MolitResult> {
  const configuredKey = resolveKey(args.serviceKey);
  if (!configuredKey)
    return { status: "not_configured", variant: null, xml: "", message: null };
  const encodedKey = serviceKeyQueryValue(configuredKey);

  try {
    const detail = await requestMolit(
      detailedEndpoint,
      args.lawdCd,
      args.dealYmd,
      encodedKey,
    );
    if (detail.httpStatus === 429)
      return {
        status: "rate_limited",
        variant: null,
        xml: "",
        message: "공공데이터포털 호출 한도에 도달했습니다.",
      };
    if (detail.valid)
      return { status: "ok", variant: "detail", xml: detail.xml, message: null };

    const basic = await requestMolit(
      fallbackEndpoint,
      args.lawdCd,
      args.dealYmd,
      encodedKey,
    );
    if (basic.httpStatus === 429)
      return {
        status: "rate_limited",
        variant: null,
        xml: "",
        message: "공공데이터포털 호출 한도에 도달했습니다.",
      };
    if (basic.valid)
      return { status: "ok", variant: "basic", xml: basic.xml, message: null };

    const rejected = [detail, basic].find(
      (item) => item.httpStatus === 401 || item.httpStatus === 403,
    );
    if (rejected) {
      return {
        status: "error",
        variant: null,
        xml: "",
        message:
          "인증키는 전달됐지만 이 실거래 API의 활용승인을 확인하지 못했습니다. 공공데이터포털 활용신청 상태를 확인해 주세요.",
      };
    }
    const upstreamMessage = basic.message ?? detail.message;
    return {
      status: "error",
      variant: null,
      xml: "",
      message: upstreamMessage
        ? `공공데이터포털 응답: ${upstreamMessage}`
        : "국토교통부 실거래가 API가 응답하지 않았습니다. 잠시 후 다시 시도해 주세요.",
    };
  } catch {
    return {
      status: "error",
      variant: null,
      xml: "",
      message:
        "국토교통부 실거래가 API에 연결하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
    };
  }
}

export async function fetchMolitApartmentRents(args: {
  lawdCd: string;
  dealYmd: string;
  serviceKey?: string;
}): Promise<MolitResult> {
  const configuredKey = resolveKey(args.serviceKey);
  if (!configuredKey)
    return { status: "not_configured", variant: null, xml: "", message: null };
  const encodedKey = serviceKeyQueryValue(configuredKey);

  try {
    const rent = await requestMolit(
      rentEndpoint,
      args.lawdCd,
      args.dealYmd,
      encodedKey,
    );
    if (rent.httpStatus === 429)
      return {
        status: "rate_limited",
        variant: null,
        xml: "",
        message: "공공데이터포털 호출 한도에 도달했습니다.",
      };
    if (rent.valid)
      return { status: "ok", variant: "detail", xml: rent.xml, message: null };

    if (rent.httpStatus === 401 || rent.httpStatus === 403) {
      return {
        status: "error",
        variant: null,
        xml: "",
        message:
          "인증키는 전달됐지만 이 전월세 실거래 API의 활용승인을 확인하지 못했습니다. 공공데이터포털 활용신청 상태를 확인해 주세요.",
      };
    }
    return {
      status: "error",
      variant: null,
      xml: "",
      message: rent.message
        ? `공공데이터포털 응답: ${rent.message}`
        : "국토교통부 전월세 실거래가 API가 응답하지 않았습니다. 잠시 후 다시 시도해 주세요.",
    };
  } catch {
    return {
      status: "error",
      variant: null,
      xml: "",
      message:
        "국토교통부 전월세 실거래가 API에 연결하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
    };
  }
}
