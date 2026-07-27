-- Schedules the sync-collections-chase-queue edge function to run hourly,
-- giving Collections a backstop that doesn't depend on someone opening the
-- Collections Dashboard or Chase Queue page. Today, chase items are only
-- created/refreshed by syncChaseQueue() (src/lib/collections.ts), which runs
-- client-side, per-user, on page load only (CollectionsDashboard.tsx,
-- ChaseQueue.tsx) -- an invoice whose owner never opens Collections never
-- gets a chase item, and due_soon/overdue transitions only update whenever
-- someone happens to look. This job covers every user on a schedule instead.
-- The client-side call is kept as-is for immediate feedback right after
-- creating an invoice.
--
-- Follows the pattern actually live for process-recurring-transactions and
-- process-email-queue (confirmed via `select * from cron.job`): X-Cron-Secret
-- header checked against the existing 'recurring_cron_secret' vault secret,
-- not the Bearer/'email_queue_service_role_key' pattern written in this
-- repo's older recurring-transactions migration file on disk -- that file is
-- stale versus what's actually configured in the live database, and was not
-- used as the reference here.

DO $$
BEGIN
  PERFORM cron.unschedule('sync-collections-chase-queue-hourly');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'sync-collections-chase-queue-hourly',
  '0 * * * *', -- top of every hour
  $$
  SELECT net.http_post(
    url := 'https://zxlvqnqesmrockfpphzw.supabase.co/functions/v1/sync-collections-chase-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'recurring_cron_secret')
    ),
    body := jsonb_build_object('triggered_by', 'cron')
  );
  $$
);
