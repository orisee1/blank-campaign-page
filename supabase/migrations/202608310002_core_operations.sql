-- Central de Campanha — território, pessoas, processos, tarefas e compromissos.

begin;

create table public.territories (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  parent_id uuid references public.territories(id) on delete restrict,
  type text not null check (type in ('Estado', 'Município', 'Bairro/Região')),
  name text not null,
  state_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  archived_at timestamptz,
  deleted_at timestamptz,
  unique (campaign_id, parent_id, name)
);

create index territories_campaign_parent_idx
  on public.territories (campaign_id, parent_id) where deleted_at is null;
create index territories_campaign_type_name_idx
  on public.territories (campaign_id, type, name) where deleted_at is null;

create table public.operational_teams (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  name text not null,
  description text,
  territory_id uuid references public.territories(id) on delete restrict,
  coordinator_id uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  archived_at timestamptz,
  deleted_at timestamptz,
  unique (campaign_id, name)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  name text not null,
  color text not null default '#28795f',
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  archived_at timestamptz,
  deleted_at timestamptz,
  unique (campaign_id, name)
);

create table public.people_groups (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  name text not null,
  description text,
  territory_id uuid references public.territories(id) on delete restrict,
  team_id uuid references public.operational_teams(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  archived_at timestamptz,
  deleted_at timestamptz,
  unique (campaign_id, name)
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  name text not null,
  social_name text,
  phone text,
  whatsapp text,
  email extensions.citext,
  birth_date date,
  profession text,
  city text,
  neighborhood text,
  address text,
  origin text,
  notes text,
  privacy_basis text,
  privacy_purpose text,
  privacy_source text,
  consent_recorded_at timestamptz,
  do_not_contact boolean not null default false,
  erasure_requested_at timestamptz,
  owner_id uuid references public.profiles(id) on delete set null,
  territory_id uuid references public.territories(id) on delete restrict,
  team_id uuid references public.operational_teams(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  archived_at timestamptz,
  deleted_at timestamptz
);

create index people_campaign_name_idx
  on public.people (campaign_id, name) where deleted_at is null;
create index people_campaign_city_idx
  on public.people (campaign_id, city, neighborhood) where deleted_at is null;
create index people_campaign_phone_idx
  on public.people (campaign_id, phone) where phone is not null and deleted_at is null;
create index people_campaign_email_idx
  on public.people (campaign_id, email) where email is not null and deleted_at is null;
create index people_scope_idx
  on public.people (campaign_id, territory_id, team_id, owner_id) where deleted_at is null;

create table public.person_tags (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  person_id uuid not null references public.people(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (person_id, tag_id)
);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  group_id uuid not null references public.people_groups(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (group_id, person_id)
);

create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  person_id uuid not null references public.people(id) on delete restrict,
  type text not null check (type in ('Ligação', 'WhatsApp', 'E-mail', 'Presencial', 'Reunião', 'Outro')),
  occurred_at timestamptz not null,
  subject text not null,
  summary text,
  result text,
  next_action text,
  next_action_at timestamptz,
  assignee_id uuid references public.profiles(id) on delete set null,
  territory_id uuid references public.territories(id) on delete restrict,
  team_id uuid references public.operational_teams(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  archived_at timestamptz,
  deleted_at timestamptz
);

create index interactions_person_occurred_idx
  on public.interactions (person_id, occurred_at desc) where deleted_at is null;
create index interactions_next_action_idx
  on public.interactions (campaign_id, next_action_at) where next_action_at is not null and deleted_at is null;

create table public.process_statuses (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  name text not null,
  color text not null default '#65746f',
  sort_order integer not null default 0,
  closes_process boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  archived_at timestamptz,
  deleted_at timestamptz,
  unique (campaign_id, name)
);

create table public.process_categories (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  name text not null,
  color text not null default '#65746f',
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  archived_at timestamptz,
  deleted_at timestamptz,
  unique (campaign_id, name)
);

create table public.processes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  number bigint generated always as identity,
  title text not null,
  description text,
  category_id uuid not null references public.process_categories(id) on delete restrict,
  status_id uuid not null references public.process_statuses(id) on delete restrict,
  person_id uuid references public.people(id) on delete restrict,
  territory_id uuid references public.territories(id) on delete restrict,
  assignee_id uuid references public.profiles(id) on delete set null,
  team_id uuid references public.operational_teams(id) on delete restrict,
  priority text not null default 'Normal' check (priority in ('Baixa', 'Normal', 'Alta', 'Urgente')),
  due_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  archived_at timestamptz,
  deleted_at timestamptz,
  unique (campaign_id, number)
);

create index processes_status_due_idx
  on public.processes (campaign_id, status_id, due_at) where deleted_at is null;
create index processes_assignee_due_idx
  on public.processes (campaign_id, assignee_id, due_at) where deleted_at is null;
create index processes_person_idx
  on public.processes (person_id, created_at desc) where deleted_at is null;

create table public.process_comments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  process_id uuid not null references public.processes(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 10000),
  mentions uuid[] not null default '{}',
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  deleted_at timestamptz
);

create table public.process_history (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  process_id uuid not null references public.processes(id) on delete cascade,
  action text not null,
  summary text not null,
  before_data jsonb,
  after_data jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index process_history_process_created_idx
  on public.process_history (process_id, created_at desc);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  title text not null,
  description text,
  assignee_id uuid references public.profiles(id) on delete set null,
  team_id uuid references public.operational_teams(id) on delete restrict,
  territory_id uuid references public.territories(id) on delete restrict,
  priority text not null default 'Normal' check (priority in ('Baixa', 'Normal', 'Alta', 'Urgente')),
  status text not null default 'A fazer' check (status in ('A fazer', 'Em andamento', 'Aguardando', 'Concluído')),
  due_at timestamptz,
  completed_at timestamptz,
  process_id uuid references public.processes(id) on delete restrict,
  event_id uuid,
  person_id uuid references public.people(id) on delete restrict,
  reminder_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  archived_at timestamptz,
  deleted_at timestamptz
);

create index tasks_assignee_status_due_idx
  on public.tasks (campaign_id, assignee_id, status, due_at) where deleted_at is null;
create index tasks_process_idx
  on public.tasks (process_id, created_at desc) where deleted_at is null;

create table public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  task_id uuid not null references public.tasks(id) on delete cascade,
  text text not null,
  done boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  deleted_at timestamptz
);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  task_id uuid not null references public.tasks(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 10000),
  mentions uuid[] not null default '{}',
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  deleted_at timestamptz
);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  title text not null,
  type text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  address text,
  territory_id uuid references public.territories(id) on delete restrict,
  assignee_id uuid references public.profiles(id) on delete set null,
  team_id uuid references public.operational_teams(id) on delete restrict,
  participant_ids uuid[] not null default '{}',
  notes text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  archived_at timestamptz,
  deleted_at timestamptz,
  check (ends_at > starts_at)
);

