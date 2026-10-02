DROP TABLE entries;
--> statement-breakpoint
CREATE TABLE properties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  resolved_address TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  area_sqm REAL NOT NULL,
  asking_price_man INTEGER NOT NULL,
  deposit_man INTEGER,
  monthly_rent_man INTEGER,
  purpose TEXT NOT NULL DEFAULT 'both',
  visit_date TEXT,
  memo TEXT NOT NULL DEFAULT '',
  geocode_source TEXT NOT NULL DEFAULT 'OpenStreetMap Nominatim',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE checklist_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  checked INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  UNIQUE(property_id, item_key)
);
--> statement-breakpoint
CREATE TABLE photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  blob_key TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE reference_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT,
  snippet TEXT,
  published_at TEXT,
  rank INTEGER NOT NULL,
  fetched_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX properties_updated_idx ON properties(updated_at DESC);
--> statement-breakpoint
CREATE INDEX checklist_property_idx ON checklist_entries(property_id);
--> statement-breakpoint
CREATE INDEX photos_property_idx ON photos(property_id);
--> statement-breakpoint
CREATE INDEX reference_property_idx ON reference_results(property_id, kind, rank);