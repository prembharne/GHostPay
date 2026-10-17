CREATE TABLE `rate_windows` (
	`key` text PRIMARY KEY NOT NULL,
	`hits` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_expiry` ON `rate_windows` (`expires_at`);--> statement-breakpoint
CREATE TABLE `claim_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_id` text NOT NULL,
	`chain_id` integer NOT NULL,
	`contract` text NOT NULL,
	`recipient` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`deadline` text,
	`signature` text,
	`version` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `request_recipient` ON `claim_requests` (`chain_id`,`contract`,`payment_id`,`recipient`);