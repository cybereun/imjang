CREATE TABLE `tour_courses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`visit_date` text,
	`notes` text NOT NULL DEFAULT '',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tour_courses_updated_idx` ON `tour_courses` (`updated_at`);
--> statement-breakpoint
CREATE TABLE `tour_course_stops` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL REFERENCES `tour_courses`(`id`) ON DELETE CASCADE,
	`property_id` integer NOT NULL REFERENCES `properties`(`id`) ON DELETE CASCADE,
	`position` integer NOT NULL,
	`memo` text NOT NULL DEFAULT '',
	`completed` integer NOT NULL DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tour_course_stops_course_property_unique` ON `tour_course_stops` (`course_id`, `property_id`);
--> statement-breakpoint
CREATE INDEX `tour_course_stops_course_position_idx` ON `tour_course_stops` (`course_id`, `position`);
