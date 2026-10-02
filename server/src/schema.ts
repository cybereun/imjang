import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const properties = sqliteTable(
  "properties",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    address: text("address").notNull(),
    resolvedAddress: text("resolved_address").notNull(),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    areaSqm: real("area_sqm").notNull(),
    askingPriceMan: integer("asking_price_man").notNull(),
    depositMan: integer("deposit_man"),
    monthlyRentMan: integer("monthly_rent_man"),
    purpose: text("purpose", { enum: ["both", "invest", "reside"] })
      .notNull()
      .default("both"),
    visitDate: text("visit_date"),
    memo: text("memo").notNull().default(""),
    priceBasis: text("price_basis", { enum: ["asking", "official_trade"] }).notNull().default("asking"),
    sourceReference: text("source_reference"),
    sourceRecordId: text("source_record_id"),
    geocodeSource: text("geocode_source").notNull().default("OpenStreetMap Nominatim"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("properties_updated_idx").on(table.updatedAt)],
);

export const checklistEntries = sqliteTable(
  "checklist_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    propertyId: integer("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    itemKey: text("item_key").notNull(),
    checked: integer("checked", { mode: "boolean" }).notNull().default(false),
    note: text("note").notNull().default(""),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("checklist_property_item_unique").on(table.propertyId, table.itemKey),
    index("checklist_property_idx").on(table.propertyId),
  ],
);

export const photos = sqliteTable(
  "photos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    propertyId: integer("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    blobKey: text("blob_key").notNull(),
    caption: text("caption").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("photos_property_idx").on(table.propertyId)],
);

export const nearbyPlaces = sqliteTable(
  "nearby_places",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    propertyId: integer("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    category: text("category", { enum: ["transit", "school", "market", "hospital"] }).notNull(),
    name: text("name").notNull(),
    address: text("address").notNull(),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    distanceM: integer("distance_m").notNull(),
    fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("nearby_property_idx").on(table.propertyId, table.category, table.distanceM)],
);

export const officialTransactions = sqliteTable(
  "official_transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    fingerprint: text("fingerprint").notNull(),
    lawdCd: text("lawd_cd").notNull(),
    regionLabel: text("region_label").notNull(),
    dealYmd: text("deal_ymd").notNull(),
    apartmentName: text("apartment_name").notNull(),
    legalDong: text("legal_dong").notNull(),
    jibun: text("jibun"),
    roadAddress: text("road_address"),
    areaSqm: real("area_sqm").notNull(),
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
    apiVariant: text("api_variant", { enum: ["detail", "basic"] }).notNull().default("detail"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("official_transactions_fingerprint_unique").on(table.fingerprint),
    index("official_transactions_region_month_idx").on(table.lawdCd, table.dealYmd),
  ],
);

export const officialRentTransactions = sqliteTable(
  "official_rent_transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    fingerprint: text("fingerprint").notNull(),
    lawdCd: text("lawd_cd").notNull(),
    regionLabel: text("region_label").notNull(),
    dealYmd: text("deal_ymd").notNull(),
    apartmentName: text("apartment_name").notNull(),
    legalDong: text("legal_dong").notNull(),
    jibun: text("jibun"),
    roadAddress: text("road_address"),
    areaSqm: real("area_sqm").notNull(),
    floor: integer("floor"),
    depositMan: integer("deposit_man").notNull(),
    monthlyRentMan: integer("monthly_rent_man").notNull(),
    contractTerm: text("contract_term"),
    buildYear: integer("build_year"),
    estateAgentDistrict: text("estate_agent_district"),
    apartmentDong: text("apartment_dong"),
    landLeasehold: text("land_leasehold"),
    apiVariant: text("api_variant", { enum: ["detail", "basic"] }).notNull().default("detail"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("official_rent_transactions_fingerprint_unique").on(table.fingerprint),
    index("official_rent_transactions_region_month_idx").on(table.lawdCd, table.dealYmd),
  ],
);

