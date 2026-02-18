CREATE TABLE `track_lyrics` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `track_id` integer NOT NULL,
  `provider` text NOT NULL,
  `source_id` text,
  `synced_lrc` text,
  `plain_lyrics` text,
  `updated_at` integer DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `track_lyrics_track_id_unique` ON `track_lyrics` (`track_id`);
