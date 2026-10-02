CREATE TABLE revisit_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  label TEXT NOT NULL,
  reason TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX revisit_tasks_property_item_unique ON revisit_tasks(property_id, item_key);
--> statement-breakpoint
CREATE INDEX revisit_tasks_property_idx ON revisit_tasks(property_id, completed);
--> statement-breakpoint
CREATE TABLE price_trackers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  active INTEGER NOT NULL DEFAULT 1,
  target_price_man INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX price_trackers_property_unique ON price_trackers(property_id);
--> statement-breakpoint
CREATE TABLE price_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  amount_man INTEGER NOT NULL,
  kind TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  source_url TEXT,
  recorded_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX price_snapshots_property_date_idx ON price_snapshots(property_id, recorded_at);
--> statement-breakpoint
CREATE TABLE finance_scenarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  purchase_price_man INTEGER NOT NULL,
  own_funds_man INTEGER NOT NULL,
  annual_income_man INTEGER NOT NULL,
  other_annual_debt_man INTEGER NOT NULL,
  loan_rate_pct REAL NOT NULL,
  loan_years INTEGER NOT NULL,
  ltv_pct REAL NOT NULL,
  acquisition_tax_pct REAL NOT NULL,
  brokerage_pct REAL NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX finance_scenarios_property_unique ON finance_scenarios(property_id);