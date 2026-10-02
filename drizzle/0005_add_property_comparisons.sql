CREATE TABLE property_comparisons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  comparison_note TEXT NOT NULL DEFAULT '',
  value_assessment TEXT NOT NULL DEFAULT '',
  conclusion TEXT NOT NULL DEFAULT '',
  final_selected INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX property_comparisons_property_unique ON property_comparisons(property_id);
--> statement-breakpoint
CREATE INDEX property_comparisons_position_idx ON property_comparisons(position);
