// 임장 앱 Vercel 포팅용 Postgres 스키마
// 원본: ts-spaces/space-2 (sqlite, drizzle) → pg-core(drizzle-orm/pg-core)로 1:1 변환
// 테이블명·컬럼명·제약조건은 원본과 동일하게 유지
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// 매물 (임장 대상)
export const properties = pgTable(
  "properties",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    address: text("address").notNull(),
    resolvedAddress: text("resolved_address").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    areaSqm: doublePrecision("area_sqm").notNull(),
    askingPriceMan: integer("asking_price_man").notNull(),
    depositMan: integer("deposit_man"),
    monthlyRentMan: integer("monthly_rent_man"),
    purpose: text("purpose").notNull().default("both"), // both | invest | reside
    visitDate: text("visit_date"),
    memo: text("memo").notNull().default(""),
    priceBasis: text("price_basis").notNull().default("asking"), // asking | official_trade
    sourceReference: text("source_reference"),
    sourceRecordId: text("source_record_id"),
    geocodeSource: text("geocode_source").notNull().default("OpenStreetMap Nominatim"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
  },
  (table) => [index("properties_updated_idx").on(table.updatedAt)],
);

// 임장 체크리스트 항목
export const checklistEntries = pgTable(
  "checklist_entries",
  {
    id: serial("id").primaryKey(),
    propertyId: integer("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    itemKey: text("item_key").notNull(),
    checked: boolean("checked").notNull().default(false),
    note: text("note").notNull().default(""),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
  },
  (table) => [
    uniqueIndex("checklist_property_item_unique").on(table.propertyId, table.itemKey),
    index("checklist_property_idx").on(table.propertyId),
  ],
);

// 현장 사진
export const photos = pgTable(
  "photos",
  {
    id: serial("id").primaryKey(),
    propertyId: integer("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    blobKey: text("blob_key").notNull(),
    caption: text("caption").notNull().default(""),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  },
  (table) => [index("photos_property_idx").on(table.propertyId)],
);

// 주변 장소 (교통/학교/마트/병원)
export const nearbyPlaces = pgTable(
  "nearby_places",
  {
    id: serial("id").primaryKey(),
    propertyId: integer("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    category: text("category").notNull(), // transit | school | market | hospital
    name: text("name").notNull(),
    address: text("address").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    distanceM: integer("distance_m").notNull(),
    fetchedAt: timestamp("fetched_at", { mode: "date" }).notNull(),
  },
  (table) => [index("nearby_property_idx").on(table.propertyId, table.category, table.distanceM)],
);

// 국토부 아파트 매매 실거래가 캐시
export const officialTransactions = pgTable(
  "official_transactions",
  {
    id: serial("id").primaryKey(),
    fingerprint: text("fingerprint").notNull(),
    lawdCd: text("lawd_cd").notNull(),
    regionLabel: text("region_label").notNull(),
    dealYmd: text("deal_ymd").notNull(),
    apartmentName: text("apartment_name").notNull(),
    legalDong: text("legal_dong").notNull(),
    jibun: text("jibun"),
    roadAddress: text("road_address"),
    areaSqm: doublePrecision("area_sqm").notNull(),
    floor: integer("floor"),
    dealAmountMan: integer("deal_amount_man").notNull(),
    buildYear: integer("build_year"),
    dealingType: text("dealing_type"),
    registrationDate: text("registration_date"),
    buyerType: text("buyer_type"),
    sellerType: text("seller_type"),
    estateAgentDistrict: text("estate_agent_district"),
    apartmentDong: text("apartment_dong"),
    landLeasehold: text("land_leasehold"),
    apiVariant: text("api_variant").notNull().default("detail"), // detail | basic
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    fetchedAt: timestamp("fetched_at", { mode: "date" }).notNull(),
  },
  (table) => [
    uniqueIndex("official_transactions_fingerprint_unique").on(table.fingerprint),
    index("official_transactions_region_month_idx").on(table.lawdCd, table.dealYmd),
  ],
);

// 국토부 전월세 실거래가 캐시
export const officialRentTransactions = pgTable(
  "official_rent_transactions",
  {
    id: serial("id").primaryKey(),
    fingerprint: text("fingerprint").notNull(),
    lawdCd: text("lawd_cd").notNull(),
    regionLabel: text("region_label").notNull(),
    dealYmd: text("deal_ymd").notNull(),
    apartmentName: text("apartment_name").notNull(),
    legalDong: text("legal_dong").notNull(),
    jibun: text("jibun"),
    roadAddress: text("road_address"),
    areaSqm: doublePrecision("area_sqm").notNull(),
    floor: integer("floor"),
    depositMan: integer("deposit_man").notNull(),
    monthlyRentMan: integer("monthly_rent_man").notNull(),
    contractTerm: text("contract_term"),
    buildYear: integer("build_year"),
    estateAgentDistrict: text("estate_agent_district"),
    apartmentDong: text("apartment_dong"),
    landLeasehold: text("land_leasehold"),
    apiVariant: text("api_variant").notNull().default("detail"), // detail | basic
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    fetchedAt: timestamp("fetched_at", { mode: "date" }).notNull(),
  },
  (table) => [
    uniqueIndex("official_rent_transactions_fingerprint_unique").on(table.fingerprint),
    index("official_rent_transactions_region_month_idx").on(table.lawdCd, table.dealYmd),
  ],
);

// 매물 비교 평가 (후보 최대 3개 + 최종 선정)
export const propertyComparisons = pgTable(
  "property_comparisons",
  {
    id: serial("id").primaryKey(),
    propertyId: integer("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    comparisonNote: text("comparison_note").notNull().default(""),
    valueAssessment: text("value_assessment").notNull().default(""),
    conclusion: text("conclusion").notNull().default(""),
    finalSelected: boolean("final_selected").notNull().default(false),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
  },
  (table) => [
    uniqueIndex("property_comparisons_property_unique").on(table.propertyId),
    index("property_comparisons_position_idx").on(table.position),
  ],
);

// 재임장 검증 플랜 항목
export const revisitTasks = pgTable(
  "revisit_tasks",
  {
    id: serial("id").primaryKey(),
    propertyId: integer("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
    itemKey: text("item_key").notNull(),
    label: text("label").notNull(),
    reason: text("reason").notNull(), // unchecked | missing_note | custom
    completed: boolean("completed").notNull().default(false),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
  },
  (table) => [
    uniqueIndex("revisit_tasks_property_item_unique").on(table.propertyId, table.itemKey),
    index("revisit_tasks_property_idx").on(table.propertyId, table.completed),
  ],
);

// 매물별 수동 가격 추적 설정
export const priceTrackers = pgTable(
  "price_trackers",
  {
    id: serial("id").primaryKey(),
    propertyId: integer("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
    active: boolean("active").notNull().default(true),
    targetPriceMan: integer("target_price_man"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
  },
  (table) => [uniqueIndex("price_trackers_property_unique").on(table.propertyId)],
);

// 가격 스냅샷 (호가/실거래 수동 기록)
export const priceSnapshots = pgTable(
  "price_snapshots",
  {
    id: serial("id").primaryKey(),
    propertyId: integer("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
    amountMan: integer("amount_man").notNull(),
    kind: text("kind").notNull(), // asking | official_trade
    note: text("note").notNull().default(""),
    sourceUrl: text("source_url"),
    recordedAt: timestamp("recorded_at", { mode: "date" }).notNull(),
  },
  (table) => [index("price_snapshots_property_date_idx").on(table.propertyId, table.recordedAt)],
);

// 매수 시뮬레이터 시나리오 (대출·LTV·취득세·DSR)
export const financeScenarios = pgTable(
  "finance_scenarios",
  {
    id: serial("id").primaryKey(),
    propertyId: integer("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
    purchasePriceMan: integer("purchase_price_man").notNull(),
    ownFundsMan: integer("own_funds_man").notNull(),
    annualIncomeMan: integer("annual_income_man").notNull(),
    otherAnnualDebtMan: integer("other_annual_debt_man").notNull(),
    loanRatePct: doublePrecision("loan_rate_pct").notNull(),
    loanYears: integer("loan_years").notNull(),
    ltvPct: doublePrecision("ltv_pct").notNull(),
    acquisitionTaxPct: doublePrecision("acquisition_tax_pct").notNull(),
    brokeragePct: doublePrecision("brokerage_pct").notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
  },
  (table) => [uniqueIndex("finance_scenarios_property_unique").on(table.propertyId)],
);

// 웹 참고자료 수집 결과
export const referenceResults = pgTable(
  "reference_results",
  {
    id: serial("id").primaryKey(),
    propertyId: integer("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // price | location
    title: text("title").notNull(),
    url: text("url").notNull(),
    source: text("source"),
    snippet: text("snippet"),
    publishedAt: text("published_at"),
    rank: integer("rank").notNull(),
    fetchedAt: timestamp("fetched_at", { mode: "date" }).notNull(),
  },
  (table) => [index("reference_property_idx").on(table.propertyId, table.kind, table.rank)],
);

// 관심 단지 (시세 트래킹 감시 대상)
export const watchItems = pgTable(
  "watch_items",
  {
    id: serial("id").primaryKey(),
    lawdCd: text("lawd_cd").notNull(),
    regionLabel: text("region_label").notNull(),
    complexName: text("complex_name").notNull(),
    areaSqm: doublePrecision("area_sqm").notNull(),
    areaToleranceSqm: doublePrecision("area_tolerance_sqm").notNull().default(1),
    active: boolean("active").notNull().default(true),
    dropAlertPct: doublePrecision("drop_alert_pct").notNull().default(3),
    targetPriceMan: integer("target_price_man"),
    bargainBelowMan: integer("bargain_below_man"),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
  },
  (table) => [
    index("watch_items_active_idx").on(table.active),
    index("watch_items_lawd_idx").on(table.lawdCd, table.complexName),
  ],
);

// 관심 단지 월별 매매 시세 시리즈
export const watchPriceSeries = pgTable(
  "watch_price_series",
  {
    id: serial("id").primaryKey(),
    watchId: integer("watch_id")
      .notNull()
      .references(() => watchItems.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    avgPriceMan: integer("avg_price_man"),
    medianPriceMan: integer("median_price_man"),
    minPriceMan: integer("min_price_man"),
    maxPriceMan: integer("max_price_man"),
    tradeCount: integer("trade_count").notNull().default(0),
    fetchedAt: timestamp("fetched_at", { mode: "date" }).notNull(),
  },
  (table) => [
    uniqueIndex("watch_price_series_watch_month_unique").on(table.watchId, table.month),
    index("watch_price_series_month_idx").on(table.watchId, table.month),
  ],
);

// 관심 단지 월별 전월세 시세 시리즈
export const watchRentSeries = pgTable(
  "watch_rent_series",
  {
    id: serial("id").primaryKey(),
    watchId: integer("watch_id")
      .notNull()
      .references(() => watchItems.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    jeonseMedianMan: integer("jeonse_median_man"),
    jeonseAvgMan: integer("jeonse_avg_man"),
    jeonseMinMan: integer("jeonse_min_man"),
    jeonseMaxMan: integer("jeonse_max_man"),
    jeonseCount: integer("jeonse_count").notNull().default(0),
    wolseMedianMan: integer("wolse_median_man"),
    wolseAvgMan: integer("wolse_avg_man"),
    wolseAvgMonthlyMan: integer("wolse_avg_monthly_man"),
    wolseCount: integer("wolse_count").notNull().default(0),
    fetchedAt: timestamp("fetched_at", { mode: "date" }).notNull(),
  },
  (table) => [
    uniqueIndex("watch_rent_series_watch_month_unique").on(table.watchId, table.month),
    index("watch_rent_series_month_idx").on(table.watchId, table.month),
  ],
);

// 관심 단지 직접 호가 기록
export const watchAskRecords = pgTable(
  "watch_ask_records",
  {
    id: serial("id").primaryKey(),
    watchId: integer("watch_id")
      .notNull()
      .references(() => watchItems.id, { onDelete: "cascade" }),
    amountMan: integer("amount_man").notNull(),
    source: text("source").notNull().default(""),
    note: text("note").notNull().default(""),
    recordedAt: timestamp("recorded_at", { mode: "date" }).notNull(),
  },
  (table) => [index("watch_ask_records_watch_date_idx").on(table.watchId, table.recordedAt)],
);

// 가격 알림함 (하락·목표가·급매)
export const priceAlerts = pgTable(
  "price_alerts",
  {
    id: serial("id").primaryKey(),
    watchId: integer("watch_id")
      .notNull()
      .references(() => watchItems.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // price_drop | target_reached | bargain
    title: text("title").notNull(),
    detail: text("detail").notNull(),
    month: text("month"),
    triggerValueMan: integer("trigger_value_man"),
    baselineValueMan: integer("baseline_value_man"),
    changePct: doublePrecision("change_pct"),
    sourceUrl: text("source_url").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
    readAt: timestamp("read_at", { mode: "date" }),
  },
  (table) => [
    index("price_alerts_watch_idx").on(table.watchId, table.createdAt),
    index("price_alerts_unread_idx").on(table.readAt),
    uniqueIndex("price_alerts_watch_type_month_unique").on(table.watchId, table.type, table.month),
  ],
);

// 자동 시세 확인 실행 기록
export const watchCheckRuns = pgTable(
  "watch_check_runs",
  {
    id: serial("id").primaryKey(),
    watchId: integer("watch_id")
      .notNull()
      .references(() => watchItems.id, { onDelete: "cascade" }),
    status: text("status").notNull(), // ok | needs_key | rate_limited | error | skipped
    monthsChecked: text("months_checked").notNull().default(""),
    newTrades: integer("new_trades").notNull().default(0),
    alertsCreated: integer("alerts_created").notNull().default(0),
    message: text("message"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  },
  (table) => [index("watch_check_runs_watch_idx").on(table.watchId, table.createdAt)],
);

// 앱 설정 (키-값)
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
});

// 매물 단위 기록 (중개업소·동호수·호가·상태)
export const listings = pgTable(
  "listings",
  {
    id: serial("id").primaryKey(),
    propertyId: integer("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    brokerName: text("broker_name").notNull().default(""),
    brokerContact: text("broker_contact").notNull().default(""),
    dong: text("dong").notNull().default(""),
    ho: text("ho").notNull().default(""),
    areaSqm: doublePrecision("area_sqm"),
    tradeType: text("trade_type").notNull().default("sale"), // sale | jeonse | wolse
    priceMan: integer("price_man").notNull(),
    monthlyRentMan: integer("monthly_rent_man"),
    targetPriceMan: integer("target_price_man"),
    listingUrl: text("listing_url"),
    status: text("status").notNull().default("active"), // active | hold | done | closed
    memo: text("memo").notNull().default(""),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
  },
  (table) => [index("listings_property_idx").on(table.propertyId, table.updatedAt)],
);

// 매물 호가 변동 이력
export const listingPriceLogs = pgTable(
  "listing_price_logs",
  {
    id: serial("id").primaryKey(),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    priceMan: integer("price_man").notNull(),
    monthlyRentMan: integer("monthly_rent_man"),
    note: text("note").notNull().default(""),
    sourceNote: text("source_note").notNull().default(""),
    recordedAt: timestamp("recorded_at", { mode: "date" }).notNull(),
  },
  (table) => [index("listing_price_logs_listing_date_idx").on(table.listingId, table.recordedAt)],
);

// 임장 코스
export const tourCourses = pgTable(
  "tour_courses",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    visitDate: text("visit_date"),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
  },
  (table) => [index("tour_courses_updated_idx").on(table.updatedAt)],
);

// 임장 코스 정류장 (매물 방문 순서)
export const tourCourseStops = pgTable(
  "tour_course_stops",
  {
    id: serial("id").primaryKey(),
    courseId: integer("course_id")
      .notNull()
      .references(() => tourCourses.id, { onDelete: "cascade" }),
    propertyId: integer("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    memo: text("memo").notNull().default(""),
    completed: boolean("completed").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
  },
  (table) => [
    uniqueIndex("tour_course_stops_course_property_unique").on(table.courseId, table.propertyId),
    index("tour_course_stops_course_position_idx").on(table.courseId, table.position),
  ],
);

// 음성 녹음 메모
export const voiceMemos = pgTable(
  "voice_memos",
  {
    id: serial("id").primaryKey(),
    propertyId: integer("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    listingId: integer("listing_id").references(() => listings.id, { onDelete: "cascade" }),
    checklistItemKey: text("checklist_item_key"),
    title: text("title").notNull().default(""),
    blobKey: text("blob_key").notNull(),
    mimeType: text("mime_type").notNull(),
    durationSec: doublePrecision("duration_sec"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  },
  (table) => [
    index("voice_memos_property_idx").on(table.propertyId, table.createdAt),
    index("voice_memos_listing_idx").on(table.listingId),
  ],
);