export const propertyComparisons = sqliteTable(
  "property_comparisons",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    propertyId: integer("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    comparisonNote: text("comparison_note").notNull().default(""),
    valueAssessment: text("value_assessment").notNull().default(""),
    conclusion: text("conclusion").notNull().default(""),
    finalSelected: integer("final_selected", { mode: "boolean" }).notNull().default(false),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("property_comparisons_property_unique").on(table.propertyId),
    index("property_comparisons_position_idx").on(table.position),
  ],
);

export const revisitTasks = sqliteTable(
  "revisit_tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    propertyId: integer("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
    itemKey: text("item_key").notNull(),
    label: text("label").notNull(),
    reason: text("reason", { enum: ["unchecked", "missing_note", "custom"] }).notNull(),
    completed: integer("completed", { mode: "boolean" }).notNull().default(false),
    note: text("note").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("revisit_tasks_property_item_unique").on(table.propertyId, table.itemKey),
    index("revisit_tasks_property_idx").on(table.propertyId, table.completed),
  ],
);

export const priceTrackers = sqliteTable(
  "price_trackers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    propertyId: integer("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    targetPriceMan: integer("target_price_man"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("price_trackers_property_unique").on(table.propertyId)],
);

export const priceSnapshots = sqliteTable(
  "price_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    propertyId: integer("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
    amountMan: integer("amount_man").notNull(),
    kind: text("kind", { enum: ["asking", "official_trade"] }).notNull(),
    note: text("note").notNull().default(""),
    sourceUrl: text("source_url"),
    recordedAt: integer("recorded_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("price_snapshots_property_date_idx").on(table.propertyId, table.recordedAt)],
);

export const financeScenarios = sqliteTable(
  "finance_scenarios",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    propertyId: integer("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
    purchasePriceMan: integer("purchase_price_man").notNull(),
    ownFundsMan: integer("own_funds_man").notNull(),
    annualIncomeMan: integer("annual_income_man").notNull(),
    otherAnnualDebtMan: integer("other_annual_debt_man").notNull(),
    loanRatePct: real("loan_rate_pct").notNull(),
    loanYears: integer("loan_years").notNull(),
    ltvPct: real("ltv_pct").notNull(),
    acquisitionTaxPct: real("acquisition_tax_pct").notNull(),
    brokeragePct: real("brokerage_pct").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("finance_scenarios_property_unique").on(table.propertyId)],
);

export const referenceResults = sqliteTable(
  "reference_results",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    propertyId: integer("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["price", "location"] }).notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    source: text("source"),
    snippet: text("snippet"),
    publishedAt: text("published_at"),
    rank: integer("rank").notNull(),
    fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("reference_property_idx").on(table.propertyId, table.kind, table.rank)],
);

export const watchItems = sqliteTable(
  "watch_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    lawdCd: text("lawd_cd").notNull(),
    regionLabel: text("region_label").notNull(),
    complexName: text("complex_name").notNull(),
    areaSqm: real("area_sqm").notNull(),
    areaToleranceSqm: real("area_tolerance_sqm").notNull().default(1),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    dropAlertPct: real("drop_alert_pct").notNull().default(3),
    targetPriceMan: integer("target_price_man"),
    bargainBelowMan: integer("bargain_below_man"),
    notes: text("notes").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("watch_items_active_idx").on(table.active),
    index("watch_items_lawd_idx").on(table.lawdCd, table.complexName),
  ],
);

export const watchPriceSeries = sqliteTable(
  "watch_price_series",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    watchId: integer("watch_id")
      .notNull()
      .references(() => watchItems.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    avgPriceMan: integer("avg_price_man"),
    medianPriceMan: integer("median_price_man"),
    minPriceMan: integer("min_price_man"),
    maxPriceMan: integer("max_price_man"),
    tradeCount: integer("trade_count").notNull().default(0),
    fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("watch_price_series_watch_month_unique").on(table.watchId, table.month),
    index("watch_price_series_month_idx").on(table.watchId, table.month),
  ],
);

export const watchRentSeries = sqliteTable(
  "watch_rent_series",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
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
    fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("watch_rent_series_watch_month_unique").on(table.watchId, table.month),
    index("watch_rent_series_month_idx").on(table.watchId, table.month),
  ],
);

