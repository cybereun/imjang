CREATE TABLE nearby_places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  distance_m INTEGER NOT NULL,
  fetched_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX nearby_property_idx ON nearby_places(property_id, category, distance_m);