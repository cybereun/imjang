// Vercel 포팅용 타입 RPC 클라이언트.
// 원본 `client/src/api.ts`의 `createActionClient<typeof Actions>()`를 대체한다.
// 모든 서버 액션은 `POST /api/<액션명>` (JSON body)으로 호출하며,
// 응답 JSON 형태는 원본 서버 actions.ts의 zod response 스키마와 동일하다.
// 각 메서드의 반환 타입을 명시적으로 타이핑했으므로
// `ApiResponse<typeof api, "listProperties">` 같은 원본 타입 사용법이 그대로 동작한다.

// 원본 SDK의 `ApiResponse<typeof api, "x">` 사용법과 호환되는 타입 헬퍼.
// (과제의 표기 `ApiResponse<TApi, TMethod extends keyof TApi>`를 그대로 쓰면
//  `ReturnType`의 함수 제약 조건을 만족하지 못해 컴파일이 안 되므로,
//  동일한 사용법을 유지하는 범위에서 제약을 명시했다.)
export type ApiResponse<TApi extends Record<string, (args: any) => Promise<any>>, TMethod extends keyof TApi> = Awaited<ReturnType<TApi[TMethod]>>;

// ---------- 공통 스키마 타입 ----------

export type PropertyPurpose = "both" | "invest" | "reside";
export type PriceBasis = "asking" | "official_trade";

