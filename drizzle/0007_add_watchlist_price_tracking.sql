CREATE TABLE watch_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lawd_cd TEXT NOT NULL,
  region_label TEXT NOT NULL,
  complex_name TEXT NOT NULL,
  area_sqm REAL NOT NULL,
  area_tolerance_sqm REAL NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  drop_alert_pct REAL NOT NULL DEFAULT 3,
  target_price_man INTEGER,
  bargain_below_man INTEGER,
  notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX watch_items_active_idx ON watch_items(active);
--> statement-breakpoint
CREATE INDEX watch_items_lawd_idx ON watch_items(lawd_cd, complex_name);
--> statement-breakpoint
CREATE TABLE watch_price_series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  watch_id INTEGER NOT NULL REFERENCES watch_items(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  avg_price_man INTEGER,
  median_price_man INTEGER,
  min_price_man INTEGER,
  max_price_man INTEGER,
  trade_count INTEGER NOT NULL DEFAULT 0,
  fetched_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX watch_price_series_watch_month_unique ON watch_price_series(watch_id, month);
--> statement-breakpoint
CREATE INDEX watch_price_series_month_idx ON watch_price_series(watch_id, month);
--> statement-breakpoint
CREATE TABLE watch_ask_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  watch_id INTEGER NOT NULL REFERENCES watch_items(id) ON DELETE CASCADE,
  amount_man INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  recorded_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX watch_ask_records_watch_date_idx ON watch_ask_records(watch_id, recorded_at);
--> statement-breakpoint
CREATE TABLE price_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  watch_id INTEGER NOT NULL REFERENCES watch_items(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  month TEXT,
  trigger_value_man INTEGER,
  baseline_value_man INTEGER,
  change_pct REAL,
  source_url TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  read_at INTEGER
);
--> statement-breakpoint
CREATE INDEX price_alerts_watch_idx ON price_alerts(watch_id, created_at);
--> statement-breakpoint
CREATE INDEX price_alerts_unread_idx ON price_alerts(read_at);
--> statement-breakpoint
CREATE UNIQUE INDEX price_alerts_watch_type_month_unique ON price_alerts(watch_id, type, month);
--> statement-breakpoint
CREATE TABLE watch_check_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  watch_id INTEGER NOT NULL REFERENCES watch_items(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  months_checked TEXT NOT NULL DEFAULT '',
  new_trades INTEGER NOT NULL DEFAULT 0,
  alerts_created INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX watch_check_runs_watch_idx ON watch_check_runs(watch_id, created_at);
--> statement-breakpoint
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
