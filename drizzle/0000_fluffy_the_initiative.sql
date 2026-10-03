CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"item_key" text NOT NULL,
	"checked" boolean DEFAULT false NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_scenarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"purchase_price_man" integer NOT NULL,
	"own_funds_man" integer NOT NULL,
	"annual_income_man" integer NOT NULL,
	"other_annual_debt_man" integer NOT NULL,
	"loan_rate_pct" double precision NOT NULL,
	"loan_years" integer NOT NULL,
	"ltv_pct" double precision NOT NULL,
	"acquisition_tax_pct" double precision NOT NULL,
	"brokerage_pct" double precision NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_price_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" integer NOT NULL,
	"price_man" integer NOT NULL,
	"monthly_rent_man" integer,
	"note" text DEFAULT '' NOT NULL,
	"source_note" text DEFAULT '' NOT NULL,
	"recorded_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"broker_name" text DEFAULT '' NOT NULL,
	"broker_contact" text DEFAULT '' NOT NULL,
	"dong" text DEFAULT '' NOT NULL,
	"ho" text DEFAULT '' NOT NULL,
	"area_sqm" double precision,
	"trade_type" text DEFAULT 'sale' NOT NULL,
	"price_man" integer NOT NULL,
	"monthly_rent_man" integer,
	"target_price_man" integer,
	"listing_url" text,
	"status" text DEFAULT 'active' NOT NULL,
	"memo" text DEFAULT '' NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nearby_places" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"distance_m" integer NOT NULL,
	"fetched_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "official_rent_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"fingerprint" text NOT NULL,
	"lawd_cd" text NOT NULL,
	"region_label" text NOT NULL,
	"deal_ymd" text NOT NULL,
	"apartment_name" text NOT NULL,
	"legal_dong" text NOT NULL,
	"jibun" text,
	"road_address" text,
	"area_sqm" double precision NOT NULL,
	"floor" integer,
	"deposit_man" integer NOT NULL,
	"monthly_rent_man" integer NOT NULL,
	"contract_term" text,
	"build_year" integer,
	"estate_agent_district" text,
	"apartment_dong" text,
	"land_leasehold" text,
	"api_variant" text DEFAULT 'detail' NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"fetched_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "official_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"fingerprint" text NOT NULL,
	"lawd_cd" text NOT NULL,
	"region_label" text NOT NULL,
	"deal_ymd" text NOT NULL,
	"apartment_name" text NOT NULL,
	"legal_dong" text NOT NULL,
	"jibun" text,
	"road_address" text,
	"area_sqm" double precision NOT NULL,
	"floor" integer,
	"deal_amount_man" integer NOT NULL,
	"build_year" integer,
	"dealing_type" text,
	"registration_date" text,
	"buyer_type" text,
	"seller_type" text,
	"estate_agent_district" text,
	"apartment_dong" text,
	"land_leasehold" text,
	"api_variant" text DEFAULT 'detail' NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"fetched_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"blob_key" text NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"watch_id" integer NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"detail" text NOT NULL,
	"month" text,
	"trigger_value_man" integer,
	"baseline_value_man" integer,
	"change_pct" double precision,
	"source_url" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "price_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"amount_man" integer NOT NULL,
	"kind" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"source_url" text,
	"recorded_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_trackers" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"target_price_man" integer,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"resolved_address" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"area_sqm" double precision NOT NULL,
	"asking_price_man" integer NOT NULL,
	"deposit_man" integer,
	"monthly_rent_man" integer,
	"purpose" text DEFAULT 'both' NOT NULL,
	"visit_date" text,
	"memo" text DEFAULT '' NOT NULL,
	"price_basis" text DEFAULT 'asking' NOT NULL,
	"source_reference" text,
	"source_record_id" text,
	"geocode_source" text DEFAULT 'OpenStreetMap Nominatim' NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_comparisons" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"position" integer NOT NULL,
	"comparison_note" text DEFAULT '' NOT NULL,
	"value_assessment" text DEFAULT '' NOT NULL,
	"conclusion" text DEFAULT '' NOT NULL,
	"final_selected" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reference_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"source" text,
	"snippet" text,
	"published_at" text,
	"rank" integer NOT NULL,
	"fetched_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revisit_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"item_key" text NOT NULL,
	"label" text NOT NULL,
	"reason" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tour_course_stops" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"property_id" integer NOT NULL,
	"position" integer NOT NULL,
	"memo" text DEFAULT '' NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tour_courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"visit_date" text,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_memos" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"listing_id" integer,
	"checklist_item_key" text,
	"title" text DEFAULT '' NOT NULL,
	"blob_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"duration_sec" double precision,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watch_ask_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"watch_id" integer NOT NULL,
	"amount_man" integer NOT NULL,
	"source" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"recorded_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watch_check_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"watch_id" integer NOT NULL,
	"status" text NOT NULL,
	"months_checked" text DEFAULT '' NOT NULL,
	"new_trades" integer DEFAULT 0 NOT NULL,
	"alerts_created" integer DEFAULT 0 NOT NULL,
	"message" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watch_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"lawd_cd" text NOT NULL,
	"region_label" text NOT NULL,
	"complex_name" text NOT NULL,
	"area_sqm" double precision NOT NULL,
	"area_tolerance_sqm" double precision DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"drop_alert_pct" double precision DEFAULT 3 NOT NULL,
	"target_price_man" integer,
	"bargain_below_man" integer,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watch_price_series" (
	"id" serial PRIMARY KEY NOT NULL,
	"watch_id" integer NOT NULL,
	"month" text NOT NULL,
	"avg_price_man" integer,
	"median_price_man" integer,
	"min_price_man" integer,
	"max_price_man" integer,
	"trade_count" integer DEFAULT 0 NOT NULL,
	"fetched_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watch_rent_series" (
	"id" serial PRIMARY KEY NOT NULL,
	"watch_id" integer NOT NULL,
	"month" text NOT NULL,
	"jeonse_median_man" integer,
	"jeonse_avg_man" integer,
	"jeonse_min_man" integer,
	"jeonse_max_man" integer,
	"jeonse_count" integer DEFAULT 0 NOT NULL,
	"wolse_median_man" integer,
	"wolse_avg_man" integer,
	"wolse_avg_monthly_man" integer,
	"wolse_count" integer DEFAULT 0 NOT NULL,
	"fetched_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checklist_entries" ADD CONSTRAINT "checklist_entries_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_scenarios" ADD CONSTRAINT "finance_scenarios_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_price_logs" ADD CONSTRAINT "listing_price_logs_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nearby_places" ADD CONSTRAINT "nearby_places_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_watch_id_watch_items_id_fk" FOREIGN KEY ("watch_id") REFERENCES "public"."watch_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_trackers" ADD CONSTRAINT "price_trackers_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_comparisons" ADD CONSTRAINT "property_comparisons_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_results" ADD CONSTRAINT "reference_results_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revisit_tasks" ADD CONSTRAINT "revisit_tasks_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour_course_stops" ADD CONSTRAINT "tour_course_stops_course_id_tour_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."tour_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour_course_stops" ADD CONSTRAINT "tour_course_stops_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_memos" ADD CONSTRAINT "voice_memos_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_memos" ADD CONSTRAINT "voice_memos_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_ask_records" ADD CONSTRAINT "watch_ask_records_watch_id_watch_items_id_fk" FOREIGN KEY ("watch_id") REFERENCES "public"."watch_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_check_runs" ADD CONSTRAINT "watch_check_runs_watch_id_watch_items_id_fk" FOREIGN KEY ("watch_id") REFERENCES "public"."watch_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_price_series" ADD CONSTRAINT "watch_price_series_watch_id_watch_items_id_fk" FOREIGN KEY ("watch_id") REFERENCES "public"."watch_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_rent_series" ADD CONSTRAINT "watch_rent_series_watch_id_watch_items_id_fk" FOREIGN KEY ("watch_id") REFERENCES "public"."watch_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_property_item_unique" ON "checklist_entries" USING btree ("property_id","item_key");--> statement-breakpoint
CREATE INDEX "checklist_property_idx" ON "checklist_entries" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_scenarios_property_unique" ON "finance_scenarios" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "listing_price_logs_listing_date_idx" ON "listing_price_logs" USING btree ("listing_id","recorded_at");--> statement-breakpoint
CREATE INDEX "listings_property_idx" ON "listings" USING btree ("property_id","updated_at");--> statement-breakpoint
CREATE INDEX "nearby_property_idx" ON "nearby_places" USING btree ("property_id","category","distance_m");--> statement-breakpoint
CREATE UNIQUE INDEX "official_rent_transactions_fingerprint_unique" ON "official_rent_transactions" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "official_rent_transactions_region_month_idx" ON "official_rent_transactions" USING btree ("lawd_cd","deal_ymd");--> statement-breakpoint
CREATE UNIQUE INDEX "official_transactions_fingerprint_unique" ON "official_transactions" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "official_transactions_region_month_idx" ON "official_transactions" USING btree ("lawd_cd","deal_ymd");--> statement-breakpoint
CREATE INDEX "photos_property_idx" ON "photos" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "price_alerts_watch_idx" ON "price_alerts" USING btree ("watch_id","created_at");--> statement-breakpoint
CREATE INDEX "price_alerts_unread_idx" ON "price_alerts" USING btree ("read_at");--> statement-breakpoint
CREATE UNIQUE INDEX "price_alerts_watch_type_month_unique" ON "price_alerts" USING btree ("watch_id","type","month");--> statement-breakpoint
CREATE INDEX "price_snapshots_property_date_idx" ON "price_snapshots" USING btree ("property_id","recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "price_trackers_property_unique" ON "price_trackers" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "properties_updated_idx" ON "properties" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "property_comparisons_property_unique" ON "property_comparisons" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "property_comparisons_position_idx" ON "property_comparisons" USING btree ("position");--> statement-breakpoint
CREATE INDEX "reference_property_idx" ON "reference_results" USING btree ("property_id","kind","rank");--> statement-breakpoint
CREATE UNIQUE INDEX "revisit_tasks_property_item_unique" ON "revisit_tasks" USING btree ("property_id","item_key");--> statement-breakpoint
CREATE INDEX "revisit_tasks_property_idx" ON "revisit_tasks" USING btree ("property_id","completed");--> statement-breakpoint
CREATE UNIQUE INDEX "tour_course_stops_course_property_unique" ON "tour_course_stops" USING btree ("course_id","property_id");--> statement-breakpoint
CREATE INDEX "tour_course_stops_course_position_idx" ON "tour_course_stops" USING btree ("course_id","position");--> statement-breakpoint
CREATE INDEX "tour_courses_updated_idx" ON "tour_courses" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "voice_memos_property_idx" ON "voice_memos" USING btree ("property_id","created_at");--> statement-breakpoint
CREATE INDEX "voice_memos_listing_idx" ON "voice_memos" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "watch_ask_records_watch_date_idx" ON "watch_ask_records" USING btree ("watch_id","recorded_at");--> statement-breakpoint
CREATE INDEX "watch_check_runs_watch_idx" ON "watch_check_runs" USING btree ("watch_id","created_at");--> statement-breakpoint
CREATE INDEX "watch_items_active_idx" ON "watch_items" USING btree ("active");--> statement-breakpoint
CREATE INDEX "watch_items_lawd_idx" ON "watch_items" USING btree ("lawd_cd","complex_name");--> statement-breakpoint
CREATE UNIQUE INDEX "watch_price_series_watch_month_unique" ON "watch_price_series" USING btree ("watch_id","month");--> statement-breakpoint
CREATE INDEX "watch_price_series_month_idx" ON "watch_price_series" USING btree ("watch_id","month");--> statement-breakpoint
CREATE UNIQUE INDEX "watch_rent_series_watch_month_unique" ON "watch_rent_series" USING btree ("watch_id","month");--> statement-breakpoint
CREATE INDEX "watch_rent_series_month_idx" ON "watch_rent_series" USING btree ("watch_id","month");