create index calendar_events_campaign_start_idx
  on public.calendar_events (campaign_id, starts_at) where deleted_at is null;
create index calendar_events_assignee_start_idx
  on public.calendar_events (assignee_id, starts_at) where deleted_at is null;

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  title text not null,
  type text not null,
  due_at timestamptz not null,
  assignee_id uuid references public.profiles(id) on delete set null,
  territory_id uuid references public.territories(id) on delete restrict,
  team_id uuid references public.operational_teams(id) on delete restrict,
  related_type text,
  related_id uuid,
  done boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  archived_at timestamptz,
  deleted_at timestamptz
);

create index reminders_assignee_due_idx
  on public.reminders (campaign_id, assignee_id, due_at) where not done and deleted_at is null;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  related_type text,
  related_id uuid,
  read_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  deleted_at timestamptz
);

create index notifications_recipient_unread_idx
  on public.notifications (recipient_id, created_at desc) where read_at is null and deleted_at is null;

create or replace function app_private.territory_in_current_scope(target_territory uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with recursive ancestors as (
    select territory.id, territory.parent_id
    from public.territories territory
    where territory.id = target_territory
      and territory.campaign_id = app_private.current_campaign_id()
    union all
    select parent.id, parent.parent_id
    from public.territories parent
    join ancestors child on child.parent_id = parent.id
  )
  select exists (
    select 1
    from ancestors
    join public.user_scopes scope
      on scope.profile_id = auth.uid()
     and scope.scope_type = 'territory'
     and scope.scope_id = ancestors.id
  )
$$;

create or replace function app_private.scope_allows(
  target_campaign uuid,
  target_record_type text,
  target_record_id uuid,
  target_assignee uuid,
  target_owner uuid,
  target_territory uuid,
  target_team uuid,
  target_creator uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  role_scope text;
begin
  if target_campaign is distinct from app_private.current_campaign_id() then
    return false;
  end if;

  -- Cadastros auxiliares não carregam dados pessoais e precisam estar
  -- disponíveis para preencher filtros e formulários autorizados.
  if target_record_type = any(array['tags', 'process_statuses', 'process_categories']) then
    return true;
  end if;

  select role.scope into role_scope
  from public.profiles profile
  join public.roles role on role.id = profile.role_id
  where profile.id = auth.uid();

  return case role_scope
    when 'all' then true
    when 'assigned' then auth.uid() = any(array[target_assignee, target_owner, target_creator])
    when 'region' then target_territory is not null and app_private.territory_in_current_scope(target_territory)
    when 'team' then target_team is not null and exists (
      select 1 from public.user_scopes scope
      where scope.profile_id = auth.uid()
        and scope.scope_type = 'team'
        and scope.scope_id = target_team
    )
    when 'specific' then exists (
      select 1 from public.user_scopes scope
      where scope.profile_id = auth.uid()
        and scope.scope_type = 'record'
        and scope.scope_id = target_record_id
        and scope.record_type = target_record_type
    )
    else false
  end;
end;
$$;

create or replace function app_private.can_access_record(
  permission_module text,
  permission_action text,
  record_type text,
  record_campaign uuid,
  record_id uuid,
  record_data jsonb
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_permission(permission_module, permission_action)
    and app_private.scope_allows(
      record_campaign,
      record_type,
      record_id,
      nullif(record_data ->> 'assignee_id', '')::uuid,
      nullif(record_data ->> 'owner_id', '')::uuid,
      coalesce(
        nullif(record_data ->> 'territory_id', '')::uuid,
        case when record_type = 'territories' then record_id end
      ),
      coalesce(
        nullif(record_data ->> 'team_id', '')::uuid,
        case when record_type = 'operational_teams' then record_id end
      ),
      nullif(record_data ->> 'created_by', '')::uuid
    )
$$;

create or replace function app_private.prepare_domain_row()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    if tg_op = 'UPDATE' then
      new.updated_at := now();
      new.version := old.version + 1;
    end if;
    return new;
  end if;

  if auth.uid() is null or app_private.current_campaign_id() is null then
    raise exception 'authentication_required';
  end if;

  if tg_op = 'INSERT' then
    new.campaign_id := app_private.current_campaign_id();
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
    new.created_at := now();
    new.updated_at := now();
    new.version := 1;
  else
    new.id := old.id;
    new.campaign_id := old.campaign_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_by := auth.uid();
    new.updated_at := now();
    new.version := old.version + 1;

    if to_jsonb(old) ? 'deleted_at'
       and (to_jsonb(old) ->> 'deleted_at') is null
       and (to_jsonb(new) ->> 'deleted_at') is not null
       and not public.has_permission(tg_argv[0], 'delete') then
      raise exception 'delete_not_authorized';
    end if;

    if to_jsonb(old) ? 'deleted_at'
       and (to_jsonb(old) ->> 'deleted_at') is not null
       and (to_jsonb(new) ->> 'deleted_at') is null
       and not public.has_permission(tg_argv[0], 'restore') then
      raise exception 'restore_not_authorized';
    end if;

    if to_jsonb(old) ? 'archived_at'
       and (to_jsonb(old) ->> 'archived_at') is null
       and (to_jsonb(new) ->> 'archived_at') is not null
       and not public.has_permission(tg_argv[0], 'archive') then
      raise exception 'archive_not_authorized';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function app_private.territory_in_current_scope(uuid) from public, anon, authenticated;
revoke all on function app_private.scope_allows(uuid, text, uuid, uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function app_private.can_access_record(text, text, text, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function app_private.territory_in_current_scope(uuid) to authenticated;
grant execute on function app_private.scope_allows(uuid, text, uuid, uuid, uuid, uuid, uuid, uuid) to authenticated;
grant execute on function app_private.can_access_record(text, text, text, uuid, uuid, jsonb) to authenticated;

do $$
declare
  target record;
begin
  for target in
    select * from (values
      ('territories', 'territory'),
      ('operational_teams', 'team'),
      ('tags', 'people'),
      ('people_groups', 'people'),
      ('people', 'people'),
      ('interactions', 'people'),
      ('process_statuses', 'processes'),
      ('process_categories', 'processes'),
      ('processes', 'processes'),
      ('process_comments', 'processes'),
      ('tasks', 'tasks'),
      ('task_checklist_items', 'tasks'),
      ('task_comments', 'tasks'),
      ('calendar_events', 'calendar'),
      ('reminders', 'reminders')
    ) as configured(table_name, module_name)
  loop
    execute format(
      'create trigger %I_prepare before insert or update on public.%I for each row execute function app_private.prepare_domain_row(%L)',
      target.table_name, target.table_name, target.module_name
    );
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I for each row execute function app_private.audit_versioned_change(%L)',
      target.table_name, target.table_name, target.module_name
    );
  end loop;
end;
$$;

create or replace function app_private.prepare_link_row()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('postgres', 'supabase_admin', 'service_role') then
    if auth.uid() is null or app_private.current_campaign_id() is null then
      raise exception 'authentication_required';
    end if;
    new.campaign_id := app_private.current_campaign_id();
    new.created_by := auth.uid();
    new.created_at := now();
  end if;
  return new;
end;
$$;

create trigger person_tags_prepare
before insert on public.person_tags
for each row execute function app_private.prepare_link_row();
create trigger person_tags_audit
after insert or delete on public.person_tags
for each row execute function app_private.audit_versioned_change('people');

create trigger group_members_prepare
before insert on public.group_members
for each row execute function app_private.prepare_link_row();
create trigger group_members_audit
after insert or delete on public.group_members
for each row execute function app_private.audit_versioned_change('people');

create or replace function app_private.record_process_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.process_history (
    campaign_id, process_id, action, summary, before_data, after_data, created_by
  ) values (
    new.campaign_id,
    new.id,
    case when tg_op = 'INSERT' then 'create' else 'update' end,
    case when tg_op = 'INSERT' then 'Processo criado' else 'Processo atualizado' end,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new),
    auth.uid()
  );
  return new;
end;
$$;

create trigger processes_history
after insert or update on public.processes
for each row execute function app_private.record_process_history();

create or replace function app_private.notify_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  previous_assignee uuid;
begin
  previous_assignee := case when tg_op = 'UPDATE' then old.assignee_id else null end;
  if new.assignee_id is not null and new.assignee_id is distinct from previous_assignee then
    insert into public.notifications (
      campaign_id, recipient_id, title, message, related_type, related_id, created_by
    ) values (
      new.campaign_id,
      new.assignee_id,
      tg_argv[1],
      coalesce(to_jsonb(new) ->> 'title', 'Nova atribuição'),
      tg_argv[0],
      new.id,
      auth.uid()
    );
  end if;
  return new;
end;
$$;

create trigger processes_notify_assignment
after insert or update of assignee_id on public.processes
for each row execute function app_private.notify_assignment('processes', 'Novo processo atribuído');

create trigger tasks_notify_assignment
after insert or update of assignee_id on public.tasks
for each row execute function app_private.notify_assignment('tasks', 'Nova tarefa atribuída');

create or replace function app_private.create_follow_up_reminder()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.next_action_at is not null and new.next_action is not null then
    insert into public.reminders (
      campaign_id, title, type, due_at, assignee_id, territory_id, team_id,
      related_type, related_id, created_by, updated_by
    ) values (
      new.campaign_id,
      new.next_action,
      'retorno_prometido',
      new.next_action_at,
      coalesce(new.assignee_id, new.created_by),
      new.territory_id,
      new.team_id,
      'interaction',
      new.id,
      new.created_by,
      new.updated_by
    );
  end if;
  return new;
end;
$$;

create trigger interactions_create_follow_up
after insert on public.interactions
for each row execute function app_private.create_follow_up_reminder();

create or replace function app_private.protect_notification_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('postgres', 'supabase_admin', 'service_role') then
    new.id := old.id;
    new.campaign_id := old.campaign_id;
    new.recipient_id := old.recipient_id;
    new.title := old.title;
    new.message := old.message;
    new.related_type := old.related_type;
    new.related_id := old.related_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.deleted_at := old.deleted_at;
  end if;
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

create trigger notifications_protect_update
before update on public.notifications
for each row execute function app_private.protect_notification_update();

insert into public.process_statuses (
  id, campaign_id, name, color, sort_order, closes_process
) values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Novo', '#3b82f6', 10, false),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Em análise', '#8b5cf6', 20, false),
  ('20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'Em andamento', '#0ea5e9', 30, false),
  ('20000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'Encaminhado', '#f59e0b', 40, false),
  ('20000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', 'Aguardando retorno', '#f97316', 50, false),
  ('20000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', 'Concluído', '#22c55e', 60, true),
  ('20000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000001', 'Cancelado', '#ef4444', 70, true),
  ('20000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000001', 'Arquivado', '#64748b', 80, true)
on conflict (id) do nothing;

insert into public.process_categories (id, campaign_id, name, color)
values
  ('21000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Solicitação recebida', '#28795f'),
  ('21000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Demanda comunitária', '#2563eb'),
  ('21000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'Administrativo', '#7c3aed'),
  ('21000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'Evento', '#ea580c'),
  ('21000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', 'Jurídico', '#b91c1c'),
  ('21000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', 'Pendência interna', '#475569')
on conflict (id) do nothing;

do $$
declare
  target record;
begin
  for target in
    select * from (values
      ('territories', 'territory'),
      ('operational_teams', 'team'),
      ('tags', 'people'),
      ('people_groups', 'people'),
      ('people', 'people'),
      ('interactions', 'people'),
      ('process_statuses', 'processes'),
      ('process_categories', 'processes'),
      ('processes', 'processes'),
      ('tasks', 'tasks'),
      ('calendar_events', 'calendar'),
      ('reminders', 'reminders')
    ) as configured(table_name, module_name)
  loop
    execute format('alter table public.%I enable row level security', target.table_name);
    execute format(
      'create policy %I_select on public.%I for select to authenticated using (app_private.can_access_record(%L, %L, %L, campaign_id, id, to_jsonb(%I)))',
      target.table_name, target.table_name, target.module_name, 'view', target.table_name, target.table_name
    );
    execute format(
      'create policy %I_insert on public.%I for insert to authenticated with check (app_private.can_access_record(%L, %L, %L, campaign_id, id, to_jsonb(%I)))',
      target.table_name, target.table_name, target.module_name, 'create', target.table_name, target.table_name
    );
    execute format(
      'create policy %I_update on public.%I for update to authenticated using (app_private.can_access_record(%L, %L, %L, campaign_id, id, to_jsonb(%I))) with check (app_private.can_access_record(%L, %L, %L, campaign_id, id, to_jsonb(%I)))',
      target.table_name, target.table_name,
      target.module_name, 'view', target.table_name, target.table_name,
      target.module_name, 'edit', target.table_name, target.table_name
    );
    execute format('grant select, insert, update on public.%I to authenticated', target.table_name);
  end loop;
end;
$$;

alter table public.person_tags enable row level security;
alter table public.group_members enable row level security;
alter table public.process_comments enable row level security;
alter table public.process_history enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_comments enable row level security;
alter table public.notifications enable row level security;

create policy person_tags_select
on public.person_tags for select to authenticated
using (exists (select 1 from public.people person where person.id = person_id));
create policy person_tags_manage
on public.person_tags for all to authenticated
using (exists (select 1 from public.people person where person.id = person_id) and public.has_permission('people', 'edit'))
with check (exists (select 1 from public.people person where person.id = person_id) and public.has_permission('people', 'edit'));

create policy group_members_select
on public.group_members for select to authenticated
using (exists (select 1 from public.people person where person.id = person_id));
create policy group_members_manage
on public.group_members for all to authenticated
using (exists (select 1 from public.people person where person.id = person_id) and public.has_permission('people', 'edit'))
with check (exists (select 1 from public.people person where person.id = person_id) and public.has_permission('people', 'edit'));

create policy process_history_select
on public.process_history for select to authenticated
using (exists (select 1 from public.processes process where process.id = process_id));

create policy process_comments_select
on public.process_comments for select to authenticated
using (exists (select 1 from public.processes process where process.id = process_id));
create policy process_comments_insert
on public.process_comments for insert to authenticated
with check (
  exists (select 1 from public.processes process where process.id = process_id)
  and public.has_permission('processes', 'edit')
);
create policy process_comments_update
on public.process_comments for update to authenticated
using (
  exists (select 1 from public.processes process where process.id = process_id)
  and created_by = auth.uid()
)
with check (
  exists (select 1 from public.processes process where process.id = process_id)
  and created_by = auth.uid()
);

create policy task_checklist_select
on public.task_checklist_items for select to authenticated
using (exists (select 1 from public.tasks task where task.id = task_id));
create policy task_checklist_insert
on public.task_checklist_items for insert to authenticated
with check (
  exists (select 1 from public.tasks task where task.id = task_id)
  and public.has_permission('tasks', 'edit')
);
create policy task_checklist_update
on public.task_checklist_items for update to authenticated
using (exists (select 1 from public.tasks task where task.id = task_id))
with check (
  exists (select 1 from public.tasks task where task.id = task_id)
  and public.has_permission('tasks', 'edit')
);

create policy task_comments_select
on public.task_comments for select to authenticated
using (exists (select 1 from public.tasks task where task.id = task_id));
create policy task_comments_insert
on public.task_comments for insert to authenticated
with check (
  exists (select 1 from public.tasks task where task.id = task_id)
  and public.has_permission('tasks', 'edit')
);
create policy task_comments_update
on public.task_comments for update to authenticated
using (
  exists (select 1 from public.tasks task where task.id = task_id)
  and created_by = auth.uid()
)
with check (
  exists (select 1 from public.tasks task where task.id = task_id)
  and created_by = auth.uid()
);

create policy notifications_select_own
on public.notifications for select to authenticated
using (recipient_id = auth.uid() and campaign_id = app_private.current_campaign_id());
create policy notifications_update_own
on public.notifications for update to authenticated
using (recipient_id = auth.uid() and campaign_id = app_private.current_campaign_id())
with check (recipient_id = auth.uid() and campaign_id = app_private.current_campaign_id());

grant select, insert, delete on public.person_tags to authenticated;
grant select, insert, delete on public.group_members to authenticated;
grant select, insert, update on public.process_comments to authenticated;
grant select on public.process_history to authenticated;
grant select, insert, update on public.task_checklist_items to authenticated;
grant select, insert, update on public.task_comments to authenticated;
grant select, update on public.notifications to authenticated;
grant usage, select on sequence public.processes_number_seq to authenticated;

commit;

