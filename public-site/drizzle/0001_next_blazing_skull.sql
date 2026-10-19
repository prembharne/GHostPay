CREATE TABLE `wallet_profiles` (
	`wallet` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_username` ON `wallet_profiles` (`username`);