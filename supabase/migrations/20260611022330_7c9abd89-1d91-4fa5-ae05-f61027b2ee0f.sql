create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
declare v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'leaderei-flow-tick';
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end $$;

select cron.schedule(
  'leaderei-flow-tick',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://leaderei.lovable.app/api/public/hooks/run-flow-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lZGx2Z2V5bmVhcW9rdXBxb3llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNzAzMDMsImV4cCI6MjA5NDk0NjMwM30.Y14MFAm7kQoigxkCGykRoinQXtxt4jWoApYgAkIKpyk'
    ),
    body := '{}'::jsonb
  );
  $$
);