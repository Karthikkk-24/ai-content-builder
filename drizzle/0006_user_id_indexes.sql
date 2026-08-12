CREATE INDEX IF NOT EXISTS "content_projects_user_id_idx" ON "content_projects" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_projects_generation_id_idx" ON "content_projects" ("generation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_projects_is_public_idx" ON "content_projects" ("is_public");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generations_user_id_idx" ON "generations" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reference_images_user_id_idx" ON "reference_images" ("user_id");
