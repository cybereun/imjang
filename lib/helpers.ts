/**
 * B 그룹 서버 액션 포팅용 공유 헬퍼.
 * space-2/server/src/actions.ts의 B 그룹 액션들이 사용하는 zod 스키마·상수·
 * 직렬화(serialize) 헬퍼·국토부 XML 파싱·관심단지 시세 로직을 그대로 옮긴 것입니다.
 * 호스티드 전용 SDK 의존성은 제거되고, ctx 대신 Db 인스턴스를 받습니다.
 */
import { z } from "zod";
import { and, asc, desc, eq, inArray, isNull, like, lte } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { Db } from "@/lib/db";
import { resolveRegion } from "@/lib/regions";
import { fetchMolitApartmentTrades, fetchMolitApartmentRents } from "@/lib/molit";

// ---------------- zod response 스키마 (원본 그대로) ----------------

export const officialTransactionSchema = z.object({
  id: z.number(),
  lawdCd: z.string(),
  regionLabel: z.string(),
  dealYmd: z.string(),
  apartmentName: z.string(),
  legalDong: z.string(),
  jibun: z.string().nullable(),
  roadAddress: z.string().nullable(),
  areaSqm: z.number(),
  floor: z.number().nullable(),
  dealAmountMan: z.number(),
  buildYear: z.number().nullable(),
  dealingType: z.string().nullable(),
  registrationDate: z.string().nullable(),
  buyerType: z.string().nullable(),
  sellerType: z.string().nullable(),
  estateAgentDistrict: z.string().nullable(),
  apartmentDong: z.string().nullable(),
  landLeasehold: z.string().nullable(),
  apiVariant: z.enum(["detail", "basic"]),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  fetchedAt: z.string(),
});

export const officialRentTransactionSchema = z.object({
  id: z.number(),
  lawdCd: z.string(),
  regionLabel: z.string(),
  dealYmd: z.string(),
  apartmentName: z.string(),
  legalDong: z.string(),
  jibun: z.string().nullable(),
  roadAddress: z.string().nullable(),
  areaSqm: z.number(),
  floor: z.number().nullable(),
  rentKind: z.enum(["jeonse", "wolse"]),
  depositMan: z.number(),
  monthlyRentMan: z.number(),
  contractTerm: z.string().nullable(),
  buildYear: z.number().nullable(),
  estateAgentDistrict: z.string().nullable(),
  apartmentDong: z.string().nullable(),
  landLeasehold: z.string().nullable(),
  apiVariant: z.enum(["detail", "basic"]),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  fetchedAt: z.string(),
});

export const nearbyApartmentSchema = z.object({
  apartmentName: z.string(),
  legalDong: z.string(),
  roadAddress: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  distanceKm: z.number(),
  latestDealYmd: z.string(),
  latestPriceMan: z.number(),
  latestAreaSqm: z.number(),
  latestFloor: z.number().nullable(),
  medianPriceMan: z.number().nullable(),
  tradeCount: z.number(),
  fetchedAt: z.string(),
});

export const nearbySavedPropertySchema = z.object({
  id: z.number(),
  name: z.string(),
  address: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  distanceKm: z.number(),
  areaSqm: z.number(),
  askingPriceMan: z.number(),
});

