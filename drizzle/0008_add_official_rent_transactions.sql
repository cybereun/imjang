CREATE TABLE `official_rent_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fingerprint` text NOT NULL,
	`lawd_cd` text NOT NULL,
	`region_label` text NOT NULL,
	`deal_ymd` text NOT NULL,
	`apartment_name` text NOT NULL,
	`legal_dong` text NOT NULL,
	`jibun` text,
	`road_address` text,
	`area_sqm` real NOT NULL,
	`floor` integer,
	`deposit_man` integer NOT NULL,
	`monthly_rent_man` integer NOT NULL,
	`contract_term` text,
	`build_year` integer,
	`estate_agent_district` text,
	`apartment_dong` text,
	`land_leasehold` text,
	`api_variant` text NOT NULL DEFAULT 'detail',
	`latitude` real,
	`longitude` real,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `official_rent_transactions_fingerprint_unique` ON `official_rent_transactions` (`fingerprint`);
--> statement-breakpoint
CREATE INDEX `official_rent_transactions_region_month_idx` ON `official_rent_transactions` (`lawd_cd`, `deal_ymd`);
--> statement-breakpoint
CREATE TABLE `watch_rent_series` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`watch_id` integer NOT NULL REFERENCES `watch_items`(`id`) ON DELETE CASCADE,
	`month` text NOT NULL,
	`jeonse_median_man` integer,
	`jeonse_avg_man` integer,
	`jeonse_min_man` integer,
	`jeonse_max_man` integer,
	`jeonse_count` integer NOT NULL DEFAULT 0,
	`wolse_median_man` integer,
	`wolse_avg_man` integer,
	`wolse_avg_monthly_man` integer,
	`wolse_count` integer NOT NULL DEFAULT 0,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `watch_rent_series_watch_month_unique` ON `watch_rent_series` (`watch_id`, `month`);
--> statement-breakpoint
CREATE INDEX `watch_rent_series_month_idx` ON `watch_rent_series` (`watch_id`, `month`);
