ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "handle" text;
CREATE UNIQUE INDEX IF NOT EXISTS "users_handle_unique" ON "users" ("handle");