export const watchItemSchema = z.object({
  id: z.number(),
  lawdCd: z.string(),
  regionLabel: z.string(),
  complexName: z.string(),
  areaSqm: z.number(),
  areaToleranceSqm: z.number(),
  active: z.boolean(),
  dropAlertPct: z.number(),
  targetPriceMan: z.number().nullable(),
  bargainBelowMan: z.number().nullable(),
  notes: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const watchListItemSchema = watchItemSchema.extend({
  latest: z.object({
    month: z.string(),
    avgMan: z.number(),
    tradeCount: z.number(),
    prevMonth: z.string().nullable(),
    prevAvgMan: z.number().nullable(),
    changePct: z.number().nullable(),
  }).nullable(),
  latestRent: z.object({
    month: z.string(),
    jeonseMedianMan: z.number().nullable(),
    jeonseCount: z.number(),
    wolseMedianMan: z.number().nullable(),
    wolseAvgMonthlyMan: z.number().nullable(),
    wolseCount: z.number(),
  }).nullable(),
  unreadAlerts: z.number(),
  lastRun: z.object({
    status: z.enum(["ok", "needs_key", "rate_limited", "error", "skipped"]),
    createdAt: z.string(),
    message: z.string().nullable(),
    newTrades: z.number(),
    alertsCreated: z.number(),
  }).nullable(),
});

export const watchSeriesSchema = z.object({
  watchId: z.number(),
  month: z.string(),
  avgPriceMan: z.number().nullable(),
  medianPriceMan: z.number().nullable(),
  minPriceMan: z.number().nullable(),
  maxPriceMan: z.number().nullable(),
  tradeCount: z.number(),
  fetchedAt: z.string(),
});

export const watchRentSeriesSchema = z.object({
  watchId: z.number(),
  month: z.string(),
  jeonseAvgMan: z.number().nullable(),
  jeonseMedianMan: z.number().nullable(),
  jeonseMinMan: z.number().nullable(),
  jeonseMaxMan: z.number().nullable(),
  jeonseCount: z.number(),
  wolseAvgMan: z.number().nullable(),
  wolseMedianMan: z.number().nullable(),
  wolseAvgMonthlyMan: z.number().nullable(),
  wolseCount: z.number(),
  fetchedAt: z.string(),
});

export const watchAskRecordSchema = z.object({
  id: z.number(),
  watchId: z.number(),
  amountMan: z.number(),
  source: z.string(),
  note: z.string(),
  recordedAt: z.string(),
});

export const priceAlertSchema = z.object({
  id: z.number(),
  watchId: z.number(),
  type: z.enum(["price_drop", "target_reached", "bargain"]),
  title: z.string(),
  detail: z.string(),
  month: z.string().nullable(),
  triggerValueMan: z.number().nullable(),
  baselineValueMan: z.number().nullable(),
  changePct: z.number().nullable(),
  sourceUrl: z.string(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
});

export const priceAlertWithWatchSchema = priceAlertSchema.extend({
  watchComplex: z.string(),
  watchLabel: z.string(),
});

export const watchCheckRunSchema = z.object({
  id: z.number(),
  watchId: z.number(),
  status: z.enum(["ok", "needs_key", "rate_limited", "error", "skipped"]),
  monthsChecked: z.string(),
  newTrades: z.number(),
  alertsCreated: z.number(),
  message: z.string().nullable(),
  createdAt: z.string(),
});

export const listingTradeTypeSchema = z.enum(["sale", "jeonse", "wolse"]);
export const listingStatusSchema = z.enum(["active", "hold", "done", "closed"]);

export const listingSchema = z.object({
  id: z.number(),
  propertyId: z.number(),
  brokerName: z.string(),
  brokerContact: z.string(),
  dong: z.string(),
  ho: z.string(),
  areaSqm: z.number().nullable(),
  tradeType: listingTradeTypeSchema,
  priceMan: z.number(),
  monthlyRentMan: z.number().nullable(),
  targetPriceMan: z.number().nullable(),
  listingUrl: z.string().nullable(),
  status: listingStatusSchema,
  memo: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const listingPriceLogSchema = z.object({
  id: z.number(),
  listingId: z.number(),
  priceMan: z.number(),
  monthlyRentMan: z.number().nullable(),
  note: z.string(),
  sourceNote: z.string(),
  recordedAt: z.string(),
});

export const listingSummarySchema = listingSchema.extend({
  firstPriceMan: z.number().nullable(),
  priceChangeMan: z.number().nullable(),
  logCount: z.number(),
});

export const courseStopPropertySchema = z.object({
  id: z.number(),
  name: z.string(),
  address: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});

export const courseStopSchema = z.object({
  id: z.number(),
  position: z.number(),
  property: courseStopPropertySchema,
  memo: z.string(),
  completed: z.boolean(),
  legFromPrevious: z.object({ distanceM: z.number(), walkMinutes: z.number() }).nullable(),
  revisitOpenCount: z.number(),
  checklistDone: z.number(),
  checklistTotal: z.number(),
  updatedAt: z.string(),
});

export const courseSchema = z.object({
  id: z.number(),
  title: z.string(),
  visitDate: z.string().nullable(),
  notes: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const courseListItemSchema = courseSchema.extend({
  stopCount: z.number(),
  completedCount: z.number(),
  totalDistanceM: z.number(),
  totalWalkMinutes: z.number(),
});

export const courseDetailSchema = z.object({
  course: courseSchema.nullable(),
  stops: z.array(courseStopSchema),
  totalDistanceM: z.number(),
  totalWalkMinutes: z.number(),
  walkAssumption: z.literal("직선거리 기준 · 도보 시속 4km 가정"),
});

export const nominatimSchema = z.array(
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

export const visitDateField = z.string().nullable().refine(
  (value) => value === null || value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value),
  { message: "방문일을 YYYY-MM-DD 형식으로 입력하세요." },
);

// ---------------- 상수 (원본 그대로) ----------------

export const OFFICIAL_SOURCE_URL = "https://www.data.go.kr/data/15126469/openapi.do";
export const OFFICIAL_RENT_SOURCE_URL = "https://www.data.go.kr/data/15126474/openapi.do";
export const OFFICIAL_WATCH_SOURCE_URL = OFFICIAL_SOURCE_URL;

export const AUTO_CHECK_ENABLED_KEY = "watch.auto_check_enabled";
export const MOLIT_SERVICE_KEY_SETTING_KEY = "molit.service_key";
export const VWORLD_API_KEY_SETTING_KEY = "vworld.api_key";

export const CHECKLIST_ITEMS: ReadonlyArray<readonly [string, string]> = [
  ["entrance", "단지 진입 동선"], ["noise", "도로·생활 소음"], ["slope", "경사와 보행 환경"],
  ["parking", "주차 여유"], ["hall", "현관·복도 관리"], ["elevator", "엘리베이터 상태"],
  ["sunlight", "채광·향"], ["ventilation", "환기·냄새"], ["water", "수압·누수 흔적"], ["layout", "동선·수납"],
  ["transit", "대중교통 접근"], ["groceries", "장보기·생활상권"], ["school", "학교·돌봄 동선"],
];

const WALK_METERS_PER_MINUTE = 4000 / 60;

// ---------------- 순수 헬퍼 (원본 그대로) ----------------

export function xmlDecode(value: string): string {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").trim();
}

export function xmlTag(block: string, ...names: string[]): string | null {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, "i"));
    if (match?.[1] !== undefined) return xmlDecode(match[1]);
  }
  return null;
}

export function parseNumber(value: string | null): number | null {
  if (!value) return null;
  const number = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(number) ? number : null;
}

export function transactionAddress(regionLabel: string, block: string, legalDong: string, jibun: string | null): string {
  const road = xmlTag(block, "roadNm", "도로명");
  const main = xmlTag(block, "roadNmBonbun", "도로명건물본번호코드");
  const sub = xmlTag(block, "roadNmBubun", "도로명건물부번호코드");
  if (road && main && Number(main) > 0) {
    const number = `${Number(main)}${sub && Number(sub) > 0 ? `-${Number(sub)}` : ""}`;
    return `${regionLabel} ${road} ${number}`;
  }
  return [regionLabel, legalDong, jibun].filter(Boolean).join(" ");
}

export function serializeOfficialTransaction(row: typeof schema.officialTransactions.$inferSelect): z.infer<typeof officialTransactionSchema> {
  return {
    id: row.id,
    lawdCd: row.lawdCd,
    regionLabel: row.regionLabel,
    dealYmd: row.dealYmd,
    apartmentName: row.apartmentName,
    legalDong: row.legalDong,
    jibun: row.jibun,
    roadAddress: row.roadAddress,
    areaSqm: row.areaSqm,
    floor: row.floor,
    dealAmountMan: row.dealAmountMan,
    buildYear: row.buildYear,
    dealingType: row.dealingType,
    registrationDate: row.registrationDate,
    buyerType: row.buyerType,
    sellerType: row.sellerType,
    estateAgentDistrict: row.estateAgentDistrict,
    apartmentDong: row.apartmentDong,
    landLeasehold: row.landLeasehold,
    apiVariant: row.apiVariant,
    latitude: row.latitude,
    longitude: row.longitude,
    fetchedAt: row.fetchedAt.toISOString(),
  } as z.infer<typeof officialTransactionSchema>;
}

export function serializeOfficialRentTransaction(row: typeof schema.officialRentTransactions.$inferSelect): z.infer<typeof officialRentTransactionSchema> {
  return {
    id: row.id,
    lawdCd: row.lawdCd,
    regionLabel: row.regionLabel,
    dealYmd: row.dealYmd,
    apartmentName: row.apartmentName,
    legalDong: row.legalDong,
    jibun: row.jibun,
    roadAddress: row.roadAddress,
    areaSqm: row.areaSqm,
    floor: row.floor,
    rentKind: row.monthlyRentMan > 0 ? "wolse" : "jeonse",
    depositMan: row.depositMan,
    monthlyRentMan: row.monthlyRentMan,
    contractTerm: row.contractTerm,
    buildYear: row.buildYear,
    estateAgentDistrict: row.estateAgentDistrict,
    apartmentDong: row.apartmentDong,
    landLeasehold: row.landLeasehold,
    apiVariant: row.apiVariant as "detail" | "basic",
    latitude: row.latitude,
    longitude: row.longitude,
    fetchedAt: row.fetchedAt.toISOString(),
  };
}

export function serializeWatchItem(row: typeof schema.watchItems.$inferSelect): z.infer<typeof watchItemSchema> {
  return {
    id: row.id,
    lawdCd: row.lawdCd,
    regionLabel: row.regionLabel,
    complexName: row.complexName,
    areaSqm: row.areaSqm,
    areaToleranceSqm: row.areaToleranceSqm,
    active: row.active,
    dropAlertPct: row.dropAlertPct,
    targetPriceMan: row.targetPriceMan,
    bargainBelowMan: row.bargainBelowMan,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializePriceAlert(row: typeof schema.priceAlerts.$inferSelect): z.infer<typeof priceAlertSchema> {
  return {
    id: row.id,
    watchId: row.watchId,
    type: row.type as "price_drop" | "target_reached" | "bargain",
    title: row.title,
    detail: row.detail,
    month: row.month,
    triggerValueMan: row.triggerValueMan,
    baselineValueMan: row.baselineValueMan,
    changePct: row.changePct,
    sourceUrl: row.sourceUrl,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt === null ? null : row.readAt.toISOString(),
  };
}

export function serializeWatchCheckRun(row: typeof schema.watchCheckRuns.$inferSelect): z.infer<typeof watchCheckRunSchema> {
  return {
    id: row.id,
    watchId: row.watchId,
    status: row.status as "ok" | "needs_key" | "rate_limited" | "error" | "skipped",
    monthsChecked: row.monthsChecked,
    newTrades: row.newTrades,
    alertsCreated: row.alertsCreated,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeCourse(row: typeof schema.tourCourses.$inferSelect): z.infer<typeof courseSchema> {
  return {
    id: row.id,
    title: row.title,
    visitDate: row.visitDate,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeListing(row: typeof schema.listings.$inferSelect): z.infer<typeof listingSchema> {
  return {
    id: row.id,
    propertyId: row.propertyId,
    brokerName: row.brokerName,
    brokerContact: row.brokerContact,
    dong: row.dong,
    ho: row.ho,
    areaSqm: row.areaSqm,
    tradeType: row.tradeType as "sale" | "jeonse" | "wolse",
    priceMan: row.priceMan,
    monthlyRentMan: row.monthlyRentMan,
    targetPriceMan: row.targetPriceMan,
    listingUrl: row.listingUrl,
    status: row.status as "active" | "hold" | "done" | "closed",
    memo: row.memo,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function maskServiceKey(value: string): string {
  return value.length >= 10 ? `${value.slice(0, 4)}••••${value.slice(-4)}` : "••••";
}

export function currentKstMonthKey(): string {
  const shifted = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function monthKeys(count: number): string[] {
  const [rawYear = 1970, rawMonth = 1] = currentKstMonthKey().split("-").map(Number);
  const keys: string[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    const date = new Date(Date.UTC(rawYear, rawMonth - 1 - offset, 1));
    keys.push(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

export function monthLabel(month: string): string {
  const [year, mon] = month.split("-");
  if (!year || !mon) return month;
  return `${year}년 ${Number(mon)}월`;
}

export function formatMoneyMan(value: number): string {
  if (value >= 10000) {
    const eok = Math.floor(value / 10000);
    const man = value % 10000;
    return man === 0 ? `${eok}억 원` : `${eok}억 ${man.toLocaleString("ko-KR")}만 원`;
  }
  return `${value.toLocaleString("ko-KR")}만 원`;
}

export function medianOf(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid] ?? 0;
  if (sorted.length % 2 === 1) return Math.round(upper);
  const lower = sorted[mid - 1] ?? upper;
  return Math.round((lower + upper) / 2);
}

// 저장된 매물 주소에서 시·군·구 법정동 코드(LAWD_CD)를 확인한다. 원래 입력 주소는
// '대구광역시 수성구 명덕로 455'처럼 자연 순서라 직접 매칭되고, Nominatim 확인 주소는
// '수성구, 대구광역시'처럼 행정 단위 순서가 뒤집혀 있어 원래 순서로 복귀한 뒤에도 확인한다.
export function resolveLawdCdFromProperty(
  property: { address: string | null | undefined; resolvedAddress: string | null | undefined },
  explicit: string | null,
): string | null {
  if (explicit) return explicit;
  const direct = resolveRegion(property.address ?? "") ?? resolveRegion(property.resolvedAddress ?? "");
  if (direct) return direct.code;
  for (const candidate of [property.address, property.resolvedAddress]) {
    const parts = (candidate ?? "").split(",").map((part) => part.trim()).filter((part) => part.length > 0);
    if (parts.length < 2) continue;
    const reversed = resolveRegion(parts.reverse().join(" "));
    if (reversed) return reversed.code;
  }
  return null;
}

export function parseMolitTradeRows(
  xml: string,
  lawdCd: string,
  regionLabel: string,
  apiVariant: "detail" | "basic",
  fetchedAt: Date,
): Array<typeof schema.officialTransactions.$inferInsert> {
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  const parsedRows: Array<typeof schema.officialTransactions.$inferInsert> = [];
  for (const block of blocks) {
    if ((xmlTag(block, "cdealType", "해제여부") ?? "").toUpperCase() === "O") continue;
    const apartmentName = xmlTag(block, "aptNm", "아파트") ?? "";
    const legalDong = xmlTag(block, "umdNm", "법정동") ?? "";
    const jibun = xmlTag(block, "jibun", "지번");
    const areaSqm = parseNumber(xmlTag(block, "excluUseAr", "전용면적"));
    const dealAmountMan = parseNumber(xmlTag(block, "dealAmount", "거래금액"));
    const year = parseNumber(xmlTag(block, "dealYear", "년"));
    const month = parseNumber(xmlTag(block, "dealMonth", "월"));
    const day = parseNumber(xmlTag(block, "dealDay", "일"));
    if (!apartmentName || !legalDong || areaSqm === null || areaSqm <= 0 || dealAmountMan === null || dealAmountMan < 0 || year === null || month === null || day === null) continue;
    const dealYmd = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const roadAddress = transactionAddress(regionLabel, block, legalDong, jibun);
    const floor = parseNumber(xmlTag(block, "floor", "층"));
    const buildYear = parseNumber(xmlTag(block, "buildYear", "건축년도"));
    const dealingType = xmlTag(block, "dealingGbn", "거래유형");
    const registrationDate = xmlTag(block, "rgstDate", "등기일자");
    const buyerType = xmlTag(block, "buyerGbn", "매수자");
    const sellerType = xmlTag(block, "slerGbn", "매도자");
    const estateAgentDistrict = xmlTag(block, "estateAgentSggNm", "중개사소재지");
    const apartmentDong = xmlTag(block, "aptDong", "아파트동");
    const landLeasehold = xmlTag(block, "landLeaseholdGbn", "토지임대부아파트여부");
    const fingerprint = [lawdCd, dealYmd, apartmentName, areaSqm, floor ?? "", dealAmountMan, jibun ?? ""].join("|");
    parsedRows.push({ fingerprint, lawdCd, regionLabel, dealYmd, apartmentName, legalDong, jibun, roadAddress, areaSqm, floor, dealAmountMan, buildYear, dealingType, registrationDate, buyerType, sellerType, estateAgentDistrict, apartmentDong, landLeasehold, apiVariant, latitude: null, longitude: null, fetchedAt });
  }
  return parsedRows;
}

export function parseMolitRentRows(
  xml: string,
  lawdCd: string,
  regionLabel: string,
  apiVariant: "detail" | "basic",
  fetchedAt: Date,
): Array<typeof schema.officialRentTransactions.$inferInsert> {
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  const parsedRows: Array<typeof schema.officialRentTransactions.$inferInsert> = [];
  for (const block of blocks) {
    if ((xmlTag(block, "cdealType", "해제여부") ?? "").toUpperCase() === "O") continue;
    const apartmentName = xmlTag(block, "aptNm", "아파트") ?? "";
    const legalDong = xmlTag(block, "umdNm", "법정동") ?? "";
    const jibun = xmlTag(block, "jibun", "지번");
    const areaSqm = parseNumber(xmlTag(block, "excluUseAr", "전용면적"));
    const depositMan = parseNumber(xmlTag(block, "deposit", "보증금"));
    const monthlyRentMan = parseNumber(xmlTag(block, "monthlyRent", "월세", "monthlyrent"));
    const year = parseNumber(xmlTag(block, "dealYear", "년"));
    const month = parseNumber(xmlTag(block, "dealMonth", "월"));
    const day = parseNumber(xmlTag(block, "dealDay", "일"));
    // 전월세 실거래 '월세'가 0이면 전세다. 보증금·월세는 매매와 동일하게 만원 단위다.
    if (!apartmentName || !legalDong || areaSqm === null || areaSqm <= 0 || depositMan === null || depositMan < 0 || monthlyRentMan === null || monthlyRentMan < 0 || year === null || month === null || day === null) continue;
    const dealYmd = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const roadAddress = transactionAddress(regionLabel, block, legalDong, jibun);
    const floor = parseNumber(xmlTag(block, "floor", "층"));
    const buildYear = parseNumber(xmlTag(block, "buildYear", "건축년도"));
    const contractTerm = xmlTag(block, "cntrTerm", "계약기간");
    const estateAgentDistrict = xmlTag(block, "estateAgentSggNm", "중개사소재지");
    const apartmentDong = xmlTag(block, "aptDong", "아파트동");
    const landLeasehold = xmlTag(block, "landLeaseholdGbn", "토지임대부아파트여부");
    const fingerprint = [lawdCd, dealYmd, apartmentName, areaSqm, floor ?? "", depositMan, monthlyRentMan, jibun ?? ""].join("|");
    parsedRows.push({ fingerprint, lawdCd, regionLabel, dealYmd, apartmentName, legalDong, jibun, roadAddress, areaSqm, floor, depositMan, monthlyRentMan, contractTerm, buildYear, estateAgentDistrict, apartmentDong, landLeasehold, apiVariant, latitude: null, longitude: null, fetchedAt });
  }
  return parsedRows;
}

export async function geocodeExactAddress(address: string): Promise<{ latitude: number; longitude: number; label: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=kr&q=${encodeURIComponent(address)}`;
    const response = await fetch(url, { headers: { "User-Agent": "MuseRealEstateArtifact/1.0" } });
    if (!response.ok) return null;
    const parsed = nominatimSchema.safeParse(await response.json());
    const first = parsed.success ? parsed.data[0] : undefined;
    if (!first) return null;
    const latitude = Number(first.lat);
    const longitude = Number(first.lon);
    return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude, label: first.display_name } : null;
  } catch {
    return null;
  }
}

export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// Walking-time estimate for tour legs. The estimate labels itself as
// straight-line distance at a flat 4 km/h walk, never as a real road route.
export function walkMinutesForMeters(distanceM: number): number {
  if (distanceM <= 0) return 0;
  return Math.max(1, Math.round(distanceM / WALK_METERS_PER_MINUTE));
}

export async function readStoredServiceKey(db: Db): Promise<string | undefined> {
  const [setting] = await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, MOLIT_SERVICE_KEY_SETTING_KEY)).limit(1);
  const value = setting?.value.trim() ?? "";
  return value.length >= 10 ? value : undefined;
}

// ---------------- DB 헬퍼 (원본의 ctx 기반 함수를 Db 기반으로 변환) ----------------

export async function loadCourseStops(db: Db, courseId: number) {
  const stopRows = await db
    .select()
    .from(schema.tourCourseStops)
    .where(eq(schema.tourCourseStops.courseId, courseId))
    .orderBy(asc(schema.tourCourseStops.position), asc(schema.tourCourseStops.id));
  if (stopRows.length === 0) return [];
  const propertyRows = await db
    .select()
    .from(schema.properties)
    .where(inArray(schema.properties.id, stopRows.map((row) => row.propertyId)));
  const propertiesById = new Map(propertyRows.map((property) => [property.id, property]));
  return stopRows.flatMap((stop) => {
    const property = propertiesById.get(stop.propertyId);
    return property ? [{ stop, property }] : [];
  });
}

export async function insertPriceAlertIfNew(
  db: Db,
  input: { watchId: number; type: "price_drop" | "target_reached" | "bargain"; month: string | null; title: string; detail: string; trigger: number | null; baseline: number | null; changePct: number | null; sourceUrl?: string | null },
): Promise<boolean> {
  const conditions = [eq(schema.priceAlerts.watchId, input.watchId), eq(schema.priceAlerts.type, input.type)];
  const existing = input.month === null
    ? await db.select({ id: schema.priceAlerts.id }).from(schema.priceAlerts).where(and(...conditions, isNull(schema.priceAlerts.month))).limit(1)
    : await db.select({ id: schema.priceAlerts.id }).from(schema.priceAlerts).where(and(...conditions, eq(schema.priceAlerts.month, input.month))).limit(1);
  if (existing[0]) return false;
  await db.insert(schema.priceAlerts).values({
    watchId: input.watchId,
    type: input.type,
    title: input.title,
    detail: input.detail,
    month: input.month,
    triggerValueMan: input.trigger,
    baselineValueMan: input.baseline,
    changePct: input.changePct,
    sourceUrl: input.sourceUrl ?? "",
    createdAt: new Date(),
    readAt: null,
  });
  return true;
}

export type WatchTradeSliceResult =
  | { status: "ok"; inserted: number; fromCache: boolean; message: null }
  | { status: "not_configured" | "rate_limited" | "error"; inserted: 0; fromCache: false; message: string };

export async function ensureWatchTradeSlice(
  db: Db,
  options: { lawdCd: string; regionLabel: string; month: string; serviceKey: string | undefined },
): Promise<WatchTradeSliceResult> {
  const freshnessCutoff = Date.now() - 24 * 60 * 60 * 1000;
  const [freshest] = await db
    .select({ id: schema.officialTransactions.id, fetchedAt: schema.officialTransactions.fetchedAt })
    .from(schema.officialTransactions)
    .where(and(eq(schema.officialTransactions.lawdCd, options.lawdCd), like(schema.officialTransactions.dealYmd, `${options.month}%`)))
    .limit(1);
  if (freshest && freshest.fetchedAt.getTime() > freshnessCutoff) {
    return { status: "ok", inserted: 0, fromCache: true, message: null };
  }
  const serviceKey = options.serviceKey ?? (await readStoredServiceKey(db));
  const result = await fetchMolitApartmentTrades({
    lawdCd: options.lawdCd,
    dealYmd: options.month.replace("-", ""),
    serviceKey,
  });
  if (result.status === "not_configured") {
    return { status: "not_configured", inserted: 0, fromCache: false, message: "국토교통부 실거래 API 인증키가 없습니다. 설정 화면에서 이 브라우저의 인증키를 입력하거나 '서버 인증키'를 등록해 주세요." };
  }
  if (result.status === "rate_limited") {
    return { status: "rate_limited", inserted: 0, fromCache: false, message: "공공데이터포털 API 호출 한도에 도달했습니다. 잠시 후 다시 확인해 주세요." };
  }
  if (result.status !== "ok" || result.variant === null) {
    return { status: "error", inserted: 0, fromCache: false, message: result.message ?? "실거래 API 응답을 확인할 수 없습니다. 인증키와 상세 API 활용신청 상태를 확인해 주세요." };
  }
  const fetchedAt = new Date();
  const parsedRows = parseMolitTradeRows(result.xml, options.lawdCd, options.regionLabel, result.variant, fetchedAt);
  const existing = await db
    .select({ fingerprint: schema.officialTransactions.fingerprint })
    .from(schema.officialTransactions)
    .where(and(eq(schema.officialTransactions.lawdCd, options.lawdCd), like(schema.officialTransactions.dealYmd, `${options.month}%`)));
  const existingFingerprints = new Set(existing.map((row) => row.fingerprint));
  const freshRows = parsedRows.filter((row) => !existingFingerprints.has(row.fingerprint as string));
  if (freshRows.length > 0) {
    await db.insert(schema.officialTransactions).values(freshRows);
  }
  return { status: "ok", inserted: freshRows.length, fromCache: false, message: null };
}

export async function ensureWatchRentSlice(
  db: Db,
  options: { lawdCd: string; regionLabel: string; month: string; serviceKey: string | undefined },
): Promise<WatchTradeSliceResult> {
  const freshnessCutoff = Date.now() - 24 * 60 * 60 * 1000;
  const [freshest] = await db
    .select({ id: schema.officialRentTransactions.id, fetchedAt: schema.officialRentTransactions.fetchedAt })
    .from(schema.officialRentTransactions)
    .where(and(eq(schema.officialRentTransactions.lawdCd, options.lawdCd), like(schema.officialRentTransactions.dealYmd, `${options.month}%`)))
    .limit(1);
  if (freshest && freshest.fetchedAt.getTime() > freshnessCutoff) {
    return { status: "ok", inserted: 0, fromCache: false, message: null };
  }
  const serviceKey = options.serviceKey ?? (await readStoredServiceKey(db));
  const result = await fetchMolitApartmentRents({
    lawdCd: options.lawdCd,
    dealYmd: options.month.replace("-", ""),
    serviceKey,
  });
  if (result.status === "not_configured") {
    return { status: "not_configured", inserted: 0, fromCache: false, message: "국토교통부 실거래 API 인증키가 없습니다. 설정 화면에서 이 브라우저의 인증키를 입력하거나 '서버 인증키'를 등록해 주세요." };
  }
  if (result.status === "rate_limited") {
    return { status: "rate_limited", inserted: 0, fromCache: false, message: "공공데이터포털 API 호출 한도에 도달했습니다. 잠시 후 다시 확인해 주세요." };
  }
  if (result.status !== "ok" || result.variant === null) {
    return { status: "error", inserted: 0, fromCache: false, message: result.message ?? "전월세 실거래 API 응답을 확인할 수 없습니다. 인증키와 전월세 API 활용신청 상태를 확인해 주세요." };
  }
  const fetchedAt = new Date();
  const parsedRows = parseMolitRentRows(result.xml, options.lawdCd, options.regionLabel, result.variant, fetchedAt);
  const existing = await db
    .select({ fingerprint: schema.officialRentTransactions.fingerprint })
    .from(schema.officialRentTransactions)
    .where(and(eq(schema.officialRentTransactions.lawdCd, options.lawdCd), like(schema.officialRentTransactions.dealYmd, `${options.month}%`)));
  const existingFps = new Set(existing.map((row) => row.fingerprint));
  const freshRows = parsedRows.filter((row) => !existingFps.has(row.fingerprint as string));
  if (freshRows.length > 0) {
    await db.insert(schema.officialRentTransactions).values(freshRows);
  }
  return { status: "ok", inserted: freshRows.length, fromCache: false, message: null };
}

export async function upsertWatchMonthSeries(db: Db, watch: typeof schema.watchItems.$inferSelect, months: string[]): Promise<void> {
  const fetchedAt = new Date();
  for (const month of months) {
    const rows = await db
      .select({ dealAmountMan: schema.officialTransactions.dealAmountMan, areaSqm: schema.officialTransactions.areaSqm })
      .from(schema.officialTransactions)
      .where(and(
        eq(schema.officialTransactions.lawdCd, watch.lawdCd),
        eq(schema.officialTransactions.apartmentName, watch.complexName),
        like(schema.officialTransactions.dealYmd, `${month}%`),
      ));
    const matching = rows.filter((row) => Math.abs(row.areaSqm - watch.areaSqm) <= watch.areaToleranceSqm);
    const amounts = matching.map((row) => row.dealAmountMan);
    const total = amounts.reduce((sum, value) => sum + value, 0);
    await db
      .insert(schema.watchPriceSeries)
      .values({
        watchId: watch.id,
        month,
        avgPriceMan: matching.length > 0 ? Math.round(total / matching.length) : null,
        medianPriceMan: medianOf(amounts),
        minPriceMan: matching.length > 0 ? Math.min(...amounts) : null,
        maxPriceMan: matching.length > 0 ? Math.max(...amounts) : null,
        tradeCount: matching.length,
        fetchedAt,
      })
      .onConflictDoUpdate({
        target: [schema.watchPriceSeries.watchId, schema.watchPriceSeries.month],
        set: {
          avgPriceMan: matching.length > 0 ? Math.round(total / matching.length) : null,
          medianPriceMan: medianOf(amounts),
          minPriceMan: matching.length > 0 ? Math.min(...amounts) : null,
          maxPriceMan: matching.length > 0 ? Math.max(...amounts) : null,
          tradeCount: matching.length,
          fetchedAt,
        },
      });
  }
}

export async function upsertWatchMonthRentSeries(db: Db, watch: typeof schema.watchItems.$inferSelect, months: string[]): Promise<void> {
  const fetchedAt = new Date();
  for (const month of months) {
    const rows = await db
      .select({ depositMan: schema.officialRentTransactions.depositMan, monthlyRentMan: schema.officialRentTransactions.monthlyRentMan, areaSqm: schema.officialRentTransactions.areaSqm })
      .from(schema.officialRentTransactions)
      .where(and(
        eq(schema.officialRentTransactions.lawdCd, watch.lawdCd),
        eq(schema.officialRentTransactions.apartmentName, watch.complexName),
        like(schema.officialRentTransactions.dealYmd, `${month}%`),
      ));
    const matching = rows.filter((row) => Math.abs(row.areaSqm - watch.areaSqm) <= watch.areaToleranceSqm);
    const jeonse = matching.filter((row) => row.monthlyRentMan === 0).map((row) => row.depositMan);
    const wolse = matching.filter((row) => row.monthlyRentMan > 0);
    const wolseDeposits = wolse.map((row) => row.depositMan);
    const wolseMonthly = wolse.map((row) => row.monthlyRentMan);
    const avgRound = (values: number[]): number | null => values.length > 0 ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
    await db
      .insert(schema.watchRentSeries)
      .values({
        watchId: watch.id,
        month,
        jeonseMedianMan: medianOf(jeonse),
        jeonseAvgMan: avgRound(jeonse),
        jeonseMinMan: jeonse.length > 0 ? Math.min(...jeonse) : null,
        jeonseMaxMan: jeonse.length > 0 ? Math.max(...jeonse) : null,
        jeonseCount: jeonse.length,
        wolseMedianMan: medianOf(wolseDeposits),
        wolseAvgMan: avgRound(wolseDeposits),
        wolseAvgMonthlyMan: avgRound(wolseMonthly),
        wolseCount: wolse.length,
        fetchedAt,
      })
      .onConflictDoUpdate({
        target: [schema.watchRentSeries.watchId, schema.watchRentSeries.month],
        set: {
          jeonseMedianMan: medianOf(jeonse),
          jeonseAvgMan: avgRound(jeonse),
          jeonseMinMan: jeonse.length > 0 ? Math.min(...jeonse) : null,
          jeonseMaxMan: jeonse.length > 0 ? Math.max(...jeonse) : null,
          jeonseCount: jeonse.length,
          wolseMedianMan: medianOf(wolseDeposits),
          wolseAvgMan: avgRound(wolseDeposits),
          wolseAvgMonthlyMan: avgRound(wolseMonthly),
          wolseCount: wolse.length,
          fetchedAt,
        },
      });
  }
}

export async function evaluateWatchAlerts(
  db: Db,
  watch: typeof schema.watchItems.$inferSelect,
  checkedMonths: string[],
  options: { createAlerts: boolean },
): Promise<{ alertsCreated: number }> {
  await upsertWatchMonthSeries(db, watch, checkedMonths);
  if (!options.createAlerts) return { alertsCreated: 0 };

  let alertsCreated = 0;
  const series = await db
    .select()
    .from(schema.watchPriceSeries)
    .where(eq(schema.watchPriceSeries.watchId, watch.id))
    .orderBy(desc(schema.watchPriceSeries.month));
  const withTrades = series.filter((row) => row.tradeCount > 0 && row.avgPriceMan !== null);
  const latest = withTrades[0];
  const previous = withTrades[1];

  if (latest?.avgPriceMan !== null && latest?.avgPriceMan !== undefined) {
    const latestAvg = latest.avgPriceMan;
    if (previous?.avgPriceMan != null && previous.avgPriceMan > 0 && watch.dropAlertPct > 0) {
      const changePct = ((previous.avgPriceMan - latestAvg) / previous.avgPriceMan) * 100;
      if (changePct >= watch.dropAlertPct) {
        const created = await insertPriceAlertIfNew(db, {
          watchId: watch.id,
          type: "price_drop",
          month: latest.month,
          sourceUrl: OFFICIAL_WATCH_SOURCE_URL,
          title: `${watch.complexName} 평균 실거래가 전월 대비 ${changePct.toFixed(1)}% 하락`,
          detail: `${monthLabel(latest.month)} 월평균 실거래 ${formatMoneyMan(latestAvg)} (거래 ${latest.tradeCount}건)이 전월 ${monthLabel(previous.month)} ${formatMoneyMan(previous.avgPriceMan)} (거래 ${previous.tradeCount}건)보다 하락 조건(${watch.dropAlertPct}% 이상)을 충족했습니다. 신고 실거래 기준이며 신고 지연·정정 신고로 나중에 조정될 수 있습니다.`,
          trigger: latestAvg,
          baseline: previous.avgPriceMan,
          changePct,
        });
        if (created) alertsCreated += 1;
      }
    }
    if (watch.targetPriceMan !== null && latestAvg <= watch.targetPriceMan) {
      const created = await insertPriceAlertIfNew(db, {
        watchId: watch.id,
        type: "target_reached",
        month: latest.month,
        sourceUrl: OFFICIAL_WATCH_SOURCE_URL,
        title: `${watch.complexName} 월평균 실거래가가 목표가에 도달했습니다`,
        detail: `${monthLabel(latest.month)} 월평균 실거래 ${formatMoneyMan(latestAvg)} (거래 ${latest.tradeCount}건)이 목표가 ${formatMoneyMan(watch.targetPriceMan)} 이하입니다. 이 값은 신고 실거래 평균이지 실시간 호가가 아닙니다.`,
        trigger: latestAvg,
        baseline: watch.targetPriceMan,
        changePct: null,
      });
      if (created) alertsCreated += 1;
    }
  }

  if (watch.bargainBelowMan !== null && watch.bargainBelowMan !== undefined) {
    for (const month of checkedMonths) {
      const hits = await db
        .select({ dealAmountMan: schema.officialTransactions.dealAmountMan, dealYmd: schema.officialTransactions.dealYmd, floor: schema.officialTransactions.floor, areaSqm: schema.officialTransactions.areaSqm })
        .from(schema.officialTransactions)
        .where(and(
          eq(schema.officialTransactions.lawdCd, watch.lawdCd),
          eq(schema.officialTransactions.apartmentName, watch.complexName),
          like(schema.officialTransactions.dealYmd, `${month}%`),
          lte(schema.officialTransactions.dealAmountMan, watch.bargainBelowMan),
        ))
        .orderBy(asc(schema.officialTransactions.dealAmountMan));
      const bargainHits = hits.filter((row) => Math.abs(row.areaSqm - watch.areaSqm) <= watch.areaToleranceSqm);
      if (bargainHits.length === 0) continue;
      const lowest = bargainHits[0]?.dealAmountMan ?? watch.bargainBelowMan;
      const samples = bargainHits.slice(0, 3).map((row) => `${row.dealYmd} · ${formatMoneyMan(row.dealAmountMan)}${row.floor === null ? "" : ` · ${row.floor}층`} · ${row.areaSqm.toFixed(1)}㎡`).join(" / ");
      const created = await insertPriceAlertIfNew(db, {
        watchId: watch.id,
        type: "bargain",
        month,
        sourceUrl: OFFICIAL_WATCH_SOURCE_URL,
        title: `${watch.complexName} 급매 후보 포착 (${monthLabel(month)} ${bargainHits.length}건)`,
        detail: `급매 기준 ${formatMoneyMan(watch.bargainBelowMan)} 이하 신고 거래가 ${monthLabel(month)}에 ${bargainHits.length}건 포착됐습니다. 최저 ${formatMoneyMan(lowest)}. 대표 거래: ${samples}. "급매"는 실거래 기준 기준가 이하를 뜻할 뿐, 실제 매물 여부와 계약 조건은 원문과 현장에서 다시 확인하세요.`,
        trigger: lowest,
        baseline: watch.bargainBelowMan,
        changePct: null,
      });
      if (created) alertsCreated += 1;
    }
  }

  return { alertsCreated };
}
