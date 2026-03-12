ALTER TABLE "invoice" ADD COLUMN "last_emailed_at" timestamp with time zone;
ALTER TABLE "invoice" ADD COLUMN "last_reminder_sent_at" timestamp with time zone;
