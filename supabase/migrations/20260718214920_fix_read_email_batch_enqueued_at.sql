-- read_email_batch dropped pgmq's enqueued_at column, but process-email-queue
-- relies on msg.enqueued_at as its TTL fallback whenever a message's own JSON
-- payload lacks queued_at ("PGMQ's enqueued_at which is always set by the
-- queue"). Since the RPC never returned that column, the fallback was always
-- undefined and TTL expiry silently never triggered via that path. Not
-- currently exploitable (today's only producer, send-transactional-email,
-- always sets queued_at), but a real latent gap for any other producer.
-- CREATE OR REPLACE can't change a function's return column list, so this
-- drops and recreates it.

DROP FUNCTION IF EXISTS public.read_email_batch(TEXT, INT, INT);

CREATE FUNCTION public.read_email_batch(queue_name TEXT, batch_size INT, vt INT)
RETURNS TABLE(msg_id BIGINT, read_ct INT, message JSONB, enqueued_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message, r.enqueued_at FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) TO service_role;
