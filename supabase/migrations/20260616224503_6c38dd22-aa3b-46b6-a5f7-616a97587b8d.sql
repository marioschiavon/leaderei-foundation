UPDATE public.flow_step_runs
SET status = 'failed', finished_at = now(), error = 'lock expirado — reagendado manualmente'
WHERE id = 'd4b6ae4b-e296-459b-bec0-3d9b174aa885' AND status = 'running';

UPDATE public.scheduled_jobs
SET status = 'pending', locked_at = NULL, locked_by = NULL, run_at = now(), last_error = 'lock expirado — reagendado manualmente'
WHERE id = '80bb43d7-0d48-4f04-b768-9d34c5f408be';

UPDATE public.campaign_enrollments
SET next_run_at = now(), last_error = NULL, status = 'active'
WHERE id = '9abbdb4f-4555-4e52-a798-a237987c59eb';