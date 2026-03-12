ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "last_emailed_at" timestamp with time zone;
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "last_reminder_sent_at" timestamp with time zone;
