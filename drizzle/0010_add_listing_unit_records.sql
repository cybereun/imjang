CREATE TABLE `listings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`property_id` integer NOT NULL REFERENCES `properties`(`id`) ON DELETE CASCADE,
	`broker_name` text NOT NULL DEFAULT '',
	`broker_contact` text NOT NULL DEFAULT '',
	`dong` text NOT NULL DEFAULT '',
	`ho` text NOT NULL DEFAULT '',
	`area_sqm` real,
	`trade_type` text NOT NULL DEFAULT 'sale',
	`price_man` integer NOT NULL,
	`monthly_rent_man` integer,
	`target_price_man` integer,
	`listing_url` text,
	`status` text NOT NULL DEFAULT 'active',
	`memo` text NOT NULL DEFAULT '',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `listings_property_idx` ON `listings` (`property_id`, `updated_at`);
--> statement-breakpoint
CREATE TABLE `listing_price_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`listing_id` integer NOT NULL REFERENCES `listings`(`id`) ON DELETE CASCADE,
	`price_man` integer NOT NULL,
	`monthly_rent_man` integer,
	`note` text NOT NULL DEFAULT '',
	`source_note` text NOT NULL DEFAULT '',
	`recorded_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `listing_price_logs_listing_date_idx` ON `listing_price_logs` (`listing_id`, `recorded_at`);
