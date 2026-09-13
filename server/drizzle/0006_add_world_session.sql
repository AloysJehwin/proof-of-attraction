ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "world_session_id" text UNIQUE;
