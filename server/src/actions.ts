import { defineAction, z, type ActionsModule, type Ctx } from "@hatch/space-sdk";
import { and, asc, desc, eq, inArray, isNull, like, lte } from "drizzle-orm";
import * as schema from "./schema";
import { resolveRegion } from "./regions";
import { privileged } from "@space/privileged";

const purposeSchema = z.enum(["both", "invest", "reside"]);
const referenceKindSchema = z.enum(["price", "location"]);

const propertySchema = z.object({
  id: z.number(),
  name: z.string(),
  address: z.string(),
  resolvedAddress: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  areaSqm: z.number(),
  askingPriceMan: z.number(),
  depositMan: z.number().nullable(),
  monthlyRentMan: z.number().nullable(),
  purpose: purposeSchema,
  visitDate: z.string().nullable(),
  memo: z.string(),
  priceBasis: z.enum(["asking", "official_trade"]),
  sourceReference: z.string().nullable(),
  geocodeSource: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const checklistSchema = z.object({
  itemKey: z.string(),
  checked: z.boolean(),
  note: z.string(),
  updatedAt: z.string(),
});

const photoSchema = z.object({
  id: z.number(),
  url: z.string(),
  caption: z.string(),
  createdAt: z.string(),
});

const voiceMemoSchema = z.object({
  id: z.number(),
  propertyId: z.number(),
  listingId: z.number().nullable(),
  checklistItemKey: z.string().nullable(),
  title: z.string(),
  url: z.string(),
  mimeType: z.string(),
  durationSec: z.number().nullable(),
  createdAt: z.string(),
});

const referenceSchema = z.object({
  id: z.number(),
  kind: referenceKindSchema,
  title: z.string(),
  url: z.string(),
  source: z.string().nullable(),
  snippet: z.string().nullable(),
  publishedAt: z.string().nullable(),
  rank: z.number(),
  fetchedAt: z.string(),
});

const nearbySchema = z.object({
  id: z.number(),
  category: z.enum(["transit", "school", "market", "hospital"]),
  name: z.string(),
  address: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  distanceM: z.number(),
  fetchedAt: z.string(),
});

const officialTransactionSchema = z.object({
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

const officialRentTransactionSchema = z.object({
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

const nearbyApartmentSchema = z.object({
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

const nearbySavedPropertySchema = z.object({
  id: z.number(),
  name: z.string(),
  address: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  distanceKm: z.number(),
  areaSqm: z.number(),
  askingPriceMan: z.number(),
});

const comparisonItemSchema = z.object({
  property: propertySchema,
  position: z.number(),
  comparisonNote: z.string(),
  valueAssessment: z.string(),
  conclusion: z.string(),
  finalSelected: z.boolean(),
  updatedAt: z.string(),
  checklistDone: z.number(),
  checklistTotal: z.number(),
  photos: z.array(photoSchema),
});

const revisitTaskSchema = z.object({
  id: z.number(),
  itemKey: z.string(),
  label: z.string(),
  reason: z.enum(["unchecked", "missing_note", "custom"]),
  completed: z.boolean(),
  note: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const priceTrackerSchema = z.object({
  active: z.boolean(),
  targetPriceMan: z.number().nullable(),
  updatedAt: z.string(),
});

const priceSnapshotSchema = z.object({
  id: z.number(),
  amountMan: z.number(),
  kind: z.enum(["asking", "official_trade"]),
  note: z.string(),
  sourceUrl: z.string().nullable(),
  recordedAt: z.string(),
});

const financeScenarioSchema = z.object({
  purchasePriceMan: z.number(),
  ownFundsMan: z.number(),
  annualIncomeMan: z.number(),
  otherAnnualDebtMan: z.number(),
  loanRatePct: z.number(),
  loanYears: z.number(),
  ltvPct: z.number(),
  acquisitionTaxPct: z.number(),
  brokeragePct: z.number(),
  updatedAt: z.string(),
});

// ---- Watchlist (관심 단지 시세 트래킹) response schemas ----

const watchItemSchema = z.object({
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

const watchListItemSchema = watchItemSchema.extend({
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

const watchSeriesSchema = z.object({
  watchId: z.number(),
  month: z.string(),
  avgPriceMan: z.number().nullable(),
  medianPriceMan: z.number().nullable(),
  minPriceMan: z.number().nullable(),
  maxPriceMan: z.number().nullable(),
  tradeCount: z.number(),
  fetchedAt: z.string(),
});

const watchRentSeriesSchema = z.object({
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

const watchAskRecordSchema = z.object({
  id: z.number(),
  watchId: z.number(),
  amountMan: z.number(),
  source: z.string(),
  note: z.string(),
  recordedAt: z.string(),
});

const priceAlertSchema = z.object({
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

const priceAlertWithWatchSchema = priceAlertSchema.extend({
  watchComplex: z.string(),
  watchLabel: z.string(),
});

const watchCheckRunSchema = z.object({
  id: z.number(),
  watchId: z.number(),
  status: z.enum(["ok", "needs_key", "rate_limited", "error", "skipped"]),
  monthsChecked: z.string(),
  newTrades: z.number(),
  alertsCreated: z.number(),
  message: z.string().nullable(),
  createdAt: z.string(),
});

const CHECKLIST_ITEMS: ReadonlyArray<readonly [string, string]> = [
  ["entrance", "단지 진입 동선"], ["noise", "도로·생활 소음"], ["slope", "경사와 보행 환경"],
  ["parking", "주차 여유"], ["hall", "현관·복도 관리"], ["elevator", "엘리베이터 상태"],
  ["sunlight", "채광·향"], ["ventilation", "환기·냄새"], ["water", "수압·누수 흔적"], ["layout", "동선·수납"],
  ["transit", "대중교통 접근"], ["groceries", "장보기·생활상권"], ["school", "학교·돌봄 동선"],
];

const OFFICIAL_SOURCE_URL = "https://www.data.go.kr/data/15126469/openapi.do";
const OFFICIAL_RENT_SOURCE_URL = "https://www.data.go.kr/data/15126474/openapi.do";

function xmlDecode(value: string): string {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").trim();
}

function xmlTag(block: string, ...names: string[]): string | null {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, "i"));
    if (match?.[1] !== undefined) return xmlDecode(match[1]);
  }
  return null;
}

function parseNumber(value: string | null): number | null {
  if (!value) return null;
  const number = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(number) ? number : null;
}

function transactionAddress(regionLabel: string, block: string, legalDong: string, jibun: string | null): string {
  const road = xmlTag(block, "roadNm", "도로명");
  const main = xmlTag(block, "roadNmBonbun", "도로명건물본번호코드");
  const sub = xmlTag(block, "roadNmBubun", "도로명건물부번호코드");
  if (road && main && Number(main) > 0) {
    const number = `${Number(main)}${sub && Number(sub) > 0 ? `-${Number(sub)}` : ""}`;
    return `${regionLabel} ${road} ${number}`;
  }
  return [regionLabel, legalDong, jibun].filter(Boolean).join(" ");
}

function serializeOfficialTransaction(row: typeof schema.officialTransactions.$inferSelect): z.infer<typeof officialTransactionSchema> {
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

function serializeOfficialRentTransaction(row: typeof schema.officialRentTransactions.$inferSelect): z.infer<typeof officialRentTransactionSchema> {
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
    apiVariant: row.apiVariant,
    latitude: row.latitude,
    longitude: row.longitude,
    fetchedAt: row.fetchedAt.toISOString(),
  };
}

const AUTO_CHECK_ENABLED_KEY = "watch.auto_check_enabled";
const MOLIT_SERVICE_KEY_SETTING_KEY = "molit.service_key";
const VWORLD_API_KEY_SETTING_KEY = "vworld.api_key";
const OFFICIAL_WATCH_SOURCE_URL = OFFICIAL_SOURCE_URL;

// Platform v24: owner-restricted operations (API probing, tools, privileged
// network calls) must never run for non-owner viewers. The client UI is the
// only enforcement point for guest-role writes today; server-side we gate the
// expensive/credential-bearing paths.
function isNonOwnerViewer(ctx: Ctx): boolean {
  const viewer = ctx.viewer;
  return viewer !== undefined && viewer.isOwner === false;
}

async function readStoredServiceKey(ctx: Ctx): Promise<string | undefined> {
  const db = ctx.db<typeof schema>();
  const [setting] = await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, MOLIT_SERVICE_KEY_SETTING_KEY)).limit(1);
  const value = setting?.value.trim() ?? "";
  return value.length >= 10 ? value : undefined;
}

function maskServiceKey(value: string): string {
  return value.length >= 10 ? `${value.slice(0, 4)}••••${value.slice(-4)}` : "••••";
}

function currentKstMonthKey(): string {
  const shifted = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function monthKeys(count: number): string[] {
  const [rawYear = 1970, rawMonth = 1] = currentKstMonthKey().split("-").map(Number);
  const keys: string[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    const date = new Date(Date.UTC(rawYear, rawMonth - 1 - offset, 1));
    keys.push(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

function monthLabel(month: string): string {
  const [year, mon] = month.split("-");
  if (!year || !mon) return month;
  return `${year}년 ${Number(mon)}월`;
}

function formatMoneyMan(value: number): string {
  if (value >= 10000) {
    const eok = Math.floor(value / 10000);
    const man = value % 10000;
    return man === 0 ? `${eok}억 원` : `${eok}억 ${man.toLocaleString("ko-KR")}만 원`;
  }
  return `${value.toLocaleString("ko-KR")}만 원`;
}

function medianOf(values: number[]): number | null {
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
function resolveLawdCdFromProperty(
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

function parseMolitTradeRows(
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

function parseMolitRentRows(
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

function serializeWatchItem(row: typeof schema.watchItems.$inferSelect): z.infer<typeof watchItemSchema> {
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

function serializePriceAlert(row: typeof schema.priceAlerts.$inferSelect): z.infer<typeof priceAlertSchema> {
  return {
    id: row.id,
    watchId: row.watchId,
    type: row.type,
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

function serializeWatchCheckRun(row: typeof schema.watchCheckRuns.$inferSelect): z.infer<typeof watchCheckRunSchema> {
  return {
    id: row.id,
    watchId: row.watchId,
    status: row.status,
    monthsChecked: row.monthsChecked,
    newTrades: row.newTrades,
    alertsCreated: row.alertsCreated,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
  };
}

async function insertPriceAlertIfNew(
  ctx: Ctx,
  input: { watchId: number; type: "price_drop" | "target_reached" | "bargain"; month: string | null; title: string; detail: string; trigger: number | null; baseline: number | null; changePct: number | null; sourceUrl?: string | null },
): Promise<boolean> {
  const db = ctx.db<typeof schema>();
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

type WatchTradeSliceResult =
  | { status: "ok"; inserted: number; fromCache: boolean; message: null }
  | { status: "not_configured" | "rate_limited" | "error"; inserted: 0; fromCache: false; message: string };

async function ensureWatchTradeSlice(
  ctx: Ctx,
  options: { lawdCd: string; regionLabel: string; month: string; serviceKey: string | undefined },
): Promise<WatchTradeSliceResult> {
  const db = ctx.db<typeof schema>();
  const freshnessCutoff = Date.now() - 24 * 60 * 60 * 1000;
  const [freshest] = await db
    .select({ id: schema.officialTransactions.id, fetchedAt: schema.officialTransactions.fetchedAt })
    .from(schema.officialTransactions)
    .where(and(eq(schema.officialTransactions.lawdCd, options.lawdCd), like(schema.officialTransactions.dealYmd, `${options.month}%`)))
    .limit(1);
  if (freshest && freshest.fetchedAt.getTime() > freshnessCutoff) {
    return { status: "ok", inserted: 0, fromCache: true, message: null };
  }
  const serviceKey = options.serviceKey ?? (await readStoredServiceKey(ctx));
  const result = await ctx.executePrivileged(privileged.fetchMolitApartmentTrades, {
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

async function ensureWatchRentSlice(
  ctx: Ctx,
  options: { lawdCd: string; regionLabel: string; month: string; serviceKey: string | undefined },
): Promise<WatchTradeSliceResult> {
  const db = ctx.db<typeof schema>();
  const freshnessCutoff = Date.now() - 24 * 60 * 60 * 1000;
  const [freshest] = await db
    .select({ id: schema.officialRentTransactions.id, fetchedAt: schema.officialRentTransactions.fetchedAt })
    .from(schema.officialRentTransactions)
    .where(and(eq(schema.officialRentTransactions.lawdCd, options.lawdCd), like(schema.officialRentTransactions.dealYmd, `${options.month}%`)))
    .limit(1);
  if (freshest && freshest.fetchedAt.getTime() > freshnessCutoff) {
    return { status: "ok", inserted: 0, fromCache: true, message: null };
  }
  const serviceKey = options.serviceKey ?? (await readStoredServiceKey(ctx));
  const result = await ctx.executePrivileged(privileged.fetchMolitApartmentRents, {
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

async function upsertWatchMonthSeries(ctx: Ctx, watch: typeof schema.watchItems.$inferSelect, months: string[]): Promise<void> {
  const db = ctx.db<typeof schema>();
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

async function upsertWatchMonthRentSeries(ctx: Ctx, watch: typeof schema.watchItems.$inferSelect, months: string[]): Promise<void> {
  const db = ctx.db<typeof schema>();
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

async function evaluateWatchAlerts(
  ctx: Ctx,
  watch: typeof schema.watchItems.$inferSelect,
  checkedMonths: string[],
  options: { createAlerts: boolean },
): Promise<{ alertsCreated: number }> {
  await upsertWatchMonthSeries(ctx, watch, checkedMonths);
  if (!options.createAlerts) return { alertsCreated: 0 };

  const db = ctx.db<typeof schema>();
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
        const created = await insertPriceAlertIfNew(ctx, {
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
      const created = await insertPriceAlertIfNew(ctx, {
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
      const created = await insertPriceAlertIfNew(ctx, {
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

async function geocodeExactAddress(address: string): Promise<{ latitude: number; longitude: number; label: string } | null> {
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

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// Walking-time estimate for tour legs. The estimate labels itself as
// straight-line distance at a flat 4 km/h walk, never as a real road route.
const WALK_METERS_PER_MINUTE = 4000 / 60;

function walkMinutesForMeters(distanceM: number): number {
  if (distanceM <= 0) return 0;
  return Math.max(1, Math.round(distanceM / WALK_METERS_PER_MINUTE));
}

async function loadCourseStops(ctx: Ctx, courseId: number) {
  const db = ctx.db<typeof schema>();
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

function serializeProperty(row: typeof schema.properties.$inferSelect): z.infer<typeof propertySchema> {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    resolvedAddress: row.resolvedAddress,
    latitude: row.latitude,
    longitude: row.longitude,
    areaSqm: row.areaSqm,
    askingPriceMan: row.askingPriceMan,
    depositMan: row.depositMan,
    monthlyRentMan: row.monthlyRentMan,
    purpose: row.purpose,
    visitDate: row.visitDate,
    memo: row.memo,
    priceBasis: row.priceBasis,
    sourceReference: row.sourceReference,
    geocodeSource: row.geocodeSource,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

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

const visitDateField = z.string().nullable().refine(
  (value) => value === null || value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value),
  { message: "방문일을 YYYY-MM-DD 형식으로 입력하세요." },
);

const courseStopPropertySchema = z.object({
  id: z.number(),
  name: z.string(),
  address: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});

const courseStopSchema = z.object({
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

const courseSchema = z.object({
  id: z.number(),
  title: z.string(),
  visitDate: z.string().nullable(),
  notes: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const courseListItemSchema = courseSchema.extend({
  stopCount: z.number(),
  completedCount: z.number(),
  totalDistanceM: z.number(),
  totalWalkMinutes: z.number(),
});

const courseDetailSchema = z.object({
  course: courseSchema.nullable(),
  stops: z.array(courseStopSchema),
  totalDistanceM: z.number(),
  totalWalkMinutes: z.number(),
  walkAssumption: z.literal("직선거리 기준 · 도보 시속 4km 가정"),
});

function serializeCourse(row: typeof schema.tourCourses.$inferSelect): z.infer<typeof courseSchema> {
  return {
    id: row.id,
    title: row.title,
    visitDate: row.visitDate,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const listingTradeTypeSchema = z.enum(["sale", "jeonse", "wolse"]);
const listingStatusSchema = z.enum(["active", "hold", "done", "closed"]);

const listingSchema = z.object({
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

const listingPriceLogSchema = z.object({
  id: z.number(),
  listingId: z.number(),
  priceMan: z.number(),
  monthlyRentMan: z.number().nullable(),
  note: z.string(),
  sourceNote: z.string(),
  recordedAt: z.string(),
});

const listingSummarySchema = listingSchema.extend({
  firstPriceMan: z.number().nullable(),
  priceChangeMan: z.number().nullable(),
  logCount: z.number(),
});

function serializeListing(row: typeof schema.listings.$inferSelect): z.infer<typeof listingSchema> {
  return {
    id: row.id,
    propertyId: row.propertyId,
    brokerName: row.brokerName,
    brokerContact: row.brokerContact,
    dong: row.dong,
    ho: row.ho,
    areaSqm: row.areaSqm,
    tradeType: row.tradeType,
    priceMan: row.priceMan,
    monthlyRentMan: row.monthlyRentMan,
    targetPriceMan: row.targetPriceMan,
    listingUrl: row.listingUrl,
    status: row.status,
    memo: row.memo,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const Actions = {
  listProperties: defineAction({
    request: z.object({}),
    response: z.object({ properties: z.array(propertySchema) }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.properties).orderBy(desc(schema.properties.updatedAt));
      return { properties: rows.map(serializeProperty) };
    },
  }),

  getComparisonBoard: defineAction({
    request: z.object({}),
    response: z.object({ items: z.array(comparisonItemSchema) }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.propertyComparisons).orderBy(asc(schema.propertyComparisons.position));
      const items = await Promise.all(rows.map(async (row): Promise<z.infer<typeof comparisonItemSchema> | null> => {
        const [property] = await db.select().from(schema.properties).where(eq(schema.properties.id, row.propertyId)).limit(1);
        if (!property) return null;
        const [photoRows, checklistRows] = await Promise.all([
          db.select().from(schema.photos).where(eq(schema.photos.propertyId, row.propertyId)).orderBy(desc(schema.photos.createdAt)),
          db.select().from(schema.checklistEntries).where(eq(schema.checklistEntries.propertyId, row.propertyId)),
        ]);
        const photos = await Promise.all(photoRows.map(async (photo) => ({
          id: photo.id,
          url: await ctx.blobs.getUrl(photo.blobKey, { expiresInSeconds: 3600 }),
          caption: photo.caption,
          createdAt: photo.createdAt.toISOString(),
        })));
        return {
          property: serializeProperty(property),
          position: row.position,
          comparisonNote: row.comparisonNote,
          valueAssessment: row.valueAssessment,
          conclusion: row.conclusion,
          finalSelected: row.finalSelected,
          updatedAt: row.updatedAt.toISOString(),
          checklistDone: checklistRows.filter((entry) => entry.checked).length,
          checklistTotal: 13,
          photos,
        };
      }));
      return { items: items.filter((item): item is z.infer<typeof comparisonItemSchema> => item !== null) };
    },
  }),

  setComparisonCandidates: defineAction({
    request: z.object({ propertyIds: z.array(z.number().int().positive()).min(1).max(3).refine((ids) => new Set(ids).size === ids.length) }),
    response: z.object({ ok: z.boolean(), selectedIds: z.array(z.number()) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const existing = await db.select().from(schema.propertyComparisons);
      const selectedIds: number[] = [];
      for (const propertyId of args.propertyIds) {
        const [property] = await db.select({ id: schema.properties.id }).from(schema.properties).where(eq(schema.properties.id, propertyId)).limit(1);
        if (property) selectedIds.push(property.id);
      }
      for (const row of existing) {
        if (!selectedIds.includes(row.propertyId)) await db.delete(schema.propertyComparisons).where(eq(schema.propertyComparisons.id, row.id));
      }
      const now = new Date();
      for (const [position, propertyId] of selectedIds.entries()) {
        await db.insert(schema.propertyComparisons).values({ propertyId, position, updatedAt: now }).onConflictDoUpdate({
          target: schema.propertyComparisons.propertyId,
          set: { position, updatedAt: now },
        });
      }
      ctx.invalidateQueries();
      return { ok: selectedIds.length > 0, selectedIds };
    },
  }),

  saveComparisonEvaluation: defineAction({
    request: z.object({
      propertyId: z.number().int().positive(),
      comparisonNote: z.string().max(2000),
      valueAssessment: z.string().max(2000),
      conclusion: z.string().max(2000),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const { propertyId, ...values } = args;
      await db.update(schema.propertyComparisons).set({ ...values, updatedAt: new Date() }).where(eq(schema.propertyComparisons.propertyId, propertyId));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  setComparisonFinal: defineAction({
    request: z.object({ propertyId: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.propertyComparisons);
      if (!rows.some((row) => row.propertyId === args.propertyId)) return { ok: false };
      for (const row of rows) {
        await db.update(schema.propertyComparisons).set({ finalSelected: row.propertyId === args.propertyId, updatedAt: new Date() }).where(eq(schema.propertyComparisons.id, row.id));
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  getDecisionSupport: defineAction({
    request: z.object({ propertyId: z.number().int().positive() }),
    response: z.object({
      revisitTasks: z.array(revisitTaskSchema),
      priceTracker: priceTrackerSchema.nullable(),
      priceSnapshots: z.array(priceSnapshotSchema),
      financeScenario: financeScenarioSchema.nullable(),
      listingSummaries: z.array(listingSummarySchema),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [taskRows, trackerRows, snapshotRows, financeRows, listingRows] = await Promise.all([
        db.select().from(schema.revisitTasks).where(eq(schema.revisitTasks.propertyId, args.propertyId)).orderBy(asc(schema.revisitTasks.completed), asc(schema.revisitTasks.createdAt)),
        db.select().from(schema.priceTrackers).where(eq(schema.priceTrackers.propertyId, args.propertyId)).limit(1),
        db.select().from(schema.priceSnapshots).where(eq(schema.priceSnapshots.propertyId, args.propertyId)).orderBy(desc(schema.priceSnapshots.recordedAt)),
        db.select().from(schema.financeScenarios).where(eq(schema.financeScenarios.propertyId, args.propertyId)).limit(1),
        db.select().from(schema.listings).where(eq(schema.listings.propertyId, args.propertyId)).orderBy(desc(schema.listings.updatedAt)),
      ]);
      const tracker = trackerRows[0];
      const finance = financeRows[0];
      const listingSummaries = await Promise.all(
        listingRows.map(async (row) => {
          const firstLogs = await db
            .select({ priceMan: schema.listingPriceLogs.priceMan })
            .from(schema.listingPriceLogs)
            .where(eq(schema.listingPriceLogs.listingId, row.id))
            .orderBy(asc(schema.listingPriceLogs.recordedAt), asc(schema.listingPriceLogs.id));
          const first = firstLogs[0]?.priceMan ?? null;
          return {
            ...serializeListing(row),
            firstPriceMan: first,
            priceChangeMan: first === null ? null : row.priceMan - first,
            logCount: firstLogs.length,
          };
        }),
      );
      return {
        revisitTasks: taskRows.map((row) => ({ id: row.id, itemKey: row.itemKey, label: row.label, reason: row.reason, completed: row.completed, note: row.note, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() })),
        priceTracker: tracker ? { active: tracker.active, targetPriceMan: tracker.targetPriceMan, updatedAt: tracker.updatedAt.toISOString() } : null,
        priceSnapshots: snapshotRows.map((row) => ({ id: row.id, amountMan: row.amountMan, kind: row.kind, note: row.note, sourceUrl: row.sourceUrl, recordedAt: row.recordedAt.toISOString() })),
        financeScenario: finance ? { purchasePriceMan: finance.purchasePriceMan, ownFundsMan: finance.ownFundsMan, annualIncomeMan: finance.annualIncomeMan, otherAnnualDebtMan: finance.otherAnnualDebtMan, loanRatePct: finance.loanRatePct, loanYears: finance.loanYears, ltvPct: finance.ltvPct, acquisitionTaxPct: finance.acquisitionTaxPct, brokeragePct: finance.brokeragePct, updatedAt: finance.updatedAt.toISOString() } : null,
        listingSummaries,
      };
    },
  }),

  generateRevisitPlan: defineAction({
    request: z.object({ propertyId: z.number().int().positive() }),
    response: z.object({ ok: z.boolean(), count: z.number(), message: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [property] = await db.select({ id: schema.properties.id }).from(schema.properties).where(eq(schema.properties.id, args.propertyId)).limit(1);
      if (!property) return { ok: false, count: 0, message: "선정 매물을 찾을 수 없습니다." };
      const checklistRows = await db.select().from(schema.checklistEntries).where(eq(schema.checklistEntries.propertyId, args.propertyId));
      const checklist = new Map(checklistRows.map((row) => [row.itemKey, row]));
      const existingTasks = await db.select().from(schema.revisitTasks).where(eq(schema.revisitTasks.propertyId, args.propertyId));
      for (const task of existingTasks) {
        if (task.reason !== "custom") await db.delete(schema.revisitTasks).where(eq(schema.revisitTasks.id, task.id));
      }
      const now = new Date();
      const generated: Array<typeof schema.revisitTasks.$inferInsert> = [];
      for (const [itemKey, label] of CHECKLIST_ITEMS) {
        const entry = checklist.get(itemKey);
        if (!entry?.checked) generated.push({ propertyId: args.propertyId, itemKey, label, reason: "unchecked", completed: false, note: entry?.note ?? "", createdAt: now, updatedAt: now });
        else if (!entry.note.trim()) generated.push({ propertyId: args.propertyId, itemKey, label, reason: "missing_note", completed: false, note: "", createdAt: now, updatedAt: now });
      }
      if (generated.length > 0) await db.insert(schema.revisitTasks).values(generated);
      ctx.invalidateQueries();
      return { ok: true, count: generated.length, message: generated.length === 0 ? "미완료 항목이나 비어 있는 현장 메모가 없습니다." : null };
    },
  }),

  addRevisitTask: defineAction({
    request: z.object({ propertyId: z.number().int().positive(), label: z.string().trim().min(1).max(120) }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const now = new Date();
      await db.insert(schema.revisitTasks).values({ propertyId: args.propertyId, itemKey: `custom-${crypto.randomUUID()}`, label: args.label, reason: "custom", completed: false, note: "", createdAt: now, updatedAt: now });
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  updateRevisitTask: defineAction({
    request: z.object({ id: z.number().int().positive(), completed: z.boolean(), note: z.string().max(500) }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await db.update(schema.revisitTasks).set({ completed: args.completed, note: args.note, updatedAt: new Date() }).where(eq(schema.revisitTasks.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  startPriceTracking: defineAction({
    request: z.object({ propertyId: z.number().int().positive(), targetPriceMan: z.number().int().nonnegative().nullable() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [property] = await db.select().from(schema.properties).where(eq(schema.properties.id, args.propertyId)).limit(1);
      if (!property) return { ok: false };
      const now = new Date();
      await db.insert(schema.priceTrackers).values({ propertyId: args.propertyId, active: true, targetPriceMan: args.targetPriceMan, createdAt: now, updatedAt: now }).onConflictDoUpdate({
        target: schema.priceTrackers.propertyId,
        set: { active: true, targetPriceMan: args.targetPriceMan, updatedAt: now },
      });
      const existing = await db.select({ id: schema.priceSnapshots.id }).from(schema.priceSnapshots).where(eq(schema.priceSnapshots.propertyId, args.propertyId)).limit(1);
      if (!existing[0]) {
        await db.insert(schema.priceSnapshots).values({ propertyId: args.propertyId, amountMan: property.askingPriceMan, kind: property.priceBasis, note: "추적 시작 기준값", sourceUrl: property.sourceReference, recordedAt: now });
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  addPriceSnapshot: defineAction({
    request: z.object({ propertyId: z.number().int().positive(), amountMan: z.number().int().nonnegative().max(10000000), kind: z.enum(["asking", "official_trade"]), note: z.string().max(300) }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [property] = await db.select({ sourceReference: schema.properties.sourceReference }).from(schema.properties).where(eq(schema.properties.id, args.propertyId)).limit(1);
      if (!property) return { ok: false };
      await db.insert(schema.priceSnapshots).values({ ...args, sourceUrl: args.kind === "official_trade" ? property.sourceReference : null, recordedAt: new Date() });
      await db.update(schema.priceTrackers).set({ updatedAt: new Date() }).where(eq(schema.priceTrackers.propertyId, args.propertyId));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  saveFinanceScenario: defineAction({
    request: z.object({
      propertyId: z.number().int().positive(),
      purchasePriceMan: z.number().int().nonnegative().max(10000000),
      ownFundsMan: z.number().int().nonnegative().max(10000000),
      annualIncomeMan: z.number().int().nonnegative().max(10000000),
      otherAnnualDebtMan: z.number().int().nonnegative().max(10000000),
      loanRatePct: z.number().min(0).max(100),
      loanYears: z.number().int().min(1).max(50),
      ltvPct: z.number().min(0).max(100),
      acquisitionTaxPct: z.number().min(0).max(100),
      brokeragePct: z.number().min(0).max(100),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const { propertyId, ...values } = args;
      const now = new Date();
      await db.insert(schema.financeScenarios).values({ propertyId, ...values, updatedAt: now }).onConflictDoUpdate({
        target: schema.financeScenarios.propertyId,
        set: { ...values, updatedAt: now },
      });
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  getPropertyDetail: defineAction({
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({
      property: propertySchema.nullable(),
      checklist: z.array(checklistSchema),
      photos: z.array(photoSchema),
      voiceMemos: z.array(voiceMemoSchema),
      references: z.array(referenceSchema),
      nearby: z.array(nearbySchema),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [property] = await db.select().from(schema.properties).where(eq(schema.properties.id, args.id)).limit(1);
      if (!property) return { property: null, checklist: [], photos: [], voiceMemos: [], references: [], nearby: [] };

      const [checklistRows, photoRows, voiceMemoRows, referenceRows, nearbyRows] = await Promise.all([
        db.select().from(schema.checklistEntries).where(eq(schema.checklistEntries.propertyId, args.id)).orderBy(asc(schema.checklistEntries.itemKey)),
        db.select().from(schema.photos).where(eq(schema.photos.propertyId, args.id)).orderBy(desc(schema.photos.createdAt)),
        db.select().from(schema.voiceMemos).where(eq(schema.voiceMemos.propertyId, args.id)).orderBy(desc(schema.voiceMemos.createdAt), desc(schema.voiceMemos.id)),
        db.select().from(schema.referenceResults).where(eq(schema.referenceResults.propertyId, args.id)).orderBy(asc(schema.referenceResults.kind), asc(schema.referenceResults.rank)),
        db.select().from(schema.nearbyPlaces).where(eq(schema.nearbyPlaces.propertyId, args.id)).orderBy(asc(schema.nearbyPlaces.distanceM)),
      ]);

      const photos = await Promise.all(
        photoRows.map(async (row) => ({
          id: row.id,
          url: await ctx.blobs.getUrl(row.blobKey, { expiresInSeconds: 3600 }),
          caption: row.caption,
          createdAt: row.createdAt.toISOString(),
        })),
      );

      const voiceMemos = await Promise.all(
        voiceMemoRows.map(async (row) => ({
          id: row.id,
          propertyId: row.propertyId,
          listingId: row.listingId,
          checklistItemKey: row.checklistItemKey,
          title: row.title,
          url: await ctx.blobs.getUrl(row.blobKey, { expiresInSeconds: 3600 }),
          mimeType: row.mimeType,
          durationSec: row.durationSec,
          createdAt: row.createdAt.toISOString(),
        })),
      );

      return {
        property: serializeProperty(property),
        checklist: checklistRows.map((row) => ({
          itemKey: row.itemKey,
          checked: row.checked,
          note: row.note,
          updatedAt: row.updatedAt.toISOString(),
        })),
        photos,
        voiceMemos,
        references: referenceRows.map((row) => ({
          id: row.id,
          kind: row.kind,
          title: row.title,
          url: row.url,
          source: row.source,
          snippet: row.snippet,
          publishedAt: row.publishedAt,
          rank: row.rank,
          fetchedAt: row.fetchedAt.toISOString(),
        })),
        nearby: nearbyRows.map((row) => ({
          id: row.id,
          category: row.category,
          name: row.name,
          address: row.address,
          latitude: row.latitude,
          longitude: row.longitude,
          distanceM: row.distanceM,
          fetchedAt: row.fetchedAt.toISOString(),
        })),
      };
    },
  }),

  geocodeProperty: defineAction({
    request: z.object({ query: z.string().trim().min(4).max(200) }),
    response: z.object({
      ok: z.boolean(),
      message: z.string().nullable(),
      candidates: z.array(z.object({
        id: z.string(),
        label: z.string(),
        name: z.string().nullable(),
        latitude: z.number(),
        longitude: z.number(),
        type: z.string().nullable(),
      })),
    }),
    async handler(_ctx, args) {
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
  }),

  geocodeArea: defineAction({
    request: z.object({ query: z.string().trim().min(2).max(100) }),
    response: z.object({
      ok: z.boolean(),
      message: z.string().nullable(),
      candidates: z.array(z.object({
        id: z.string(),
        label: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable(),
        lawdCd: z.string().nullable(),
        regionName: z.string().nullable(),
      })),
    }),
    async handler(_ctx, args) {
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
  }),

  checkOfficialApiConnection: defineAction({
    privileged: [privileged.fetchMolitApartmentTrades, privileged.fetchMolitApartmentRents],
    request: z.object({ serviceKey: z.string().trim().min(10).max(500).optional() }),
    response: z.object({
      status: z.enum(["ok", "not_configured", "error", "rate_limited", "owner_only"]),
      message: z.string(),
      variant: z.enum(["detail", "basic"]).nullable(),
      rentAvailable: z.boolean(),
    }),
    async handler(ctx, args) {
      if (isNonOwnerViewer(ctx)) {
        return { status: "owner_only" as const, message: "실거래 API 연결 확인은 앱 소유자만 사용할 수 있습니다.", variant: null, rentAvailable: false };
      }
      const date = new Date();
      date.setUTCMonth(date.getUTCMonth() - 1);
      const dealYmd = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      const result = await ctx.executePrivileged(privileged.fetchMolitApartmentTrades, {
        lawdCd: "11680",
        dealYmd,
        serviceKey: args.serviceKey,
      });
      if (result.status === "ok") {
        const rent = await ctx.executePrivileged(privileged.fetchMolitApartmentRents, {
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
  }),

  searchOfficialTransactions: defineAction({
    privileged: [privileged.fetchMolitApartmentTrades],
    request: z.object({
      lawdCd: z.string().regex(/^\d{5}$/),
      regionLabel: z.string().trim().min(2).max(80),
      dealMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
      serviceKey: z.string().trim().min(10).max(500).optional(),
    }),
    response: z.object({
      status: z.enum(["ok", "needs_connection", "error", "owner_only"]),
      message: z.string().nullable(),
      sourceUrl: z.string(),
      fetchedAt: z.string().nullable(),
      transactions: z.array(officialTransactionSchema),
    }),
    async handler(ctx, args) {
      if (isNonOwnerViewer(ctx)) {
        return { status: "owner_only" as const, message: "실거래 조회는 앱 소유자만 사용할 수 있습니다.", sourceUrl: OFFICIAL_SOURCE_URL, fetchedAt: null, transactions: [] };
      }
      const db = ctx.db<typeof schema>();
      const cached = async () => {
        const rows = await db.select().from(schema.officialTransactions)
          .where(and(eq(schema.officialTransactions.lawdCd, args.lawdCd), like(schema.officialTransactions.dealYmd, `${args.dealMonth}%`)))
          .orderBy(desc(schema.officialTransactions.dealYmd), desc(schema.officialTransactions.dealAmountMan));
        return rows.map(serializeOfficialTransaction);
      };
      try {
        const serviceKey = args.serviceKey ?? (await readStoredServiceKey(ctx));
        const result = await ctx.executePrivileged(privileged.fetchMolitApartmentTrades, { lawdCd: args.lawdCd, dealYmd: args.dealMonth.replace("-", ""), serviceKey });
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
        ctx.invalidateQueries();
        const transactions = await cached();
        return { status: "ok" as const, message: transactions.length === 0 ? "선택한 달에 신고된 아파트 매매 거래가 없습니다." : null, sourceUrl: OFFICIAL_SOURCE_URL, fetchedAt: fetchedAt.toISOString(), transactions };
      } catch {
        const transactions = await cached();
        return { status: "error" as const, message: "실거래가를 불러오는 중 문제가 생겼습니다. 저장된 결과가 있으면 그대로 표시합니다.", sourceUrl: OFFICIAL_SOURCE_URL, fetchedAt: transactions[0]?.fetchedAt ?? null, transactions };
      }
    },
  }),

  searchOfficialRentTransactions: defineAction({
    privileged: [privileged.fetchMolitApartmentRents],
    request: z.object({
      lawdCd: z.string().regex(/^\d{5}$/),
      regionLabel: z.string().trim().min(2).max(80),
      dealMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
      serviceKey: z.string().trim().min(10).max(500).optional(),
    }),
    response: z.object({
      status: z.enum(["ok", "needs_connection", "error", "owner_only"]),
      message: z.string().nullable(),
      sourceUrl: z.string(),
      fetchedAt: z.string().nullable(),
      transactions: z.array(officialRentTransactionSchema),
    }),
    async handler(ctx, args) {
      if (isNonOwnerViewer(ctx)) {
        return { status: "owner_only" as const, message: "전월세 실거래 조회는 앱 소유자만 사용할 수 있습니다.", sourceUrl: OFFICIAL_RENT_SOURCE_URL, fetchedAt: null, transactions: [] };
      }
      const db = ctx.db<typeof schema>();
      const cached = async () => {
        const rows = await db.select().from(schema.officialRentTransactions)
          .where(and(eq(schema.officialRentTransactions.lawdCd, args.lawdCd), like(schema.officialRentTransactions.dealYmd, `${args.dealMonth}%`)))
          .orderBy(desc(schema.officialRentTransactions.dealYmd), desc(schema.officialRentTransactions.depositMan));
        return rows.map(serializeOfficialRentTransaction);
      };
      try {
        const serviceKey = args.serviceKey ?? (await readStoredServiceKey(ctx));
        const result = await ctx.executePrivileged(privileged.fetchMolitApartmentRents, { lawdCd: args.lawdCd, dealYmd: args.dealMonth.replace("-", ""), serviceKey });
        if (result.status === "not_configured") {
          const transactions = await cached();
          return {
            status: "needs_connection" as const,
            message: "설정에서 공공데이터포털 일반 인증키를 연결해 주세요.",
            sourceUrl: OFFICIAL_RENT_SOURCE_URL,
            fetchedAt: transactions[0]?.fetchedAt ?? null,
            transactions,
          };
        }
        if (result.status !== "ok" || result.variant === null) {
          const transactions = await cached();
          return { status: "error" as const, message: result.status === "rate_limited" ? "공공데이터포털 호출 한도에 도달했습니다. 다음 갱신 시점에 다시 시도해 주세요." : (result.message ?? "국토교통부 전월세 실거래가 API에 연결하지 못했습니다."), sourceUrl: OFFICIAL_RENT_SOURCE_URL, fetchedAt: transactions[0]?.fetchedAt ?? null, transactions };
        }
        const apiVariant = result.variant;
        const xml = result.xml;

        const fetchedAt = new Date();
        const parsedRows = parseMolitRentRows(xml, args.lawdCd, args.regionLabel, apiVariant, fetchedAt);

        const oldRows = await db.select().from(schema.officialRentTransactions)
          .where(and(eq(schema.officialRentTransactions.lawdCd, args.lawdCd), like(schema.officialRentTransactions.dealYmd, `${args.dealMonth}%`)));
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

        await db.delete(schema.officialRentTransactions).where(and(eq(schema.officialRentTransactions.lawdCd, args.lawdCd), like(schema.officialRentTransactions.dealYmd, `${args.dealMonth}%`)));
        if (parsedRows.length > 0) await db.insert(schema.officialRentTransactions).values(parsedRows);
        ctx.invalidateQueries();
        const transactions = await cached();
        return { status: "ok" as const, message: transactions.length === 0 ? "선택한 달에 신고된 아파트 전월세 거래가 없습니다." : null, sourceUrl: OFFICIAL_RENT_SOURCE_URL, fetchedAt: fetchedAt.toISOString(), transactions };
      } catch {
        const transactions = await cached();
        return { status: "error" as const, message: "전월세 실거래가를 불러오는 중 문제가 생겼습니다. 저장된 결과가 있으면 그대로 표시합니다.", sourceUrl: OFFICIAL_RENT_SOURCE_URL, fetchedAt: transactions[0]?.fetchedAt ?? null, transactions };
      }
    },
  }),

  getNearbyApartments: defineAction({
    request: z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      radiusKm: z.union([z.literal(2), z.literal(5), z.literal(10)]),
    }),
    response: z.object({
      status: z.enum(["ok", "no_data", "owner_only"]),
      message: z.string().nullable(),
      sourceUrl: z.string(),
      fetchedAt: z.string().nullable(),
      center: z.object({ latitude: z.number(), longitude: z.number() }),
      radiusKm: z.number(),
      apartments: z.array(nearbyApartmentSchema),
      savedProperties: z.array(nearbySavedPropertySchema),
    }),
    async handler(ctx, args) {
      if (isNonOwnerViewer(ctx)) {
        return { status: "owner_only" as const, message: "주변 실거래 조회는 앱 소유자만 사용할 수 있습니다.", sourceUrl: OFFICIAL_SOURCE_URL, fetchedAt: null, center: { latitude: args.latitude, longitude: args.longitude }, radiusKm: args.radiusKm, apartments: [], savedProperties: [] };
      }
      const db = ctx.db<typeof schema>();
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
  }),

  getPropertyRentContext: defineAction({
    request: z.object({
      propertyId: z.number().int().positive(),
      lawdCd: z.string().regex(/^\d{5}$/).nullable(),
      areaSqm: z.number().positive().max(1000),
      depositPropertyAreaToleranceSqm: z.number().min(0).max(20).default(1.5),
    }),
    response: z.object({
      status: z.enum(["ok", "no_data", "owner_only"]),
      message: z.string().nullable(),
      rentSourceUrl: z.string(),
      tradeSourceUrl: z.string(),
      summary: z.object({
        jeonseMedianMan: z.number().nullable(),
        jeonseCount: z.number(),
        wolseMedianMan: z.number().nullable(),
        wolseAvgMonthlyMan: z.number().nullable(),
        wolseCount: z.number(),
        saleMedianMan: z.number().nullable(),
        saleCount: z.number(),
        jeonseRatioPct: z.number().nullable(),
        gapMan: z.number().nullable(),
        monthRange: z.string().nullable(),
        fetchedAt: z.string().nullable(),
      }).nullable(),
    }),
    async handler(ctx, args) {
      if (isNonOwnerViewer(ctx)) {
        return { status: "owner_only" as const, message: "전월세 시세 요약은 앱 소유자만 사용할 수 있습니다.", rentSourceUrl: OFFICIAL_RENT_SOURCE_URL, tradeSourceUrl: OFFICIAL_SOURCE_URL, summary: null };
      }
      const db = ctx.db<typeof schema>();
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
  }),

  importOfficialTransaction: defineAction({
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean(), id: z.number().nullable(), message: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [transaction] = await db.select().from(schema.officialTransactions).where(eq(schema.officialTransactions.id, args.id)).limit(1);
      if (!transaction) return { ok: false, id: null, message: "선택한 실거래 내역을 찾을 수 없습니다." };
      const [alreadyImported] = await db.select({ id: schema.properties.id }).from(schema.properties).where(eq(schema.properties.sourceRecordId, transaction.fingerprint)).limit(1);
      if (alreadyImported) return { ok: true, id: alreadyImported.id, message: null };
      let latitude = transaction.latitude;
      let longitude = transaction.longitude;
      let resolvedAddress = transaction.roadAddress ?? [transaction.regionLabel, transaction.legalDong, transaction.jibun].filter(Boolean).join(" ");
      if (latitude === null || longitude === null) {
        const found = await geocodeExactAddress(resolvedAddress);
        if (!found) return { ok: false, id: null, message: "이 거래의 위치를 확인하지 못했습니다. 주소를 직접 등록해 주세요." };
        latitude = found.latitude;
        longitude = found.longitude;
        resolvedAddress = found.label;
        await db.update(schema.officialTransactions).set({ latitude, longitude }).where(eq(schema.officialTransactions.id, transaction.id));
      }
      const now = new Date();
      const result = await db.insert(schema.properties).values({
        name: transaction.apartmentName,
        address: transaction.roadAddress ?? `${transaction.regionLabel} ${transaction.legalDong} ${transaction.jibun ?? ""}`.trim(),
        resolvedAddress,
        latitude,
        longitude,
        areaSqm: transaction.areaSqm,
        askingPriceMan: transaction.dealAmountMan,
        depositMan: null,
        monthlyRentMan: null,
        purpose: "both",
        visitDate: null,
        memo: `${transaction.dealYmd} 신고 실거래 · ${transaction.floor === null ? "층 정보 없음" : `${transaction.floor}층`}`,
        priceBasis: "official_trade",
        sourceReference: OFFICIAL_SOURCE_URL,
        sourceRecordId: transaction.fingerprint,
        geocodeSource: "국토교통부 실거래가 + OpenStreetMap Nominatim",
        createdAt: now,
        updatedAt: now,
      }).returning({ id: schema.properties.id });
      const inserted = result[0];
      if (!inserted) return { ok: false, id: null, message: "임장자료로 저장하지 못했습니다." };
      ctx.invalidateQueries();
      return { ok: true, id: inserted.id, message: null };
    },
  }),

  createProperty: defineAction({
    request: z.object({
      name: z.string().trim().min(1).max(80),
      address: z.string().trim().min(4).max(200),
      resolvedAddress: z.string().trim().min(4).max(300),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      areaSqm: z.number().positive().max(10000),
      askingPriceMan: z.number().int().nonnegative().max(10000000),
      depositMan: z.number().int().nonnegative().max(10000000).nullable(),
      monthlyRentMan: z.number().int().nonnegative().max(1000000).nullable(),
      purpose: purposeSchema,
      visitDate: z.string().nullable(),
      memo: z.string().max(2000),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const now = new Date();
      const result = await db.insert(schema.properties).values({ ...args, geocodeSource: "OpenStreetMap Nominatim", createdAt: now, updatedAt: now }).returning({ id: schema.properties.id });
      const inserted = result[0];
      if (!inserted) throw new Error("매물을 저장하지 못했습니다.");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  updateProperty: defineAction({
    request: z.object({
      id: z.number().int().positive(),
      name: z.string().trim().min(1).max(80),
      areaSqm: z.number().positive().max(10000),
      askingPriceMan: z.number().int().nonnegative().max(10000000),
      depositMan: z.number().int().nonnegative().max(10000000).nullable(),
      monthlyRentMan: z.number().int().nonnegative().max(1000000).nullable(),
      purpose: purposeSchema,
      visitDate: z.string().nullable(),
      memo: z.string().max(2000),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const { id, ...values } = args;
      const [existing] = await db.select({ areaSqm: schema.properties.areaSqm, askingPriceMan: schema.properties.askingPriceMan, priceBasis: schema.properties.priceBasis }).from(schema.properties).where(eq(schema.properties.id, id)).limit(1);
      const priceWasOverridden = existing?.priceBasis === "official_trade" && (existing.areaSqm !== values.areaSqm || existing.askingPriceMan !== values.askingPriceMan);
      await db.update(schema.properties).set({ ...values, ...(priceWasOverridden ? { priceBasis: "asking" as const, sourceReference: null } : {}), updatedAt: new Date() }).where(eq(schema.properties.id, id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  deleteProperty: defineAction({
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [photoRows, voiceRows] = await Promise.all([
        db.select({ blobKey: schema.photos.blobKey }).from(schema.photos).where(eq(schema.photos.propertyId, args.id)),
        db.select({ blobKey: schema.voiceMemos.blobKey }).from(schema.voiceMemos).where(eq(schema.voiceMemos.propertyId, args.id)),
      ]);
      await db.delete(schema.properties).where(eq(schema.properties.id, args.id));
      await Promise.all([
        ...photoRows.map((row) => ctx.blobs.delete(row.blobKey).catch(() => undefined)),
        ...voiceRows.map((row) => ctx.blobs.delete(row.blobKey).catch(() => undefined)),
      ]);
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  saveChecklistEntry: defineAction({
    request: z.object({
      propertyId: z.number().int().positive(),
      itemKey: z.string().min(1).max(80),
      checked: z.boolean(),
      note: z.string().max(500),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await db.insert(schema.checklistEntries).values({ ...args, updatedAt: new Date() }).onConflictDoUpdate({
        target: [schema.checklistEntries.propertyId, schema.checklistEntries.itemKey],
        set: { checked: args.checked, note: args.note, updatedAt: new Date() },
      });
      await db.update(schema.properties).set({ updatedAt: new Date() }).where(eq(schema.properties.id, args.propertyId));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  addPhoto: defineAction({
    request: z.object({
      propertyId: z.number().int().positive(),
      dataBase64: z.string().min(20).max(12_000_000),
      mimeType: z.enum(["image/jpeg", "image/png"]),
      caption: z.string().max(200),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const extension = args.mimeType === "image/png" ? "png" : "jpg";
      const key = `properties/${args.propertyId}/${crypto.randomUUID()}.${extension}`;
      const bytes = Uint8Array.from(Buffer.from(args.dataBase64, "base64"));
      await ctx.blobs.put(key, bytes, { contentType: args.mimeType });
      const result = await db.insert(schema.photos).values({ propertyId: args.propertyId, blobKey: key, caption: args.caption, createdAt: new Date() }).returning({ id: schema.photos.id });
      const inserted = result[0];
      if (!inserted) throw new Error("사진을 저장하지 못했습니다.");
      await db.update(schema.properties).set({ updatedAt: new Date() }).where(eq(schema.properties.id, args.propertyId));
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  deletePhoto: defineAction({
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [row] = await db.select().from(schema.photos).where(eq(schema.photos.id, args.id)).limit(1);
      if (row) {
        await db.delete(schema.photos).where(eq(schema.photos.id, args.id));
        await ctx.blobs.delete(row.blobKey).catch(() => undefined);
        await db.update(schema.properties).set({ updatedAt: new Date() }).where(eq(schema.properties.id, row.propertyId));
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  addVoiceMemo: defineAction({
    request: z.object({
      propertyId: z.number().int().positive(),
      dataBase64: z.string().min(20).max(12_000_000),
      mimeType: z.enum(["audio/webm", "audio/mp4", "audio/ogg", "audio/wav"]),
      durationSec: z.number().min(0).max(36000).nullable(),
      title: z.string().max(100),
      listingId: z.number().int().positive().nullable().optional(),
      checklistItemKey: z.string().max(80).nullable().optional(),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [property] = await db.select({ id: schema.properties.id }).from(schema.properties).where(eq(schema.properties.id, args.propertyId)).limit(1);
      if (!property) throw new Error("매물을 찾을 수 없습니다.");
      let listingId: number | null = null;
      if (args.listingId) {
        const [listing] = await db.select({ id: schema.listings.id, propertyId: schema.listings.propertyId }).from(schema.listings).where(eq(schema.listings.id, args.listingId)).limit(1);
        if (!listing || listing.propertyId !== args.propertyId) throw new Error("매물 기록을 찾을 수 없습니다.");
        listingId = listing.id;
      }
      const extension = { "audio/webm": "webm", "audio/mp4": "m4a", "audio/ogg": "ogg", "audio/wav": "wav" }[args.mimeType];
      const key = `voice_memos/${args.propertyId}/${crypto.randomUUID()}.${extension}`;
      const bytes = Uint8Array.from(Buffer.from(args.dataBase64, "base64"));
      await ctx.blobs.put(key, bytes, { contentType: args.mimeType });
      const checklistItemKey = args.checklistItemKey?.trim() ? args.checklistItemKey.trim() : null;
      const result = await db
        .insert(schema.voiceMemos)
        .values({
          propertyId: args.propertyId,
          listingId,
          checklistItemKey,
          title: args.title.trim(),
          blobKey: key,
          mimeType: args.mimeType,
          durationSec: args.durationSec === null ? null : Math.round(args.durationSec * 10) / 10,
          createdAt: new Date(),
        })
        .returning({ id: schema.voiceMemos.id });
      const inserted = result[0];
      if (!inserted) throw new Error("음성 메모를 저장하지 못했습니다.");
      await db.update(schema.properties).set({ updatedAt: new Date() }).where(eq(schema.properties.id, args.propertyId));
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  updateVoiceMemo: defineAction({
    request: z.object({ id: z.number().int().positive(), title: z.string().max(100) }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [row] = await db.select({ propertyId: schema.voiceMemos.propertyId }).from(schema.voiceMemos).where(eq(schema.voiceMemos.id, args.id)).limit(1);
      if (!row) throw new Error("음성 메모를 찾을 수 없습니다.");
      await db.update(schema.voiceMemos).set({ title: args.title.trim() }).where(eq(schema.voiceMemos.id, args.id));
      await db.update(schema.properties).set({ updatedAt: new Date() }).where(eq(schema.properties.id, row.propertyId));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  deleteVoiceMemo: defineAction({
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [row] = await db.select().from(schema.voiceMemos).where(eq(schema.voiceMemos.id, args.id)).limit(1);
      if (row) {
        await db.delete(schema.voiceMemos).where(eq(schema.voiceMemos.id, args.id));
        await ctx.blobs.delete(row.blobKey).catch(() => undefined);
        await db.update(schema.properties).set({ updatedAt: new Date() }).where(eq(schema.properties.id, row.propertyId));
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  refreshReferences: defineAction({
    request: z.object({ propertyId: z.number().int().positive() }),
    response: z.object({ ok: z.boolean(), count: z.number(), message: z.string().nullable() }),
    async handler(ctx, args) {
      if (isNonOwnerViewer(ctx)) {
        return { ok: false, count: 0, message: "외부 참고자료 찾기는 앱 소유자만 사용할 수 있습니다." };
      }
      const db = ctx.db<typeof schema>();
      const [property] = await db.select().from(schema.properties).where(eq(schema.properties.id, args.propertyId)).limit(1);
      if (!property) return { ok: false, count: 0, message: "매물을 찾을 수 없습니다." };

      try {
        const year = new Date().getFullYear();
        const [priceSearch, locationSearch] = await Promise.all([
          ctx.tool.web_search(`${property.name} ${property.address} 아파트 최근 실거래가 ${year} 국토교통부`),
          ctx.tool.web_search(`${property.address} 주변 지하철역 학교 대형마트 병원 도보 거리`),
        ]);
        const fetchedAt = new Date();
        const rows: Array<typeof schema.referenceResults.$inferInsert> = [];
        const groups: Array<{ kind: "price" | "location"; results: typeof priceSearch.content.results }> = [
          { kind: "price", results: priceSearch.content.results },
          { kind: "location", results: locationSearch.content.results },
        ];
        for (const group of groups) {
          for (const result of group.results.filter((item) => item.url).slice(0, 5)) {
            if (!result.url) continue;
            rows.push({
              propertyId: args.propertyId,
              kind: group.kind,
              title: result.title,
              url: result.url,
              source: result.source,
              snippet: result.snippet ? result.snippet.slice(0, 700) : null,
              publishedAt: result.published_at,
              rank: result.rank,
              fetchedAt,
            });
          }
        }
        const nearbyRows: Array<typeof schema.nearbyPlaces.$inferInsert> = [];
        const nearbyQueries: Array<{ category: "transit" | "school" | "market" | "hospital"; query: string; expectedCategory: string; expectedType: string }> = [
          { category: "transit", query: "railway station", expectedCategory: "railway", expectedType: "station" },
          { category: "school", query: "school", expectedCategory: "amenity", expectedType: "school" },
          { category: "market", query: "supermarket", expectedCategory: "shop", expectedType: "supermarket" },
          { category: "hospital", query: "hospital", expectedCategory: "amenity", expectedType: "hospital" },
        ];
        const west = property.longitude - 0.025;
        const east = property.longitude + 0.025;
        const north = property.latitude + 0.02;
        const south = property.latitude - 0.02;
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
              .map((place) => ({
                place,
                lat: Number(place.lat),
                lng: Number(place.lon),
              }))
              .filter((entry) => Number.isFinite(entry.lat) && Number.isFinite(entry.lng))
              .map((entry) => ({
                propertyId: args.propertyId,
                category: item.category,
                name: entry.place.name ?? entry.place.display_name,
                address: entry.place.display_name,
                latitude: entry.lat,
                longitude: entry.lng,
                distanceM: distanceMeters(property.latitude, property.longitude, entry.lat, entry.lng),
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
        ctx.invalidateQueries();
        return {
          ok: true,
          count: rows.length + nearbyRows.length,
          message: rows.length + nearbyRows.length === 0 ? "관련 자료를 찾지 못했습니다. 주소를 더 구체적으로 입력해 보세요." : nearbyFetchSucceeded ? null : "검색 자료는 갱신했지만 주변 시설 좌표는 이번에 불러오지 못했습니다.",
        };
      } catch {
        return { ok: false, count: 0, message: "외부 자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." };
      }
    },
  }),

  // ---------------- Watchlist (관심 단지 시세 트래킹) ----------------

  listWatchItems: defineAction({
    request: z.object({}),
    response: z.object({ items: z.array(watchListItemSchema) }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.watchItems).orderBy(desc(schema.watchItems.createdAt));
      const items: Array<z.infer<typeof watchListItemSchema>> = [];
      for (const row of rows) {
        const series = await db
          .select()
          .from(schema.watchPriceSeries)
          .where(eq(schema.watchPriceSeries.watchId, row.id))
          .orderBy(desc(schema.watchPriceSeries.month));
        const withTrades = series.filter((item) => item.tradeCount > 0 && item.avgPriceMan !== null);
        const latest = withTrades[0];
        const previous = withTrades[1];
        const rentSeries = await db
          .select()
          .from(schema.watchRentSeries)
          .where(eq(schema.watchRentSeries.watchId, row.id))
          .orderBy(desc(schema.watchRentSeries.month));
        const latestRent = rentSeries.find((item) => item.jeonseCount > 0 || item.wolseCount > 0) ?? null;
        const unread = await db
          .select({ id: schema.priceAlerts.id })
          .from(schema.priceAlerts)
          .where(and(eq(schema.priceAlerts.watchId, row.id), isNull(schema.priceAlerts.readAt)));
        const [lastRun] = await db
          .select()
          .from(schema.watchCheckRuns)
          .where(eq(schema.watchCheckRuns.watchId, row.id))
          .orderBy(desc(schema.watchCheckRuns.createdAt))
          .limit(1);
        items.push({
          ...serializeWatchItem(row),
          latest: latest?.avgPriceMan === null || latest?.avgPriceMan === undefined
            ? null
            : {
                month: latest.month,
                avgMan: latest.avgPriceMan,
                tradeCount: latest.tradeCount,
                prevMonth: previous?.month ?? null,
                prevAvgMan: previous?.avgPriceMan ?? null,
                changePct: previous?.avgPriceMan != null && previous.avgPriceMan > 0
                  ? ((latest.avgPriceMan - previous.avgPriceMan) / previous.avgPriceMan) * 100
                  : null,
              },
          latestRent: latestRent === null
            ? null
            : {
                month: latestRent.month,
                jeonseMedianMan: latestRent.jeonseMedianMan,
                jeonseCount: latestRent.jeonseCount,
                wolseMedianMan: latestRent.wolseMedianMan,
                wolseAvgMonthlyMan: latestRent.wolseAvgMonthlyMan,
                wolseCount: latestRent.wolseCount,
              },
          unreadAlerts: unread.length,
          lastRun: lastRun ? {
            status: lastRun.status,
            createdAt: lastRun.createdAt.toISOString(),
            message: lastRun.message,
            newTrades: lastRun.newTrades,
            alertsCreated: lastRun.alertsCreated,
          } : null,
        });
      }
      return { items };
    },
  }),

  addWatchItem: defineAction({
    request: z.object({
      lawdCd: z.string().regex(/^\d{5}$/),
      regionLabel: z.string().trim().min(2).max(80),
      complexName: z.string().trim().min(2).max(80),
      areaSqm: z.number().positive().max(1000),
      areaToleranceSqm: z.number().min(0).max(20).default(1),
      dropAlertPct: z.number().min(0).max(50).default(3),
      targetPriceMan: z.number().int().positive().nullable().default(null),
      bargainBelowMan: z.number().int().positive().nullable().default(null),
      notes: z.string().trim().max(500).default(""),
    }),
    response: z.object({ ok: z.boolean(), id: z.number().nullable(), message: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const existing = await db
        .select({ id: schema.watchItems.id })
        .from(schema.watchItems)
        .where(and(
          eq(schema.watchItems.lawdCd, args.lawdCd),
          eq(schema.watchItems.complexName, args.complexName),
        ))
        .limit(1);
      if (existing[0]) {
        return { ok: false, id: null, message: "이미 같은 지역의 같은 단지가 등록되어 있습니다. 조건은 기존 항목에서 수정하세요." };
      }
      const now = new Date();
      await db.insert(schema.watchItems).values({
        lawdCd: args.lawdCd,
        regionLabel: args.regionLabel,
        complexName: args.complexName,
        areaSqm: args.areaSqm,
        areaToleranceSqm: args.areaToleranceSqm,
        active: true,
        dropAlertPct: args.dropAlertPct,
        targetPriceMan: args.targetPriceMan,
        bargainBelowMan: args.bargainBelowMan,
        notes: args.notes,
        createdAt: now,
        updatedAt: now,
      });
      const [created] = await db.select().from(schema.watchItems).orderBy(desc(schema.watchItems.id)).limit(1);
      ctx.invalidateQueries();
      return { ok: true, id: created?.id ?? null, message: null };
    },
  }),

  updateWatchItem: defineAction({
    request: z.object({
      id: z.number().int().positive(),
      complexName: z.string().trim().min(2).max(80).optional(),
      areaSqm: z.number().positive().max(1000).optional(),
      areaToleranceSqm: z.number().min(0).max(20).optional(),
      active: z.boolean().optional(),
      dropAlertPct: z.number().min(0).max(50).optional(),
      targetPriceMan: z.number().int().positive().nullable().optional(),
      bargainBelowMan: z.number().int().positive().nullable().optional(),
      notes: z.string().trim().max(500).optional(),
    }),
    response: z.object({ ok: z.boolean(), message: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const { id, ...patch } = args;
      const [existing] = await db.select().from(schema.watchItems).where(eq(schema.watchItems.id, id)).limit(1);
      if (!existing) return { ok: false, message: "관심 단지를 찾을 수 없습니다." };
      await db.update(schema.watchItems).set({ ...patch, updatedAt: new Date() }).where(eq(schema.watchItems.id, id));
      ctx.invalidateQueries();
      return { ok: true, message: null };
    },
  }),

  deleteWatchItem: defineAction({
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean(), message: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await db.delete(schema.watchItems).where(eq(schema.watchItems.id, args.id));
      ctx.invalidateQueries();
      return { ok: true, message: null };
    },
  }),

  getWatchDetail: defineAction({
    request: z.object({ watchId: z.number().int().positive() }),
    response: z.object({
      watch: watchItemSchema,
      series: z.array(watchSeriesSchema),
      rentSeries: z.array(watchRentSeriesSchema),
      askRecords: z.array(watchAskRecordSchema),
      alerts: z.array(priceAlertSchema),
      runs: z.array(watchCheckRunSchema),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [watch] = await db.select().from(schema.watchItems).where(eq(schema.watchItems.id, args.watchId)).limit(1);
      if (!watch) throw new Error("관심 단지를 찾을 수 없습니다.");
      const series = await db
        .select()
        .from(schema.watchPriceSeries)
        .where(eq(schema.watchPriceSeries.watchId, args.watchId))
        .orderBy(desc(schema.watchPriceSeries.month))
        .limit(24);
      const rentSeries = await db
        .select()
        .from(schema.watchRentSeries)
        .where(eq(schema.watchRentSeries.watchId, args.watchId))
        .orderBy(desc(schema.watchRentSeries.month))
        .limit(24);
      const askRecords = await db
        .select()
        .from(schema.watchAskRecords)
        .where(eq(schema.watchAskRecords.watchId, args.watchId))
        .orderBy(desc(schema.watchAskRecords.recordedAt))
        .limit(30);
      const alerts = await db
        .select()
        .from(schema.priceAlerts)
        .where(eq(schema.priceAlerts.watchId, args.watchId))
        .orderBy(desc(schema.priceAlerts.createdAt))
        .limit(30);
      const runs = await db
        .select()
        .from(schema.watchCheckRuns)
        .where(eq(schema.watchCheckRuns.watchId, args.watchId))
        .orderBy(desc(schema.watchCheckRuns.createdAt))
        .limit(10);
      return {
        watch: serializeWatchItem(watch),
        series: series.reverse().map((row) => ({
          watchId: row.watchId,
          month: row.month,
          avgPriceMan: row.avgPriceMan,
          medianPriceMan: row.medianPriceMan,
          minPriceMan: row.minPriceMan,
          maxPriceMan: row.maxPriceMan,
          tradeCount: row.tradeCount,
          fetchedAt: row.fetchedAt.toISOString(),
        })),
        rentSeries: rentSeries.reverse().map((row) => ({
          watchId: row.watchId,
          month: row.month,
          jeonseAvgMan: row.jeonseAvgMan,
          jeonseMedianMan: row.jeonseMedianMan,
          jeonseMinMan: row.jeonseMinMan,
          jeonseMaxMan: row.jeonseMaxMan,
          jeonseCount: row.jeonseCount,
          wolseAvgMan: row.wolseAvgMan,
          wolseMedianMan: row.wolseMedianMan,
          wolseAvgMonthlyMan: row.wolseAvgMonthlyMan,
          wolseCount: row.wolseCount,
          fetchedAt: row.fetchedAt.toISOString(),
        })),
        askRecords: askRecords.map((row) => ({
          id: row.id,
          watchId: row.watchId,
          amountMan: row.amountMan,
          source: row.source,
          note: row.note,
          recordedAt: row.recordedAt.toISOString(),
        })),
        alerts: alerts.map(serializePriceAlert),
        runs: runs.map(serializeWatchCheckRun),
      };
    },
  }),

  checkWatchPrices: defineAction({
    privileged: [privileged.fetchMolitApartmentTrades, privileged.fetchMolitApartmentRents],
    request: z.object({
      serviceKey: z.string().trim().min(10).max(500).optional(),
      watchIds: z.array(z.number().int().positive()).optional(),
      months: z.number().int().min(1).max(3).optional(),
      scheduled: z.boolean().optional(),
    }),
    response: z.object({
      status: z.enum(["ok", "needs_key", "rate_limited", "error", "skipped", "owner_only"]),
      message: z.string(),
      checked: z.number(),
      totalNewTrades: z.number(),
      totalNewRents: z.number(),
      totalAlerts: z.number(),
    }),
    async handler(ctx, args) {
      if (isNonOwnerViewer(ctx)) {
        return { status: "owner_only" as const, message: "관심 단지 시세 확인은 앱 소유자만 사용할 수 있습니다.", checked: 0, totalNewTrades: 0, totalNewRents: 0, totalAlerts: 0 };
      }
      const db = ctx.db<typeof schema>();
      const scheduled = args.scheduled ?? false;
      if (scheduled) {
        const [setting] = await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, AUTO_CHECK_ENABLED_KEY)).limit(1);
        if (setting?.value !== "1") {
          return { status: "skipped" as const, message: "자동 확인이 꺼져 있어 건너뜁니다.", checked: 0, totalNewTrades: 0, totalNewRents: 0, totalAlerts: 0 };
        }
      }
      const targets = args.watchIds === undefined
        ? await db.select().from(schema.watchItems).where(eq(schema.watchItems.active, true)).orderBy(desc(schema.watchItems.createdAt))
        : await db.select().from(schema.watchItems).where(and(inArray(schema.watchItems.id, args.watchIds), eq(schema.watchItems.active, true)));
      if (targets.length === 0) {
        return { status: "ok" as const, message: "확인할 관심 단지가 없습니다.", checked: 0, totalNewTrades: 0, totalNewRents: 0, totalAlerts: 0 };
      }
      const checkedMonths = monthKeys(args.months ?? 3);
      let checked = 0;
      let totalNewTrades = 0;
      let totalNewRents = 0;
      let totalAlerts = 0;
      let firstFailure: { kind: "needs_key" | "rate_limited"; message: string } | null = null;
      for (const watch of targets) {
        let itemNewTrades = 0;
        let itemNewRents = 0;
        let itemAlerts = 0;
        let itemStatus: "ok" | "needs_key" | "rate_limited" | "error" = "ok";
        let itemMessage: string | null = null;
        for (const month of checkedMonths) {
          const slice = await ensureWatchTradeSlice(ctx, { lawdCd: watch.lawdCd, regionLabel: watch.regionLabel, month, serviceKey: args.serviceKey });
          if (slice.status === "ok") {
            itemNewTrades += slice.inserted;
          } else {
            itemStatus = slice.status === "not_configured" ? "needs_key" : slice.status;
            itemMessage = slice.message;
            if ((slice.status === "not_configured" || slice.status === "rate_limited") && firstFailure === null) {
              firstFailure = slice.status === "not_configured" ? { kind: "needs_key", message: slice.message } : { kind: "rate_limited", message: slice.message };
            }
            if (slice.status === "not_configured" || slice.status === "rate_limited") break;
          }
          // 전월세도 함께 확보한다. 매매는 이미 확인한 달이므로 전월세 실패가 있어도 매매 결과는 살린다.
          const rent = await ensureWatchRentSlice(ctx, { lawdCd: watch.lawdCd, regionLabel: watch.regionLabel, month, serviceKey: args.serviceKey });
          if (rent.status === "ok") {
            itemNewRents += rent.inserted;
          } else if (rent.status === "error") {
            itemMessage = rent.message;
          } else if ((rent.status === "not_configured" || rent.status === "rate_limited") && firstFailure === null) {
            firstFailure = rent.status === "not_configured" ? { kind: "needs_key", message: rent.message } : { kind: "rate_limited", message: rent.message };
          }
          await new Promise((resolve) => setTimeout(resolve, 700));
        }
        if (itemStatus === "ok") {
          try {
            const evaluated = await evaluateWatchAlerts(ctx, watch, checkedMonths, { createAlerts: true });
            itemAlerts = evaluated.alertsCreated;
            await upsertWatchMonthRentSeries(ctx, watch, checkedMonths);
          } catch {
            itemStatus = "error";
            itemMessage = "시세를 집계하지 못했습니다. 잠시 후 다시 확인해 주세요.";
          }
        }
        await db.insert(schema.watchCheckRuns).values({
          watchId: watch.id,
          status: itemStatus,
          monthsChecked: checkedMonths.join(","),
          newTrades: itemNewTrades,
          alertsCreated: itemAlerts,
          message: itemMessage,
          createdAt: new Date(),
        });
        checked += 1;
        totalNewTrades += itemNewTrades;
        totalNewRents += itemNewRents;
        totalAlerts += itemAlerts;
        if (itemStatus === "needs_key" || itemStatus === "rate_limited") break;
      }
      ctx.invalidateQueries();
      if (firstFailure !== null) {
        if (firstFailure.kind === "needs_key") {
          return { status: "needs_key" as const, message: firstFailure.message, checked, totalNewTrades, totalNewRents, totalAlerts };
        }
        return { status: "rate_limited" as const, message: firstFailure.message, checked, totalNewTrades, totalNewRents, totalAlerts };
      }
      return {
        status: "ok" as const,
        message: `${checked}개 단지를 확인했습니다. 새 신고 거래 ${totalNewTrades}건, 새 신고 전월세 ${totalNewRents}건, 새 알림 ${totalAlerts}건.`,
        checked,
        totalNewTrades,
        totalNewRents,
        totalAlerts,
      };
    },
  }),

  fetchWatchHistory: defineAction({
    privileged: [privileged.fetchMolitApartmentTrades, privileged.fetchMolitApartmentRents],
    request: z.object({
      watchId: z.number().int().positive(),
      months: z.number().int().min(1).max(24).optional(),
      serviceKey: z.string().trim().min(10).max(500).optional(),
    }),
    response: z.object({
      status: z.enum(["ok", "needs_key", "rate_limited", "error", "owner_only"]),
      message: z.string(),
      monthsFetched: z.number(),
      monthsTotal: z.number(),
      newTrades: z.number(),
      newRents: z.number(),
    }),
    async handler(ctx, args) {
      const monthsTotal = args.months ?? 12;
      if (isNonOwnerViewer(ctx)) {
        return { status: "owner_only" as const, message: "실거래 과거 로드는 앱 소유자만 사용할 수 있습니다.", monthsFetched: 0, monthsTotal, newTrades: 0, newRents: 0 };
      }
      const db = ctx.db<typeof schema>();
      const [watch] = await db.select().from(schema.watchItems).where(eq(schema.watchItems.id, args.watchId)).limit(1);
      if (!watch) {
        return { status: "error" as const, message: "관심 단지를 찾을 수 없습니다.", monthsFetched: 0, monthsTotal, newTrades: 0, newRents: 0 };
      }
      const months = monthKeys(monthsTotal);
      let monthsFetched = 0;
      let newTrades = 0;
      let newRents = 0;
      let needsKey = false;
      let rateLimited = false;
      let errorCount = 0;
      const fetchedMonths: string[] = [];
      for (const month of months) {
        const slice = await ensureWatchTradeSlice(ctx, { lawdCd: watch.lawdCd, regionLabel: watch.regionLabel, month, serviceKey: args.serviceKey });
        if (slice.status === "ok") {
          monthsFetched += 1;
          newTrades += slice.inserted;
          fetchedMonths.push(month);
        } else if (slice.status === "not_configured") {
          needsKey = true;
          break;
        } else if (slice.status === "rate_limited") {
          rateLimited = true;
          break;
        } else {
          errorCount += 1;
          fetchedMonths.push(month);
        }
        const rent = await ensureWatchRentSlice(ctx, { lawdCd: watch.lawdCd, regionLabel: watch.regionLabel, month, serviceKey: args.serviceKey });
        if (rent.status === "ok") {
          newRents += rent.inserted;
          if (!fetchedMonths.includes(month)) fetchedMonths.push(month);
        } else if (rent.status === "not_configured") {
          needsKey = true;
          break;
        } else if (rent.status === "rate_limited") {
          rateLimited = true;
          break;
        } else {
          errorCount += 1;
        }
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
      if (fetchedMonths.length > 0) {
        try {
          await upsertWatchMonthSeries(ctx, watch, fetchedMonths);
          await upsertWatchMonthRentSeries(ctx, watch, fetchedMonths);
        } catch {
          errorCount += 1;
        }
      }
      ctx.invalidateQueries();
      if (needsKey) {
        return { status: "needs_key" as const, message: "인증키가 없어 과거 실거래를 가져오지 못했습니다. 설정 화면에서 브라우저 인증키를 입력하거나 '서버 인증키'를 등록해 주세요.", monthsFetched, monthsTotal, newTrades, newRents };
      }
      if (rateLimited) {
        return { status: "rate_limited" as const, message: `과거 실거래 ${monthsFetched}/${monthsTotal}개월을 가져왔습니다. API 호출 한도에 도달해 중단됐습니다. 잠시 후 다시 시도해 주세요.`, monthsFetched, monthsTotal, newTrades, newRents };
      }
      if (errorCount > 0 && monthsFetched === 0) {
        return { status: "error" as const, message: "과거 실거래를 가져오지 못했습니다. 인증키와 네트워크 상태를 확인해 주세요.", monthsFetched, monthsTotal, newTrades, newRents };
      }
      return { status: "ok" as const, message: `과거 실거래 ${monthsFetched}/${monthsTotal}개월을 저장했습니다. 새 신고 거래 ${newTrades}건, 새 신고 전월세 ${newRents}건. 알림은 별도로 발생시키지 않았습니다.`, monthsFetched, monthsTotal, newTrades, newRents };
    },
  }),

  addWatchAskRecord: defineAction({
    request: z.object({
      watchId: z.number().int().positive(),
      amountMan: z.number().int().positive().max(10000000),
      source: z.string().trim().max(120).nullable().default(null),
      note: z.string().trim().max(500).nullable().default(null),
    }),
    response: z.object({ ok: z.boolean(), alertsCreated: z.number(), message: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [watch] = await db.select().from(schema.watchItems).where(eq(schema.watchItems.id, args.watchId)).limit(1);
      if (!watch) return { ok: false, alertsCreated: 0, message: "관심 단지를 찾을 수 없습니다." };
      await db.insert(schema.watchAskRecords).values({
        watchId: args.watchId,
        amountMan: args.amountMan,
        source: args.source ?? "",
        note: args.note ?? "",
        recordedAt: new Date(),
      });
      let alertsCreated = 0;
      const month = currentKstMonthKey();
      if (watch.targetPriceMan !== null && args.amountMan <= watch.targetPriceMan) {
        const created = await insertPriceAlertIfNew(ctx, {
          watchId: args.watchId,
          type: "target_reached",
          month,
          title: `${watch.complexName} 호가가 목표가에 도달했습니다`,
          detail: `직접 기록한 호가 ${formatMoneyMan(args.amountMan)}${args.source ? ` (출처: ${args.source})` : ""}이 목표가 ${formatMoneyMan(watch.targetPriceMan)} 이하입니다. 매물 조건을 꼭 다시 확인하세요.`,
          trigger: args.amountMan,
          baseline: watch.targetPriceMan,
          changePct: null,
        });
        if (created) alertsCreated += 1;
      }
      if (watch.bargainBelowMan !== null && args.amountMan <= watch.bargainBelowMan) {
        const created = await insertPriceAlertIfNew(ctx, {
          watchId: args.watchId,
          type: "bargain",
          month,
          title: `${watch.complexName} 급매 기준 이하 호가를 기록했습니다`,
          detail: `직접 기록한 호가 ${formatMoneyMan(args.amountMan)}${args.source ? ` (출처: ${args.source})` : ""}이 급매 기준 ${formatMoneyMan(watch.bargainBelowMan)} 이하입니다. "급매"는 기준가 이하의 직접 기록을 뜻하며, 실제 매물 여부와 계약 조건은 원문과 현장에서 다시 확인하세요.`,
          trigger: args.amountMan,
          baseline: watch.bargainBelowMan,
          changePct: null,
        });
        if (created) alertsCreated += 1;
      }
      ctx.invalidateQueries();
      return { ok: true, alertsCreated, message: null };
    },
  }),

  listPriceAlerts: defineAction({
    request: z.object({ unreadOnly: z.boolean().optional(), limit: z.number().int().min(1).max(100).optional() }),
    response: z.object({ alerts: z.array(priceAlertWithWatchSchema), unreadCount: z.number() }),
    async handler(ctx, args) {
      const unreadOnly = args.unreadOnly ?? false;
      const limit = args.limit ?? 50;
      const db = ctx.db<typeof schema>();
      const rows = unreadOnly
        ? await db.select().from(schema.priceAlerts).where(isNull(schema.priceAlerts.readAt)).orderBy(desc(schema.priceAlerts.createdAt)).limit(limit)
        : await db.select().from(schema.priceAlerts).orderBy(desc(schema.priceAlerts.createdAt)).limit(limit);
      const watches = await db.select().from(schema.watchItems);
      const watchById = new Map<number, { complexName: string; regionLabel: string }>();
      for (const watch of watches) watchById.set(watch.id, { complexName: watch.complexName, regionLabel: watch.regionLabel });
      const unreadCountRows = await db.select({ id: schema.priceAlerts.id }).from(schema.priceAlerts).where(isNull(schema.priceAlerts.readAt));
      return {
        alerts: rows.map((row) => {
          const info = watchById.get(row.watchId);
          return {
            ...serializePriceAlert(row),
            watchComplex: info?.complexName ?? "알 수 없는 단지",
            watchLabel: info?.regionLabel ?? "",
          };
        }),
        unreadCount: unreadCountRows.length,
      };
    },
  }),

  markAlertsRead: defineAction({
    request: z.object({ ids: z.array(z.number().int().positive()) }),
    response: z.object({ ok: z.boolean(), count: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const now = new Date();
      if (args.ids.length === 0) {
        await db.update(schema.priceAlerts).set({ readAt: now }).where(isNull(schema.priceAlerts.readAt));
        const rows = await db.select({ id: schema.priceAlerts.id }).from(schema.priceAlerts);
        ctx.invalidateQueries();
        return { ok: true, count: rows.length };
      }
      await db.update(schema.priceAlerts).set({ readAt: now }).where(inArray(schema.priceAlerts.id, args.ids));
      ctx.invalidateQueries();
      return { ok: true, count: args.ids.length };
    },
  }),

  getAutoCheck: defineAction({
    request: z.object({}),
    response: z.object({ enabled: z.boolean(), supported: z.boolean(), message: z.string() }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const [setting] = await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, AUTO_CHECK_ENABLED_KEY)).limit(1);
      const enabled = setting?.value === "1";
      return {
        enabled,
        supported: true,
        message: enabled
          ? "자동 확인이 켜져 있습니다. 설정 화면의 '서버 인증키'에 저장된 인증키로 매일 이른 아침 확인하고, 조건을 충족하면 알림함에 저장됩니다. 서버 인증키가 등록되지 않은 상태에서는 그날 확인이 '인증키 필요'로 기록됩니다."
          : "자동 확인을 켜면 서버 예약 실행이 매일 이른 아침 실거래를 확인합니다. 자동 확인은 설정 화면의 '서버 인증키'로 동작하고, 브라우저에 저장한 인증키는 이 브라우저에서의 수동 확인에만 쓰입니다.",
      };
    },
  }),

  setAutoCheck: defineAction({
    request: z.object({ enabled: z.boolean() }),
    response: z.object({ ok: z.boolean(), enabled: z.boolean(), message: z.string() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const value = args.enabled ? "1" : "0";
      await db
        .insert(schema.appSettings)
        .values({ key: AUTO_CHECK_ENABLED_KEY, value, updatedAt: new Date() })
        .onConflictDoUpdate({ target: schema.appSettings.key, set: { value, updatedAt: new Date() } });
      ctx.invalidateQueries();
      const hasServerKey = args.enabled ? (await readStoredServiceKey(ctx)) !== undefined : false;
      return {
        ok: true,
        enabled: args.enabled,
        message: args.enabled
          ? hasServerKey
            ? "자동 확인을 켰습니다. 매일 이른 아침 서버 인증키로 실거래를 확인합니다."
            : "자동 확인을 켰습니다. 설정 화면의 '서버 인증키'를 등록해야 매일 이른 아침에 실제 확인이 동작합니다."
          : "자동 확인을 껐습니다. 필요할 때 수동 확인을 사용하세요.",
      };
    },
  }),

  saveServerServiceKey: defineAction({
    request: z.object({ serviceKey: z.string().trim().min(10).max(500) }),
    response: z.object({
      ok: z.boolean(),
      masked: z.string().nullable(),
      updatedAt: z.string().nullable(),
      message: z.string(),
    }),
    async handler(ctx, args) {
      if (isNonOwnerViewer(ctx)) {
        return { ok: false, masked: null, updatedAt: null, message: "서버 인증키 등록은 앱 소유자만 사용할 수 있습니다." };
      }
      const db = ctx.db<typeof schema>();
      const value = args.serviceKey.trim();
      const now = new Date();
      await db
        .insert(schema.appSettings)
        .values({ key: MOLIT_SERVICE_KEY_SETTING_KEY, value, updatedAt: now })
        .onConflictDoUpdate({ target: schema.appSettings.key, set: { value, updatedAt: now } });
      ctx.invalidateQueries();
      return { ok: true, masked: maskServiceKey(value), updatedAt: now.toISOString(), message: "서버 인증키를 등록했습니다. 자동 확인에 사용됩니다." };
    },
  }),

  getServerServiceKeyStatus: defineAction({
    request: z.object({}),
    response: z.object({
      configured: z.boolean(),
      masked: z.string().nullable(),
      updatedAt: z.string().nullable(),
      ownerOnly: z.boolean(),
    }),
    async handler(ctx) {
      if (isNonOwnerViewer(ctx)) {
        return { configured: false, masked: null, updatedAt: null, ownerOnly: true };
      }
      const db = ctx.db<typeof schema>();
      const [setting] = await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, MOLIT_SERVICE_KEY_SETTING_KEY)).limit(1);
      const value = setting?.value.trim() ?? "";
      if (value.length < 10) return { configured: false, masked: null, updatedAt: null, ownerOnly: false };
      return { configured: true, masked: maskServiceKey(value), updatedAt: setting?.updatedAt.toISOString() ?? null, ownerOnly: false };
    },
  }),

  removeServerServiceKey: defineAction({
    request: z.object({}),
    response: z.object({ ok: z.boolean(), message: z.string() }),
    async handler(ctx) {
      if (isNonOwnerViewer(ctx)) {
        return { ok: false, message: "서버 인증키 삭제는 앱 소유자만 사용할 수 있습니다." };
      }
      const db = ctx.db<typeof schema>();
      await db.delete(schema.appSettings).where(eq(schema.appSettings.key, MOLIT_SERVICE_KEY_SETTING_KEY));
      ctx.invalidateQueries();
      return { ok: true, message: "서버 인증키를 삭제했습니다. 자동 확인을 사용하려면 다시 등록해 주세요." };
    },
  }),

  saveVworldKey: defineAction({
    request: z.object({ apiKey: z.string().trim().min(10).max(500) }),
    response: z.object({
      ok: z.boolean(),
      masked: z.string().nullable(),
      updatedAt: z.string().nullable(),
      message: z.string(),
    }),
    async handler(ctx, args) {
      if (isNonOwnerViewer(ctx)) {
        return { ok: false, masked: null, updatedAt: null, message: "VWorld 키 등록은 앱 소유자만 사용할 수 있습니다." };
      }
      const db = ctx.db<typeof schema>();
      const value = args.apiKey.trim();
      const now = new Date();
      await db
        .insert(schema.appSettings)
        .values({ key: VWORLD_API_KEY_SETTING_KEY, value, updatedAt: now })
        .onConflictDoUpdate({ target: schema.appSettings.key, set: { value, updatedAt: now } });
      ctx.invalidateQueries();
      return { ok: true, masked: maskServiceKey(value), updatedAt: now.toISOString(), message: "VWorld 키를 등록했습니다. 지도 배경 타일에 사용됩니다." };
    },
  }),

  getVworldKeyStatus: defineAction({
    request: z.object({}),
    response: z.object({
      configured: z.boolean(),
      masked: z.string().nullable(),
      updatedAt: z.string().nullable(),
      ownerOnly: z.boolean(),
    }),
    async handler(ctx) {
      if (isNonOwnerViewer(ctx)) {
        return { configured: false, masked: null, updatedAt: null, ownerOnly: true };
      }
      const db = ctx.db<typeof schema>();
      const [setting] = await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, VWORLD_API_KEY_SETTING_KEY)).limit(1);
      const value = setting?.value.trim() ?? "";
      if (value.length < 10) return { configured: false, masked: null, updatedAt: null, ownerOnly: false };
      return { configured: true, masked: maskServiceKey(value), updatedAt: setting?.updatedAt.toISOString() ?? null, ownerOnly: false };
    },
  }),

  removeVworldKey: defineAction({
    request: z.object({}),
    response: z.object({ ok: z.boolean(), message: z.string() }),
    async handler(ctx) {
      if (isNonOwnerViewer(ctx)) {
        return { ok: false, message: "VWorld 키 삭제는 앱 소유자만 사용할 수 있습니다." };
      }
      const db = ctx.db<typeof schema>();
      await db.delete(schema.appSettings).where(eq(schema.appSettings.key, VWORLD_API_KEY_SETTING_KEY));
      ctx.invalidateQueries();
      return { ok: true, message: "VWorld 키를 삭제했습니다. 지도 배경 타일은 키를 다시 등록해야 표시됩니다." };
    },
  }),

  getMapTileConfig: defineAction({
    request: z.object({}),
    response: z.object({ configured: z.boolean(), apiKey: z.string().nullable() }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const [setting] = await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, VWORLD_API_KEY_SETTING_KEY)).limit(1);
      const value = setting?.value.trim() ?? "";
      if (value.length < 10) return { configured: false, apiKey: null };
      return { configured: true, apiKey: value };
    },
  }),

  listTourCourses: defineAction({
    request: z.object({}),
    response: z.object({ courses: z.array(courseListItemSchema) }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.tourCourses).orderBy(desc(schema.tourCourses.updatedAt));
      const items: z.infer<typeof courseListItemSchema>[] = [];
      for (const row of rows) {
        const stops = await loadCourseStops(ctx, row.id);
        let totalDistanceM = 0;
        let totalWalkMinutes = 0;
        let completedCount = 0;
        for (let index = 0; index < stops.length; index += 1) {
          const current = stops[index];
          if (current === undefined) continue;
          if (current.stop.completed) completedCount += 1;
          const previous = index > 0 ? stops[index - 1] : undefined;
          if (previous !== undefined) {
            const distanceM = distanceMeters(previous.property.latitude, previous.property.longitude, current.property.latitude, current.property.longitude);
            totalDistanceM += distanceM;
            totalWalkMinutes += walkMinutesForMeters(distanceM);
          }
        }
        items.push({
          ...serializeCourse(row),
          stopCount: stops.length,
          completedCount,
          totalDistanceM,
          totalWalkMinutes,
        });
      }
      return { courses: items };
    },
  }),

  getTourCourse: defineAction({
    request: z.object({ id: z.number().int().positive() }),
    response: courseDetailSchema,
    handler: async (ctx, args): Promise<z.infer<typeof courseDetailSchema>> => {
      const db = ctx.db<typeof schema>();
      const [course] = await db.select().from(schema.tourCourses).where(eq(schema.tourCourses.id, args.id)).limit(1);
      if (!course) {
        return { course: null, stops: [], totalDistanceM: 0, totalWalkMinutes: 0, walkAssumption: "직선거리 기준 · 도보 시속 4km 가정" };
      }
      const stops = await loadCourseStops(ctx, course.id);
      let totalDistanceM = 0;
      let totalWalkMinutes = 0;
      const payload: z.infer<typeof courseStopSchema>[] = [];
      for (let index = 0; index < stops.length; index += 1) {
        const current = stops[index];
        if (current === undefined) continue;
        const previous = index > 0 ? stops[index - 1] : undefined;
        let legFromPrevious: z.infer<typeof courseStopSchema>["legFromPrevious"] = null;
        if (previous !== undefined) {
          const distanceM = distanceMeters(previous.property.latitude, previous.property.longitude, current.property.latitude, current.property.longitude);
          const walkMinutes = walkMinutesForMeters(distanceM);
          totalDistanceM += distanceM;
          totalWalkMinutes += walkMinutes;
          legFromPrevious = { distanceM, walkMinutes };
        }
        const [revisitRows, checklistRows] = await Promise.all([
          db.select({ id: schema.revisitTasks.id }).from(schema.revisitTasks).where(and(eq(schema.revisitTasks.propertyId, current.property.id), eq(schema.revisitTasks.completed, false))),
          db.select({ checked: schema.checklistEntries.checked }).from(schema.checklistEntries).where(eq(schema.checklistEntries.propertyId, current.property.id)),
        ]);
        payload.push({
          id: current.stop.id,
          position: current.stop.position,
          property: {
            id: current.property.id,
            name: current.property.name,
            address: current.property.address,
            latitude: current.property.latitude,
            longitude: current.property.longitude,
          },
          memo: current.stop.memo,
          completed: current.stop.completed,
          legFromPrevious,
          revisitOpenCount: revisitRows.length,
          checklistDone: checklistRows.filter((entry) => entry.checked).length,
          checklistTotal: CHECKLIST_ITEMS.length,
          updatedAt: current.stop.updatedAt.toISOString(),
        });
      }
      return {
        course: serializeCourse(course),
        stops: payload,
        totalDistanceM,
        totalWalkMinutes,
        walkAssumption: "직선거리 기준 · 도보 시속 4km 가정",
      };
    },
  }),

  createTourCourse: defineAction({
    request: z.object({
      title: z.string().trim().min(1).max(80),
      visitDate: visitDateField,
      notes: z.string().max(2000),
      propertyIds: z.array(z.number().int().positive()).max(30).default([]),
    }),
    response: z.object({ ok: z.boolean(), id: z.number().nullable(), message: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const now = new Date();
      const inserted = await db.insert(schema.tourCourses).values({
        title: args.title,
        visitDate: args.visitDate === "" ? null : args.visitDate,
        notes: args.notes,
        createdAt: now,
        updatedAt: now,
      }).returning({ id: schema.tourCourses.id });
      const created = inserted[0];
      if (!created) return { ok: false, id: null, message: "코스를 저장하지 못했습니다." };
      const uniqueIds = [...new Set(args.propertyIds)];
      let position = 0;
      for (const propertyId of uniqueIds) {
        const [property] = await db.select({ id: schema.properties.id }).from(schema.properties).where(eq(schema.properties.id, propertyId)).limit(1);
        if (!property) continue;
        await db.insert(schema.tourCourseStops).values({ courseId: created.id, propertyId, position, memo: "", completed: false, createdAt: now, updatedAt: now });
        position += 1;
      }
      ctx.invalidateQueries();
      return { ok: true, id: created.id, message: null };
    },
  }),

  updateTourCourse: defineAction({
    request: z.object({
      id: z.number().int().positive(),
      title: z.string().trim().min(1).max(80),
      visitDate: visitDateField,
      notes: z.string().max(2000),
    }),
    response: z.object({ ok: z.boolean(), message: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [existing] = await db.select({ id: schema.tourCourses.id }).from(schema.tourCourses).where(eq(schema.tourCourses.id, args.id)).limit(1);
      if (!existing) return { ok: false, message: "코스를 찾을 수 없습니다." };
      await db.update(schema.tourCourses).set({
        title: args.title,
        visitDate: args.visitDate === "" ? null : args.visitDate,
        notes: args.notes,
        updatedAt: new Date(),
      }).where(eq(schema.tourCourses.id, args.id));
      ctx.invalidateQueries();
      return { ok: true, message: null };
    },
  }),

  deleteTourCourse: defineAction({
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await db.delete(schema.tourCourses).where(eq(schema.tourCourses.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  setCourseStops: defineAction({
    request: z.object({
      courseId: z.number().int().positive(),
      propertyIds: z.array(z.number().int().positive()).max(30).default([]),
    }),
    response: z.object({ ok: z.boolean(), stopCount: z.number(), message: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [course] = await db.select({ id: schema.tourCourses.id }).from(schema.tourCourses).where(eq(schema.tourCourses.id, args.courseId)).limit(1);
      if (!course) return { ok: false, stopCount: 0, message: "코스를 찾을 수 없습니다." };
      const existing = await db.select().from(schema.tourCourseStops).where(eq(schema.tourCourseStops.courseId, args.courseId));
      const preserved = new Map(existing.map((stop) => [stop.propertyId, { memo: stop.memo, completed: stop.completed }]));
      await db.delete(schema.tourCourseStops).where(eq(schema.tourCourseStops.courseId, args.courseId));
      const uniqueIds = [...new Set(args.propertyIds)];
      const now = new Date();
      let position = 0;
      for (const propertyId of uniqueIds) {
        const [property] = await db.select({ id: schema.properties.id }).from(schema.properties).where(eq(schema.properties.id, propertyId)).limit(1);
        if (!property) continue;
        const prev = preserved.get(propertyId);
        await db.insert(schema.tourCourseStops).values({
          courseId: args.courseId,
          propertyId,
          position,
          memo: prev?.memo ?? "",
          completed: prev?.completed ?? false,
          createdAt: now,
          updatedAt: now,
        });
        position += 1;
      }
      await db.update(schema.tourCourses).set({ updatedAt: now }).where(eq(schema.tourCourses.id, args.courseId));
      ctx.invalidateQueries();
      return { ok: true, stopCount: position, message: null };
    },
  }),

  updateCourseStop: defineAction({
    request: z.object({ id: z.number().int().positive(), memo: z.string().max(300), completed: z.boolean() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const now = new Date();
      await db.update(schema.tourCourseStops).set({ memo: args.memo, completed: args.completed, updatedAt: now }).where(eq(schema.tourCourseStops.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  listListings: defineAction({
    request: z.object({ propertyId: z.number().int().positive() }),
    response: z.object({ listings: z.array(listingSummarySchema) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.listings).where(eq(schema.listings.propertyId, args.propertyId)).orderBy(desc(schema.listings.updatedAt));
      const summaries = await Promise.all(
        rows.map(async (row) => {
          const logs = await db
            .select({ priceMan: schema.listingPriceLogs.priceMan })
            .from(schema.listingPriceLogs)
            .where(eq(schema.listingPriceLogs.listingId, row.id))
            .orderBy(asc(schema.listingPriceLogs.recordedAt), asc(schema.listingPriceLogs.id));
          const first = logs[0]?.priceMan ?? null;
          return {
            ...serializeListing(row),
            firstPriceMan: first,
            priceChangeMan: first === null ? null : row.priceMan - first,
            logCount: logs.length,
          };
        }),
      );
      return { listings: summaries };
    },
  }),

  getListing: defineAction({
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ listing: listingSchema.nullable(), logs: z.array(listingPriceLogSchema) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [row] = await db.select().from(schema.listings).where(eq(schema.listings.id, args.id)).limit(1);
      if (!row) return { listing: null, logs: [] };
      const logRows = await db
        .select()
        .from(schema.listingPriceLogs)
        .where(eq(schema.listingPriceLogs.listingId, row.id))
        .orderBy(desc(schema.listingPriceLogs.recordedAt), desc(schema.listingPriceLogs.id));
      return {
        listing: serializeListing(row),
        logs: logRows.map((log) => ({
          id: log.id,
          listingId: log.listingId,
          priceMan: log.priceMan,
          monthlyRentMan: log.monthlyRentMan,
          note: log.note,
          sourceNote: log.sourceNote,
          recordedAt: log.recordedAt.toISOString(),
        })),
      };
    },
  }),

  saveListing: defineAction({
    request: z.object({
      propertyId: z.number().int().positive(),
      id: z.number().int().positive().nullable(),
      brokerName: z.string().max(80),
      brokerContact: z.string().max(80),
      dong: z.string().max(40),
      ho: z.string().max(40),
      areaSqm: z.number().min(0).max(2000).nullable(),
      tradeType: listingTradeTypeSchema,
      priceMan: z.number().int().nonnegative().max(10000000),
      monthlyRentMan: z.number().int().nonnegative().max(10000).nullable(),
      targetPriceMan: z.number().int().positive().max(10000000).nullable(),
      listingUrl: z.string().max(500).nullable(),
      status: listingStatusSchema,
      memo: z.string().max(500),
    }),
    response: z.object({ ok: z.boolean(), id: z.number().nullable(), message: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [property] = await db.select({ id: schema.properties.id }).from(schema.properties).where(eq(schema.properties.id, args.propertyId)).limit(1);
      if (!property) return { ok: false, id: null, message: "등록된 매물을 찾을 수 없습니다." };
      const now = new Date();
      const values = {
        propertyId: args.propertyId,
        brokerName: args.brokerName.trim(),
        brokerContact: args.brokerContact.trim(),
        dong: args.dong.trim(),
        ho: args.ho.trim(),
        areaSqm: args.areaSqm ?? null,
        tradeType: args.tradeType,
        priceMan: args.priceMan,
        monthlyRentMan: args.tradeType === "wolse" ? args.monthlyRentMan : null,
        targetPriceMan: args.targetPriceMan,
        listingUrl: args.listingUrl?.trim() ? args.listingUrl.trim() : null,
        status: args.status,
        memo: args.memo.trim(),
      };
      if (args.id !== null) {
        const [existing] = await db.select().from(schema.listings).where(eq(schema.listings.id, args.id)).limit(1);
        if (!existing) return { ok: false, id: null, message: "매물 기록을 찾을 수 없습니다." };
        await db.update(schema.listings).set({ ...values, updatedAt: now }).where(eq(schema.listings.id, args.id));
        if (existing.priceMan !== values.priceMan || existing.monthlyRentMan !== values.monthlyRentMan) {
          await db.insert(schema.listingPriceLogs).values({
            listingId: args.id,
            priceMan: values.priceMan,
            monthlyRentMan: values.monthlyRentMan,
            note: "매물 정보 수정으로 반영",
            sourceNote: "직접 입력",
            recordedAt: now,
          });
        }
        ctx.invalidateQueries();
        return { ok: true, id: args.id, message: null };
      }
      const [created] = await db.insert(schema.listings).values({ ...values, createdAt: now, updatedAt: now }).returning({ id: schema.listings.id });
      if (!created) return { ok: false, id: null, message: "매물 기록을 저장하지 못했습니다." };
      await db.insert(schema.listingPriceLogs).values({
        listingId: created.id,
        priceMan: values.priceMan,
        monthlyRentMan: values.monthlyRentMan,
        note: "매물 등록 시점 호가",
        sourceNote: "직접 입력",
        recordedAt: now,
      });
      ctx.invalidateQueries();
      return { ok: true, id: created.id, message: null };
    },
  }),

  deleteListing: defineAction({
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean(), message: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const voiceRows = await db.select({ blobKey: schema.voiceMemos.blobKey }).from(schema.voiceMemos).where(eq(schema.voiceMemos.listingId, args.id));
      await db.delete(schema.listings).where(eq(schema.listings.id, args.id));
      await Promise.all(voiceRows.map((row) => ctx.blobs.delete(row.blobKey).catch(() => undefined)));
      ctx.invalidateQueries();
      return { ok: true, message: null };
    },
  }),

  addListingPriceLog: defineAction({
    request: z.object({
      listingId: z.number().int().positive(),
      priceMan: z.number().int().nonnegative().max(10000000),
      monthlyRentMan: z.number().int().nonnegative().max(10000).nullable(),
      note: z.string().max(300),
      sourceNote: z.string().max(80),
      recordedAt: z.string().nullable(),
    }),
    response: z.object({ ok: z.boolean(), message: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [listing] = await db.select().from(schema.listings).where(eq(schema.listings.id, args.listingId)).limit(1);
      if (!listing) return { ok: false, message: "매물 기록을 찾을 수 없습니다." };
      let recordedAt = new Date();
      if (args.recordedAt) {
        const parsed = new Date(`${args.recordedAt}T12:00:00`);
        if (!Number.isNaN(parsed.getTime())) recordedAt = parsed;
      }
      await db.insert(schema.listingPriceLogs).values({
        listingId: args.listingId,
        priceMan: args.priceMan,
        monthlyRentMan: listing.tradeType === "wolse" ? args.monthlyRentMan : null,
        note: args.note.trim(),
        sourceNote: args.sourceNote.trim(),
        recordedAt,
      });
      const [latest] = await db
        .select({ priceMan: schema.listingPriceLogs.priceMan, monthlyRentMan: schema.listingPriceLogs.monthlyRentMan })
        .from(schema.listingPriceLogs)
        .where(eq(schema.listingPriceLogs.listingId, args.listingId))
        .orderBy(desc(schema.listingPriceLogs.recordedAt), desc(schema.listingPriceLogs.id))
        .limit(1);
      await db
        .update(schema.listings)
        .set({ priceMan: latest?.priceMan ?? args.priceMan, monthlyRentMan: latest?.monthlyRentMan ?? null, updatedAt: new Date() })
        .where(eq(schema.listings.id, args.listingId));
      ctx.invalidateQueries();
      return { ok: true, message: null };
    },
  }),

  deleteListingPriceLog: defineAction({
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean(), message: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [log] = await db
        .select({ id: schema.listingPriceLogs.id, listingId: schema.listingPriceLogs.listingId })
        .from(schema.listingPriceLogs)
        .where(eq(schema.listingPriceLogs.id, args.id))
        .limit(1);
      if (!log) return { ok: false, message: "호가 기록을 찾을 수 없습니다." };
      const countRows = await db.select({ id: schema.listingPriceLogs.id }).from(schema.listingPriceLogs).where(eq(schema.listingPriceLogs.listingId, log.listingId));
      if (countRows.length <= 1) return { ok: false, message: "마지막 호가 기록은 삭제할 수 없습니다." };
      await db.delete(schema.listingPriceLogs).where(eq(schema.listingPriceLogs.id, args.id));
      const [latest] = await db
        .select({ priceMan: schema.listingPriceLogs.priceMan, monthlyRentMan: schema.listingPriceLogs.monthlyRentMan })
        .from(schema.listingPriceLogs)
        .where(eq(schema.listingPriceLogs.listingId, log.listingId))
        .orderBy(desc(schema.listingPriceLogs.recordedAt), desc(schema.listingPriceLogs.id))
        .limit(1);
      if (latest) {
        await db.update(schema.listings).set({ priceMan: latest.priceMan, monthlyRentMan: latest.monthlyRentMan, updatedAt: new Date() }).where(eq(schema.listings.id, log.listingId));
      }
      ctx.invalidateQueries();
      return { ok: true, message: null };
    },
  }),
} satisfies ActionsModule;
