CREATE TABLE `voice_memos` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `property_id` integer NOT NULL REFERENCES `properties`(`id`) ON DELETE cascade,
  `listing_id` integer REFERENCES `listings`(`id`) ON DELETE cascade,
  `checklist_item_key` text,
  `title` text DEFAULT '' NOT NULL,
  `blob_key` text NOT NULL,
  `mime_type` text NOT NULL,
  `duration_sec` real,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `voice_memos_property_idx` ON `voice_memos` (`property_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `voice_memos_listing_idx` ON `voice_memos` (`listing_id`);