export interface Property {
  id: number;
  name: string;
  address: string;
  resolvedAddress: string;
  latitude: number;
  longitude: number;
  areaSqm: number;
  askingPriceMan: number;
  depositMan: number | null;
  monthlyRentMan: number | null;
  purpose: PropertyPurpose;
  visitDate: string | null;
  memo: string;
  priceBasis: PriceBasis;
  sourceReference: string | null;
  geocodeSource: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistItem {
  itemKey: string;
  checked: boolean;
  note: string;
  updatedAt: string;
}

export interface Photo {
  id: number;
  url: string;
  caption: string;
  createdAt: string;
}

export interface VoiceMemoData {
  id: number;
  propertyId: number;
  listingId: number | null;
  checklistItemKey: string | null;
  title: string;
  url: string;
  mimeType: string;
  durationSec: number | null;
  createdAt: string;
}

export interface ReferenceItem {
  id: number;
  kind: "price" | "location";
  title: string;
  url: string;
  source: string | null;
  snippet: string | null;
  publishedAt: string | null;
  rank: number;
  fetchedAt: string;
}

export interface NearbyPlace {
  id: number;
  category: "transit" | "school" | "market" | "hospital";
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceM: number;
  fetchedAt: string;
}

export interface OfficialTransaction {
  id: number;
  lawdCd: string;
  regionLabel: string;
  dealYmd: string;
  apartmentName: string;
  legalDong: string;
  jibun: string | null;
  roadAddress: string | null;
  areaSqm: number;
  floor: number | null;
  dealAmountMan: number;
  buildYear: number | null;
  dealingType: string | null;
  registrationDate: string | null;
  buyerType: string | null;
  sellerType: string | null;
  estateAgentDistrict: string | null;
  apartmentDong: string | null;
  landLeasehold: string | null;
  apiVariant: "detail" | "basic";
  latitude: number | null;
  longitude: number | null;
  fetchedAt: string;
}

export interface OfficialRentTransaction {
  id: number;
  lawdCd: string;
  regionLabel: string;
  dealYmd: string;
  apartmentName: string;
  legalDong: string;
  jibun: string | null;
  roadAddress: string | null;
  areaSqm: number;
  floor: number | null;
  rentKind: "jeonse" | "wolse";
  depositMan: number;
  monthlyRentMan: number;
  contractTerm: string | null;
  buildYear: number | null;
  estateAgentDistrict: string | null;
  apartmentDong: string | null;
  landLeasehold: string | null;
  apiVariant: "detail" | "basic";
  latitude: number | null;
  longitude: number | null;
  fetchedAt: string;
}

export interface NearbyApartment {
  apartmentName: string;
  legalDong: string;
  roadAddress: string | null;
  latitude: number;
  longitude: number;
  distanceKm: number;
  latestDealYmd: string;
  latestPriceMan: number;
  latestAreaSqm: number;
  latestFloor: number | null;
  medianPriceMan: number | null;
  tradeCount: number;
  fetchedAt: string;
}

export interface NearbySavedProperty {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  areaSqm: number;
  askingPriceMan: number;
}

export interface ComparisonItem {
  property: Property;
  position: number;
  comparisonNote: string;
  valueAssessment: string;
  conclusion: string;
  finalSelected: boolean;
  updatedAt: string;
  checklistDone: number;
  checklistTotal: number;
  photos: Photo[];
}

export interface RevisitTask {
  id: number;
  itemKey: string;
  label: string;
  reason: "unchecked" | "missing_note" | "custom";
  completed: boolean;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface PriceTracker {
  active: boolean;
  targetPriceMan: number | null;
  updatedAt: string;
}

export interface PriceSnapshot {
  id: number;
  amountMan: number;
  kind: "asking" | "official_trade";
  note: string;
  sourceUrl: string | null;
  recordedAt: string;
}

export interface FinanceScenario {
  purchasePriceMan: number;
  ownFundsMan: number;
  annualIncomeMan: number;
  otherAnnualDebtMan: number;
  loanRatePct: number;
  loanYears: number;
  ltvPct: number;
  acquisitionTaxPct: number;
  brokeragePct: number;
  updatedAt: string;
}

export interface WatchItem {
  id: number;
  lawdCd: string;
  regionLabel: string;
  complexName: string;
  areaSqm: number;
  areaToleranceSqm: number;
  active: boolean;
  dropAlertPct: number;
  targetPriceMan: number | null;
  bargainBelowMan: number | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface WatchListItem extends WatchItem {
  latest: {
    month: string;
    avgMan: number;
    tradeCount: number;
    prevMonth: string | null;
    prevAvgMan: number | null;
    changePct: number | null;
  } | null;
  latestRent: {
    month: string;
    jeonseMedianMan: number | null;
    jeonseCount: number;
    wolseMedianMan: number | null;
    wolseAvgMonthlyMan: number | null;
    wolseCount: number;
  } | null;
  unreadAlerts: number;
  lastRun: {
    status: "ok" | "needs_key" | "rate_limited" | "error" | "skipped";
    createdAt: string;
    message: string | null;
    newTrades: number;
    alertsCreated: number;
  } | null;
}

export interface WatchSeries {
  watchId: number;
  month: string;
  avgPriceMan: number | null;
  medianPriceMan: number | null;
  minPriceMan: number | null;
  maxPriceMan: number | null;
  tradeCount: number;
  fetchedAt: string;
}

export interface WatchRentSeries {
  watchId: number;
  month: string;
  jeonseAvgMan: number | null;
  jeonseMedianMan: number | null;
  jeonseMinMan: number | null;
  jeonseMaxMan: number | null;
  jeonseCount: number;
  wolseAvgMan: number | null;
  wolseMedianMan: number | null;
  wolseAvgMonthlyMan: number | null;
  wolseCount: number;
  fetchedAt: string;
}

export interface WatchAskRecord {
  id: number;
  watchId: number;
  amountMan: number;
  source: string;
  note: string;
  recordedAt: string;
}

export type PriceAlertType = "price_drop" | "target_reached" | "bargain";

export interface PriceAlert {
  id: number;
  watchId: number;
  type: PriceAlertType;
  title: string;
  detail: string;
  month: string | null;
  triggerValueMan: number | null;
  baselineValueMan: number | null;
  changePct: number | null;
  sourceUrl: string;
  createdAt: string;
  readAt: string | null;
}

export interface PriceAlertWithWatch extends PriceAlert {
  watchComplex: string;
  watchLabel: string;
}

export interface WatchCheckRun {
  id: number;
  watchId: number;
  status: "ok" | "needs_key" | "rate_limited" | "error" | "skipped";
  monthsChecked: string;
  newTrades: number;
  alertsCreated: number;
  message: string | null;
  createdAt: string;
}

export interface CourseStopProperty {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface CourseStop {
  id: number;
  position: number;
  property: CourseStopProperty;
  memo: string;
  completed: boolean;
  legFromPrevious: { distanceM: number; walkMinutes: number } | null;
  revisitOpenCount: number;
  checklistDone: number;
  checklistTotal: number;
  updatedAt: string;
}

export interface Course {
  id: number;
  title: string;
  visitDate: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CourseListItem extends Course {
  stopCount: number;
  completedCount: number;
  totalDistanceM: number;
  totalWalkMinutes: number;
}

export interface CourseDetail {
  course: Course | null;
  stops: CourseStop[];
  totalDistanceM: number;
  totalWalkMinutes: number;
  walkAssumption: "직선거리 기준 · 도보 시속 4km 가정";
}

export type ListingTradeType = "sale" | "jeonse" | "wolse";
export type ListingStatus = "active" | "hold" | "done" | "closed";

export interface Listing {
  id: number;
  propertyId: number;
  brokerName: string;
  brokerContact: string;
  dong: string;
  ho: string;
  areaSqm: number | null;
  tradeType: ListingTradeType;
  priceMan: number;
  monthlyRentMan: number | null;
  targetPriceMan: number | null;
  listingUrl: string | null;
  status: ListingStatus;
  memo: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListingPriceLog {
  id: number;
  listingId: number;
  priceMan: number;
  monthlyRentMan: number | null;
  note: string;
  sourceNote: string;
  recordedAt: string;
}

export interface ListingSummary extends Listing {
  firstPriceMan: number | null;
  priceChangeMan: number | null;
  logCount: number;
}

export interface GeocodeCandidate {
  id: string;
  label: string;
  name: string | null;
  latitude: number;
  longitude: number;
  type: string | null;
}

export interface AreaCandidate {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  bounds: [number, number, number, number] | null;
  lawdCd: string | null;
  regionName: string | null;
}

// ---------- 액션 인자 타입 ----------

export interface SetComparisonCandidatesArgs { propertyIds: number[] }
export interface SaveComparisonEvaluationArgs { propertyId: number; comparisonNote: string; valueAssessment: string; conclusion: string }
export interface PropertyIdArgs { propertyId: number }
export interface PropertyRefArgs { id: number }
export interface AddRevisitTaskArgs { propertyId: number; label: string }
export interface UpdateRevisitTaskArgs { id: number; completed: boolean; note: string }
export interface StartPriceTrackingArgs { propertyId: number; targetPriceMan: number | null }
export interface AddPriceSnapshotArgs { propertyId: number; amountMan: number; kind: "asking" | "official_trade"; note: string }
export interface SaveFinanceScenarioArgs {
  propertyId: number; purchasePriceMan: number; ownFundsMan: number; annualIncomeMan: number;
  otherAnnualDebtMan: number; loanRatePct: number; loanYears: number; ltvPct: number;
  acquisitionTaxPct: number; brokeragePct: number;
}
export interface GeocodePropertyArgs { query: string }
export interface GeocodeAreaArgs { query: string }
export interface CheckOfficialApiConnectionArgs { serviceKey?: string }
export interface SearchOfficialTransactionsArgs { lawdCd: string; regionLabel: string; dealMonth: string; serviceKey?: string }
export interface SearchOfficialRentTransactionsArgs { lawdCd: string; regionLabel: string; dealMonth: string; serviceKey?: string }
export interface GetNearbyApartmentsArgs { latitude: number; longitude: number; radiusKm: 2 | 5 | 10 }
export interface GetPropertyRentContextArgs { propertyId: number; lawdCd: string | null; areaSqm: number; depositPropertyAreaToleranceSqm?: number }
export interface CreatePropertyArgs {
  name: string; address: string; resolvedAddress: string; latitude: number; longitude: number;
  areaSqm: number; askingPriceMan: number; depositMan: number | null; monthlyRentMan: number | null;
  purpose: PropertyPurpose; visitDate: string | null; memo: string;
}
export interface UpdatePropertyArgs {
  id: number; name: string; areaSqm: number; askingPriceMan: number;
  depositMan: number | null; monthlyRentMan: number | null;
  purpose: PropertyPurpose; visitDate: string | null; memo: string;
}
export interface SaveChecklistEntryArgs { propertyId: number; itemKey: string; checked: boolean; note: string }
export interface AddPhotoArgs { propertyId: number; dataBase64: string; mimeType: "image/jpeg" | "image/png"; caption: string }
export interface AddVoiceMemoArgs {
  propertyId: number; dataBase64: string; mimeType: "audio/webm" | "audio/mp4" | "audio/ogg" | "audio/wav";
  durationSec: number | null; title: string; listingId?: number | null; checklistItemKey?: string | null;
}
export interface UpdateVoiceMemoArgs { id: number; title: string }
export interface AddWatchItemArgs {
  lawdCd: string; regionLabel: string; complexName: string; areaSqm: number; areaToleranceSqm?: number;
  dropAlertPct?: number; targetPriceMan?: number | null; bargainBelowMan?: number | null; notes?: string;
}
export interface UpdateWatchItemArgs {
  id: number; complexName?: string; areaSqm?: number; areaToleranceSqm?: number; active?: boolean;
  dropAlertPct?: number; targetPriceMan?: number | null; bargainBelowMan?: number | null; notes?: string;
}
export interface GetWatchDetailArgs { watchId: number }
export interface CheckWatchPricesArgs { serviceKey?: string; watchIds?: number[]; months?: number; scheduled?: boolean }
export interface FetchWatchHistoryArgs { watchId: number; months?: number; serviceKey?: string }
export interface AddWatchAskRecordArgs { watchId: number; amountMan: number; source?: string | null; note?: string | null }
export interface ListPriceAlertsArgs { unreadOnly?: boolean; limit?: number }
export interface MarkAlertsReadArgs { ids: number[] }
export interface SetAutoCheckArgs { enabled: boolean }
export interface SaveServerServiceKeyArgs { serviceKey: string }
export interface SaveVworldKeyArgs { apiKey: string }
export interface GetTourCourseArgs { id: number }
export interface CreateTourCourseArgs { title: string; visitDate: string | null; notes: string; propertyIds?: number[] }
export interface UpdateTourCourseArgs { id: number; title: string; visitDate: string | null; notes: string }
export interface SetCourseStopsArgs { courseId: number; propertyIds?: number[] }
export interface UpdateCourseStopArgs { id: number; memo: string; completed: boolean }
export interface ListListingsArgs { propertyId: number }
export interface GetListingArgs { id: number }
export interface SaveListingArgs {
  propertyId: number; id: number | null; brokerName: string; brokerContact: string; dong: string; ho: string;
  areaSqm: number | null; tradeType: ListingTradeType; priceMan: number; monthlyRentMan: number | null;
  targetPriceMan: number | null; listingUrl: string | null; status: ListingStatus; memo: string;
}
export interface AddListingPriceLogArgs {
  listingId: number; priceMan: number; monthlyRentMan: number | null; note: string; sourceNote: string; recordedAt: string | null;
}
export interface EmptyArgs { [key: string]: never }

// ---------- 액션 응답 타입 ----------

export interface ListPropertiesResponse { properties: Property[] }
export interface GetComparisonBoardResponse { items: ComparisonItem[] }
export interface SetComparisonCandidatesResponse { ok: boolean; selectedIds: number[] }
export interface OkResponse { ok: boolean }
export interface GetDecisionSupportResponse {
  revisitTasks: RevisitTask[];
  priceTracker: PriceTracker | null;
  priceSnapshots: PriceSnapshot[];
  financeScenario: FinanceScenario | null;
  listingSummaries: ListingSummary[];
}
export interface GenerateRevisitPlanResponse { ok: boolean; count: number; message: string | null }
export interface GetPropertyDetailResponse {
  property: Property | null;
  checklist: ChecklistItem[];
  photos: Photo[];
  voiceMemos: VoiceMemoData[];
  references: ReferenceItem[];
  nearby: NearbyPlace[];
}
export interface GeocodePropertyResponse {
  ok: boolean;
  message: string | null;
  candidates: GeocodeCandidate[];
}
export interface GeocodeAreaResponse {
  ok: boolean;
  message: string | null;
  candidates: AreaCandidate[];
}
export interface CheckOfficialApiConnectionResponse {
  status: "ok" | "not_configured" | "error" | "rate_limited" | "owner_only";
  message: string;
  variant: "detail" | "basic" | null;
  rentAvailable: boolean;
}
export interface SearchOfficialTransactionsResponse {
  status: "ok" | "needs_connection" | "error" | "owner_only";
  message: string | null;
  sourceUrl: string;
  fetchedAt: string | null;
  transactions: OfficialTransaction[];
}
export interface SearchOfficialRentTransactionsResponse {
  status: "ok" | "needs_connection" | "error" | "owner_only";
  message: string | null;
  sourceUrl: string;
  fetchedAt: string | null;
  transactions: OfficialRentTransaction[];
}
export interface GetNearbyApartmentsResponse {
  status: "ok" | "no_data" | "owner_only";
  message: string | null;
  sourceUrl: string;
  fetchedAt: string | null;
  center: { latitude: number; longitude: number };
  radiusKm: number;
  apartments: NearbyApartment[];
  savedProperties: NearbySavedProperty[];
}
export interface GetPropertyRentContextResponse {
  status: "ok" | "no_data" | "owner_only";
  message: string | null;
  rentSourceUrl: string;
  tradeSourceUrl: string;
  summary: {
    jeonseMedianMan: number | null;
    jeonseCount: number;
    wolseMedianMan: number | null;
    wolseAvgMonthlyMan: number | null;
    wolseCount: number;
    saleMedianMan: number | null;
    saleCount: number;
    jeonseRatioPct: number | null;
    gapMan: number | null;
    monthRange: string | null;
    fetchedAt: string | null;
  } | null;
}
export interface ImportOfficialTransactionResponse { ok: boolean; id: number | null; message: string | null }
export interface CreatePropertyResponse { id: number }
export interface AddPhotoResponse { id: number }
export interface AddVoiceMemoResponse { id: number }
export interface RefreshReferencesResponse { ok: boolean; count: number; message: string | null }
export interface ListWatchItemsResponse { items: WatchListItem[] }
export interface AddWatchItemResponse { ok: boolean; id: number | null; message: string | null }
export interface UpdateWatchItemResponse { ok: boolean; message: string | null }
export interface DeleteWatchItemResponse { ok: boolean; message: string | null }
export interface GetWatchDetailResponse {
  watch: WatchItem;
  series: WatchSeries[];
  rentSeries: WatchRentSeries[];
  askRecords: WatchAskRecord[];
  alerts: PriceAlert[];
  runs: WatchCheckRun[];
}
export interface CheckWatchPricesResponse {
  status: "ok" | "needs_key" | "rate_limited" | "error" | "skipped" | "owner_only";
  message: string;
  checked: number;
  totalNewTrades: number;
  totalNewRents: number;
  totalAlerts: number;
}
export interface FetchWatchHistoryResponse {
  status: "ok" | "needs_key" | "rate_limited" | "error" | "owner_only";
  message: string;
  monthsFetched: number;
  monthsTotal: number;
  newTrades: number;
  newRents: number;
}
export interface AddWatchAskRecordResponse { ok: boolean; alertsCreated: number; message: string | null }
export interface ListPriceAlertsResponse { alerts: PriceAlertWithWatch[]; unreadCount: number }
export interface MarkAlertsReadResponse { ok: boolean; count: number }
export interface GetAutoCheckResponse { enabled: boolean; supported: boolean; message: string }
export interface SetAutoCheckResponse { ok: boolean; enabled: boolean; message: string }
export interface SaveServerServiceKeyResponse { ok: boolean; masked: string | null; updatedAt: string | null; message: string }
export interface GetServerServiceKeyStatusResponse { configured: boolean; masked: string | null; updatedAt: string | null; ownerOnly: boolean }
export interface RemoveServerServiceKeyResponse { ok: boolean; message: string }
export interface SaveVworldKeyResponse { ok: boolean; masked: string | null; updatedAt: string | null; message: string }
export interface GetVworldKeyStatusResponse { configured: boolean; masked: string | null; updatedAt: string | null; ownerOnly: boolean }
export interface RemoveVworldKeyResponse { ok: boolean; message: string }
export interface GetMapTileConfigResponse { configured: boolean; apiKey: string | null }
export interface ListTourCoursesResponse { courses: CourseListItem[] }
export interface CreateTourCourseResponse { ok: boolean; id: number | null; message: string | null }
export interface UpdateTourCourseResponse { ok: boolean; message: string | null }
export interface SetCourseStopsResponse { ok: boolean; stopCount: number; message: string | null }
export interface ListListingsResponse { listings: ListingSummary[] }
export interface GetListingResponse { listing: Listing | null; logs: ListingPriceLog[] }
export interface SaveListingResponse { ok: boolean; id: number | null; message: string | null }
export interface DeleteListingResponse { ok: boolean; message: string | null }
export interface AddListingPriceLogResponse { ok: boolean; message: string | null }
export interface DeleteListingPriceLogResponse { ok: boolean; message: string | null }

// ---------- RPC 호출 ----------

async function post<TResponse>(action: string, args: object): Promise<TResponse> {
  const res = await fetch(`/api/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args ?? {}),
  });
  if (!res.ok) {
    throw new Error(`API 요청 실패 (${action}): ${res.status}`);
  }
  return (await res.json()) as TResponse;
}

export const api = {
  listProperties: (args: EmptyArgs = {}): Promise<ListPropertiesResponse> => post("listProperties", args),
  getComparisonBoard: (args: EmptyArgs = {}): Promise<GetComparisonBoardResponse> => post("getComparisonBoard", args),
  setComparisonCandidates: (args: SetComparisonCandidatesArgs): Promise<SetComparisonCandidatesResponse> => post("setComparisonCandidates", args),
  saveComparisonEvaluation: (args: SaveComparisonEvaluationArgs): Promise<OkResponse> => post("saveComparisonEvaluation", args),
  setComparisonFinal: (args: { propertyId: number }): Promise<OkResponse> => post("setComparisonFinal", args),
  getDecisionSupport: (args: PropertyIdArgs): Promise<GetDecisionSupportResponse> => post("getDecisionSupport", args),
  generateRevisitPlan: (args: PropertyIdArgs): Promise<GenerateRevisitPlanResponse> => post("generateRevisitPlan", args),
  addRevisitTask: (args: AddRevisitTaskArgs): Promise<OkResponse> => post("addRevisitTask", args),
  updateRevisitTask: (args: UpdateRevisitTaskArgs): Promise<OkResponse> => post("updateRevisitTask", args),
  startPriceTracking: (args: StartPriceTrackingArgs): Promise<OkResponse> => post("startPriceTracking", args),
  addPriceSnapshot: (args: AddPriceSnapshotArgs): Promise<OkResponse> => post("addPriceSnapshot", args),
  saveFinanceScenario: (args: SaveFinanceScenarioArgs): Promise<OkResponse> => post("saveFinanceScenario", args),
  getPropertyDetail: (args: PropertyRefArgs): Promise<GetPropertyDetailResponse> => post("getPropertyDetail", args),
  geocodeProperty: (args: GeocodePropertyArgs): Promise<GeocodePropertyResponse> => post("geocodeProperty", args),
  geocodeArea: (args: GeocodeAreaArgs): Promise<GeocodeAreaResponse> => post("geocodeArea", args),
  checkOfficialApiConnection: (args: CheckOfficialApiConnectionArgs = {}): Promise<CheckOfficialApiConnectionResponse> => post("checkOfficialApiConnection", args),
  searchOfficialTransactions: (args: SearchOfficialTransactionsArgs): Promise<SearchOfficialTransactionsResponse> => post("searchOfficialTransactions", args),
  searchOfficialRentTransactions: (args: SearchOfficialRentTransactionsArgs): Promise<SearchOfficialRentTransactionsResponse> => post("searchOfficialRentTransactions", args),
  getNearbyApartments: (args: GetNearbyApartmentsArgs): Promise<GetNearbyApartmentsResponse> => post("getNearbyApartments", args),
  getPropertyRentContext: (args: GetPropertyRentContextArgs): Promise<GetPropertyRentContextResponse> => post("getPropertyRentContext", args),
  importOfficialTransaction: (args: PropertyRefArgs): Promise<ImportOfficialTransactionResponse> => post("importOfficialTransaction", args),
  createProperty: (args: CreatePropertyArgs): Promise<CreatePropertyResponse> => post("createProperty", args),
  updateProperty: (args: UpdatePropertyArgs): Promise<OkResponse> => post("updateProperty", args),
  deleteProperty: (args: PropertyRefArgs): Promise<OkResponse> => post("deleteProperty", args),
  saveChecklistEntry: (args: SaveChecklistEntryArgs): Promise<OkResponse> => post("saveChecklistEntry", args),
  addPhoto: (args: AddPhotoArgs): Promise<AddPhotoResponse> => post("addPhoto", args),
  deletePhoto: (args: PropertyRefArgs): Promise<OkResponse> => post("deletePhoto", args),
  deleteVoiceMemo: (args: PropertyRefArgs): Promise<OkResponse> => post("deleteVoiceMemo", args),
  updateVoiceMemo: (args: UpdateVoiceMemoArgs): Promise<OkResponse> => post("updateVoiceMemo", args),
  addVoiceMemo: (args: AddVoiceMemoArgs): Promise<AddVoiceMemoResponse> => post("addVoiceMemo", args),
  refreshReferences: (args: PropertyIdArgs): Promise<RefreshReferencesResponse> => post("refreshReferences", args),
  listWatchItems: (args: EmptyArgs = {}): Promise<ListWatchItemsResponse> => post("listWatchItems", args),
  addWatchItem: (args: AddWatchItemArgs): Promise<AddWatchItemResponse> => post("addWatchItem", args),
  updateWatchItem: (args: UpdateWatchItemArgs): Promise<UpdateWatchItemResponse> => post("updateWatchItem", args),
  deleteWatchItem: (args: PropertyRefArgs): Promise<DeleteWatchItemResponse> => post("deleteWatchItem", args),
  getWatchDetail: (args: GetWatchDetailArgs): Promise<GetWatchDetailResponse> => post("getWatchDetail", args),
  checkWatchPrices: (args: CheckWatchPricesArgs = {}): Promise<CheckWatchPricesResponse> => post("checkWatchPrices", args),
  fetchWatchHistory: (args: FetchWatchHistoryArgs): Promise<FetchWatchHistoryResponse> => post("fetchWatchHistory", args),
  addWatchAskRecord: (args: AddWatchAskRecordArgs): Promise<AddWatchAskRecordResponse> => post("addWatchAskRecord", args),
  listPriceAlerts: (args: ListPriceAlertsArgs = {}): Promise<ListPriceAlertsResponse> => post("listPriceAlerts", args),
  markAlertsRead: (args: MarkAlertsReadArgs): Promise<MarkAlertsReadResponse> => post("markAlertsRead", args),
  getAutoCheck: (args: EmptyArgs = {}): Promise<GetAutoCheckResponse> => post("getAutoCheck", args),
  setAutoCheck: (args: SetAutoCheckArgs): Promise<SetAutoCheckResponse> => post("setAutoCheck", args),
  saveServerServiceKey: (args: SaveServerServiceKeyArgs): Promise<SaveServerServiceKeyResponse> => post("saveServerServiceKey", args),
  getServerServiceKeyStatus: (args: EmptyArgs = {}): Promise<GetServerServiceKeyStatusResponse> => post("getServerServiceKeyStatus", args),
  removeServerServiceKey: (args: EmptyArgs = {}): Promise<RemoveServerServiceKeyResponse> => post("removeServerServiceKey", args),
  saveVworldKey: (args: SaveVworldKeyArgs): Promise<SaveVworldKeyResponse> => post("saveVworldKey", args),
  getVworldKeyStatus: (args: EmptyArgs = {}): Promise<GetVworldKeyStatusResponse> => post("getVworldKeyStatus", args),
  removeVworldKey: (args: EmptyArgs = {}): Promise<RemoveVworldKeyResponse> => post("removeVworldKey", args),
  getMapTileConfig: (args: EmptyArgs = {}): Promise<GetMapTileConfigResponse> => post("getMapTileConfig", args),
  listTourCourses: (args: EmptyArgs = {}): Promise<ListTourCoursesResponse> => post("listTourCourses", args),
  getTourCourse: (args: GetTourCourseArgs): Promise<CourseDetail> => post("getTourCourse", args),
  createTourCourse: (args: CreateTourCourseArgs): Promise<CreateTourCourseResponse> => post("createTourCourse", args),
  updateTourCourse: (args: UpdateTourCourseArgs): Promise<UpdateTourCourseResponse> => post("updateTourCourse", args),
  deleteTourCourse: (args: PropertyRefArgs): Promise<OkResponse> => post("deleteTourCourse", args),
  setCourseStops: (args: SetCourseStopsArgs): Promise<SetCourseStopsResponse> => post("setCourseStops", args),
  updateCourseStop: (args: UpdateCourseStopArgs): Promise<OkResponse> => post("updateCourseStop", args),
  listListings: (args: ListListingsArgs): Promise<ListListingsResponse> => post("listListings", args),
  getListing: (args: GetListingArgs): Promise<GetListingResponse> => post("getListing", args),
  saveListing: (args: SaveListingArgs): Promise<SaveListingResponse> => post("saveListing", args),
  deleteListing: (args: PropertyRefArgs): Promise<DeleteListingResponse> => post("deleteListing", args),
  addListingPriceLog: (args: AddListingPriceLogArgs): Promise<AddListingPriceLogResponse> => post("addListingPriceLog", args),
  deleteListingPriceLog: (args: PropertyRefArgs): Promise<DeleteListingPriceLogResponse> => post("deleteListingPriceLog", args),
};

// ---------- 파일 → base64 헬퍼 ----------
// 파일 → { dataBase64, mimeType } 변환 헬퍼 (사진·음성 업로드용).
// App.tsx의 사용처(`encoded.dataBase64`, `encoded.mimeType`)에 맞춰
// base64 본문과 MIME 타입을 함께 반환한다.
export function fileToBase64(file: File): Promise<{ dataBase64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("파일을 읽지 못했습니다."));
        return;
      }
      const comma = result.indexOf(",");
      resolve({
        dataBase64: comma >= 0 ? result.slice(comma + 1) : result,
        mimeType: file.type || "application/octet-stream",
      });
    };
    reader.onerror = () => reject(reader.error ?? new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}
