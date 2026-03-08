-- Shared PIN login rate-limit state across app instances.
CREATE TABLE IF NOT EXISTS "pin_login_rate_limit" (
  "ip_address" text PRIMARY KEY NOT NULL,
  "fail_count" integer NOT NULL DEFAULT 0,
  "window_started_at" timestamp with time zone NOT NULL DEFAULT now(),
  "locked_until" timestamp with time zone,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_pin_login_rate_limit_locked_until"
  ON "pin_login_rate_limit" USING btree ("locked_until");

CREATE INDEX IF NOT EXISTS "idx_pin_login_rate_limit_updated_at"
  ON "pin_login_rate_limit" USING btree ("updated_at");