export const watchAskRecords = sqliteTable(
  "watch_ask_records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    watchId: integer("watch_id")
      .notNull()
      .references(() => watchItems.id, { onDelete: "cascade" }),
    amountMan: integer("amount_man").notNull(),
    source: text("source").notNull().default(""),
    note: text("note").notNull().default(""),
    recordedAt: integer("recorded_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("watch_ask_records_watch_date_idx").on(table.watchId, table.recordedAt)],
);

export const priceAlerts = sqliteTable(
  "price_alerts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    watchId: integer("watch_id")
      .notNull()
      .references(() => watchItems.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["price_drop", "target_reached", "bargain"] }).notNull(),
    title: text("title").notNull(),
    detail: text("detail").notNull(),
    month: text("month"),
    triggerValueMan: integer("trigger_value_man"),
    baselineValueMan: integer("baseline_value_man"),
    changePct: real("change_pct"),
    sourceUrl: text("source_url").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("price_alerts_watch_idx").on(table.watchId, table.createdAt),
    index("price_alerts_unread_idx").on(table.readAt),
    uniqueIndex("price_alerts_watch_type_month_unique").on(table.watchId, table.type, table.month),
  ],
);

export const watchCheckRuns = sqliteTable(
  "watch_check_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    watchId: integer("watch_id")
      .notNull()
      .references(() => watchItems.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["ok", "needs_key", "rate_limited", "error", "skipped"] }).notNull(),
    monthsChecked: text("months_checked").notNull().default(""),
    newTrades: integer("new_trades").notNull().default(0),
    alertsCreated: integer("alerts_created").notNull().default(0),
    message: text("message"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("watch_check_runs_watch_idx").on(table.watchId, table.createdAt)],
);

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const listings = sqliteTable(
  "listings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    propertyId: integer("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    brokerName: text("broker_name").notNull().default(""),
    brokerContact: text("broker_contact").notNull().default(""),
    dong: text("dong").notNull().default(""),
    ho: text("ho").notNull().default(""),
    areaSqm: real("area_sqm"),
    tradeType: text("trade_type", { enum: ["sale", "jeonse", "wolse"] }).notNull().default("sale"),
    priceMan: integer("price_man").notNull(),
    monthlyRentMan: integer("monthly_rent_man"),
    targetPriceMan: integer("target_price_man"),
    listingUrl: text("listing_url"),
    status: text("status", { enum: ["active", "hold", "done", "closed"] }).notNull().default("active"),
    memo: text("memo").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("listings_property_idx").on(table.propertyId, table.updatedAt)],
);

export const listingPriceLogs = sqliteTable(
  "listing_price_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    priceMan: integer("price_man").notNull(),
    monthlyRentMan: integer("monthly_rent_man"),
    note: text("note").notNull().default(""),
    sourceNote: text("source_note").notNull().default(""),
    recordedAt: integer("recorded_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("listing_price_logs_listing_date_idx").on(table.listingId, table.recordedAt)],
);

export const tourCourses = sqliteTable(
  "tour_courses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    visitDate: text("visit_date"),
    notes: text("notes").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("tour_courses_updated_idx").on(table.updatedAt)],
);

export const tourCourseStops = sqliteTable(
  "tour_course_stops",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    courseId: integer("course_id")
      .notNull()
      .references(() => tourCourses.id, { onDelete: "cascade" }),
    propertyId: integer("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    memo: text("memo").notNull().default(""),
    completed: integer("completed", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("tour_course_stops_course_property_unique").on(table.courseId, table.propertyId),
    index("tour_course_stops_course_position_idx").on(table.courseId, table.position),
  ],
);

export const voiceMemos = sqliteTable(
  "voice_memos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    propertyId: integer("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    listingId: integer("listing_id").references(() => listings.id, { onDelete: "cascade" }),
    checklistItemKey: text("checklist_item_key"),
    title: text("title").notNull().default(""),
    blobKey: text("blob_key").notNull(),
    mimeType: text("mime_type").notNull(),
    durationSec: real("duration_sec"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("voice_memos_property_idx").on(table.propertyId, table.createdAt),
    index("voice_memos_listing_idx").on(table.listingId),
  ],
);
