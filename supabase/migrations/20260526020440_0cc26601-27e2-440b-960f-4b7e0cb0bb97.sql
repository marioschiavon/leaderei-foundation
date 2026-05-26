
-- 1) builder_documents: novos campos
alter table public.builder_documents
  add column if not exists status text not null default 'draft',
  add column if not exists published_at timestamptz,
  add column if not exists published_version integer,
  add column if not exists archived_at timestamptz;

alter table public.builder_documents
  drop constraint if exists builder_documents_status_check;
alter table public.builder_documents
  add constraint builder_documents_status_check
  check (status in ('draft', 'published'));

create unique index if not exists builder_documents_campaign_unique
  on public.builder_documents (campaign_id) where campaign_id is not null;

-- 2) flow_steps
create table if not exists public.flow_steps (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.builder_documents(id) on delete cascade,
  type text not null,
  position_x double precision not null default 0,
  position_y double precision not null default 0,
  config jsonb not null default '{}'::jsonb,
  is_entry boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists flow_steps_document_idx on public.flow_steps(document_id);
create unique index if not exists flow_steps_one_entry_per_doc
  on public.flow_steps(document_id) where is_entry = true;

drop trigger if exists flow_steps_set_updated_at on public.flow_steps;
create trigger flow_steps_set_updated_at
  before update on public.flow_steps
  for each row execute function public.update_updated_at_column();

alter table public.flow_steps enable row level security;

drop policy if exists "Org members manage flow_steps" on public.flow_steps;
create policy "Org members manage flow_steps"
on public.flow_steps for all to authenticated
using (
  exists (
    select 1 from public.builder_documents d
    where d.id = flow_steps.document_id
      and public.is_org_member(auth.uid(), d.organization_id)
  )
)
with check (
  exists (
    select 1 from public.builder_documents d
    where d.id = flow_steps.document_id
      and public.is_org_member(auth.uid(), d.organization_id)
  )
);

drop policy if exists "Master admins manage all flow_steps" on public.flow_steps;
create policy "Master admins manage all flow_steps"
on public.flow_steps for all to authenticated
using (public.has_role(auth.uid(), 'master_admin'::app_role))
with check (public.has_role(auth.uid(), 'master_admin'::app_role));

-- 3) flow_transitions
create table if not exists public.flow_transitions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.builder_documents(id) on delete cascade,
  from_step_id uuid not null references public.flow_steps(id) on delete cascade,
  to_step_id uuid not null references public.flow_steps(id) on delete cascade,
  branch text not null default 'next',
  created_at timestamptz not null default now()
);

alter table public.flow_transitions
  drop constraint if exists flow_transitions_branch_check;
alter table public.flow_transitions
  add constraint flow_transitions_branch_check
  check (branch in ('next', 'yes', 'no'));

create index if not exists flow_transitions_document_idx on public.flow_transitions(document_id);
create index if not exists flow_transitions_from_idx on public.flow_transitions(from_step_id);
create index if not exists flow_transitions_to_idx on public.flow_transitions(to_step_id);
create unique index if not exists flow_transitions_from_branch_unique
  on public.flow_transitions(from_step_id, branch);

alter table public.flow_transitions enable row level security;

drop policy if exists "Org members manage flow_transitions" on public.flow_transitions;
create policy "Org members manage flow_transitions"
on public.flow_transitions for all to authenticated
using (
  exists (
    select 1 from public.builder_documents d
    where d.id = flow_transitions.document_id
      and public.is_org_member(auth.uid(), d.organization_id)
  )
)
with check (
  exists (
    select 1 from public.builder_documents d
    where d.id = flow_transitions.document_id
      and public.is_org_member(auth.uid(), d.organization_id)
  )
);

drop policy if exists "Master admins manage all flow_transitions" on public.flow_transitions;
create policy "Master admins manage all flow_transitions"
on public.flow_transitions for all to authenticated
using (public.has_role(auth.uid(), 'master_admin'::app_role))
with check (public.has_role(auth.uid(), 'master_admin'::app_role));
