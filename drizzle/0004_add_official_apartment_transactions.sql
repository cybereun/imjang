ALTER TABLE properties ADD COLUMN price_basis TEXT NOT NULL DEFAULT 'asking';
--> statement-breakpoint
ALTER TABLE properties ADD COLUMN source_reference TEXT;
--> statement-breakpoint
ALTER TABLE properties ADD COLUMN source_record_id TEXT;
--> statement-breakpoint
CREATE TABLE official_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint TEXT NOT NULL,
  lawd_cd TEXT NOT NULL,
  region_label TEXT NOT NULL,
  deal_ymd TEXT NOT NULL,
  apartment_name TEXT NOT NULL,
  legal_dong TEXT NOT NULL,
  jibun TEXT,
  road_address TEXT,
  area_sqm REAL NOT NULL,
  floor INTEGER,
  deal_amount_man INTEGER NOT NULL,
  build_year INTEGER,
  dealing_type TEXT,
  registration_date TEXT,
  buyer_type TEXT,
  seller_type TEXT,
  estate_agent_district TEXT,
  apartment_dong TEXT,
  land_leasehold TEXT,
  api_variant TEXT NOT NULL DEFAULT 'detail',
  latitude REAL,
  longitude REAL,
  fetched_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX official_transactions_fingerprint_unique ON official_transactions(fingerprint);
--> statement-breakpoint
CREATE INDEX official_transactions_region_month_idx ON official_transactions(lawd_cd, deal_ymd);
