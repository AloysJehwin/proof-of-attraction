CREATE TABLE IF NOT EXISTS "agent_actions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "match_id" uuid REFERENCES "matches"("id") ON DELETE CASCADE,
  "target_user" uuid REFERENCES "users"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "detail" text DEFAULT '' NOT NULL,
  "agent_backed" boolean DEFAULT false NOT NULL,
  "registered" boolean DEFAULT false NOT NULL,
  "revoked" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "agent_actions_user_idx" ON "agent_actions" ("user_id", "created_at");
