-- Central de Campanha — fundação de identidade, autorização e auditoria.
-- Toda mudança de esquema remoto deve continuar sendo feita por migrações.

begin;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  candidate_name text not null,
  office text not null,
  party text,
  election_number text,
  state_code text,
  logo_path text,
  primary_color text not null default '#183f34',
  accent_color text not null default '#e6a85c',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  archived_at timestamptz,
  deleted_at timestamptz
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  name text not null,
  description text not null default '',
  scope text not null default 'assigned'
    check (scope in ('all', 'region', 'team', 'assigned', 'specific')),
  system_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  archived_at timestamptz,
  deleted_at timestamptz,
  unique (campaign_id, name),
  unique (campaign_id, system_key)
);

create table public.permissions (
  id bigint generated always as identity primary key,
  module text not null,
  action text not null,
  description text not null default '',
  unique (module, action)
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id bigint not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  role_id uuid references public.roles(id) on delete restrict,
  username extensions.citext not null,
  full_name text not null,
  avatar_path text,
  active boolean not null default false,
  must_change_password boolean not null default true,
  blocked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  archived_at timestamptz,
  deleted_at timestamptz,
  unique (campaign_id, username)
);

create table public.user_permissions (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  permission_id bigint not null references public.permissions(id) on delete cascade,
  allowed boolean not null,
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, permission_id)
);

create table public.user_scopes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  scope_type text not null check (scope_type in ('territory', 'team', 'record')),
  scope_id uuid not null,
  record_type text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  module text not null,
  record_id uuid,
  summary text not null,
  before_data jsonb,
  after_data jsonb,
  device_id uuid,
  request_id text,
  created_at timestamptz not null default now()
);

create index audit_logs_campaign_created_idx
  on public.audit_logs (campaign_id, created_at desc);
create index profiles_campaign_role_idx
  on public.profiles (campaign_id, role_id) where deleted_at is null;
create index user_scopes_profile_type_idx
  on public.user_scopes (profile_id, scope_type);
create unique index user_scopes_unique_assignment_idx
  on public.user_scopes (profile_id, scope_type, scope_id, coalesce(record_type, ''));

create or replace function app_private.touch_versioned_row()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

create trigger campaigns_touch_version
before update on public.campaigns
for each row execute function app_private.touch_versioned_row();

create trigger roles_touch_version
before update on public.roles
for each row execute function app_private.touch_versioned_row();

create trigger profiles_touch_version
before update on public.profiles
for each row execute function app_private.touch_versioned_row();

create or replace function app_private.current_campaign_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.campaign_id
  from public.profiles p
  where p.id = auth.uid()
    and p.active
    and p.deleted_at is null
    and (p.blocked_until is null or p.blocked_until <= now())
$$;

create or replace function app_private.current_role_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.role_id
  from public.profiles p
  where p.id = auth.uid()
    and p.active
    and p.deleted_at is null
    and (p.blocked_until is null or p.blocked_until <= now())
$$;

create or replace function public.has_permission(p_module text, p_action text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when auth.uid() is null then false
    when exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.active
        and p.deleted_at is null
        and (p.blocked_until is null or p.blocked_until <= now())
    ) then coalesce(
      (
        select up.allowed
        from public.user_permissions up
        join public.permissions permission on permission.id = up.permission_id
        where up.profile_id = auth.uid()
          and permission.module = p_module
          and permission.action = p_action
        limit 1
      ),
      exists (
        select 1
        from public.profiles profile
        join public.role_permissions rp on rp.role_id = profile.role_id
        join public.permissions permission on permission.id = rp.permission_id
        where profile.id = auth.uid()
          and permission.module = p_module
          and permission.action = p_action
      ),
      false
    )
    else false
  end
$$;

revoke all on function public.has_permission(text, text) from public, anon;
grant execute on function public.has_permission(text, text) to authenticated;

create or replace function app_private.protect_profile_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  new.campaign_id := old.campaign_id;

  if auth.uid() = old.id and not public.has_permission('admin', 'edit') then
    new.role_id := old.role_id;
    new.username := old.username;
    new.active := old.active;
    new.must_change_password := old.must_change_password;
    new.blocked_until := old.blocked_until;
    new.archived_at := old.archived_at;
    new.deleted_at := old.deleted_at;
  end if;

  return new;
end;
$$;

create trigger profiles_protect_fields
before update on public.profiles
for each row execute function app_private.protect_profile_fields();

create or replace function app_private.audit_versioned_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_before jsonb;
  row_after jsonb;
  target_campaign uuid;
  target_id uuid;
  action_name text;
begin
  row_before := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  row_after := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  target_campaign := coalesce(
    nullif(row_after ->> 'campaign_id', '')::uuid,
    nullif(row_before ->> 'campaign_id', '')::uuid,
    app_private.current_campaign_id()
  );
  target_id := coalesce(
    nullif(row_after ->> 'id', '')::uuid,
    nullif(row_before ->> 'id', '')::uuid
  );
  action_name := lower(tg_op);

  if target_campaign is not null then
    insert into public.audit_logs (
      campaign_id, user_id, action, module, record_id, summary,
      before_data, after_data, request_id
    ) values (
      target_campaign,
      auth.uid(),
      action_name,
      tg_argv[0],
      target_id,
      format('%s em %s', action_name, tg_argv[0]),
      row_before,
      row_after,
      current_setting('request.id', true)
    );
  end if;

  return coalesce(new, old);
end;
$$;

create trigger campaigns_audit
after insert or update or delete on public.campaigns
for each row execute function app_private.audit_versioned_change('admin');

create trigger roles_audit
after insert or update or delete on public.roles
for each row execute function app_private.audit_versioned_change('admin');

create trigger profiles_audit
after insert or update or delete on public.profiles
for each row execute function app_private.audit_versioned_change('admin');

insert into public.campaigns (
  id, name, candidate_name, office, state_code
) values (
  '00000000-0000-4000-8000-000000000001',
  'Central de Campanha',
  'Candidata',
  'Deputada Estadual',
  'BR'
) on conflict (id) do nothing;

insert into public.roles (
  id, campaign_id, name, description, scope, system_key
) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Administrador Master', 'Acesso completo e administração sensível.', 'all', 'master'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Candidata', 'Visão estratégica e módulos autorizados.', 'all', 'candidate'),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'Coordenação Geral', 'Gestão ampla da operação.', 'all', 'general_coordination'),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'Coordenação Regional', 'Gestão limitada às regiões atribuídas.', 'region', 'regional_coordination'),
  ('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', 'Atendimento / Cadastro', 'Pessoas, contatos e demandas autorizadas.', 'assigned', 'service'),
  ('10000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', 'Eventos / Logística', 'Eventos, equipes, checklists e logística.', 'team', 'events'),
  ('10000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000001', 'Jurídico / Compliance', 'Documentos, processos e privacidade.', 'assigned', 'legal'),
  ('10000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000001', 'Financeiro / Administrativo', 'Despesas e controles administrativos internos.', 'assigned', 'finance'),
  ('10000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000001', 'Comunicação', 'Ferramentas operacionais autorizadas.', 'assigned', 'communication'),
  ('10000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000001', 'Voluntário', 'Apenas atribuições e eventos necessários.', 'assigned', 'volunteer')
on conflict (id) do nothing;

with modules(module) as (
  select unnest(array[
    'dashboard', 'people', 'processes', 'tasks', 'calendar', 'events',
    'team', 'territory', 'documents', 'finance', 'reports', 'reminders',
    'privacy', 'audit', 'admin', 'sync', 'devices'
  ]::text[])
), actions(action) as (
  select unnest(array[
    'view', 'create', 'edit', 'delete', 'archive', 'restore', 'export',
    'print', 'assign', 'view_documents', 'upload_documents', 'view_contact',
    'reports', 'settings'
  ]::text[])
)
insert into public.permissions (module, action)
select modules.module, actions.action
from modules cross join actions
on conflict (module, action) do nothing;

-- O Administrador Master recebe a matriz completa.
insert into public.role_permissions (role_id, permission_id)
select '10000000-0000-4000-8000-000000000001'::uuid, p.id
from public.permissions p
on conflict do nothing;

-- Perfis estratégicos e operacionais recebem somente as áreas necessárias.
insert into public.role_permissions (role_id, permission_id)
select role_id, permission_id
from (
  select r.id role_id, p.id permission_id
  from public.roles r
  cross join public.permissions p
  where r.system_key = 'candidate'
    and p.module = any(array['dashboard','people','processes','tasks','calendar','events','team','territory','documents','reports','reminders'])
    and p.action = any(array['view','view_documents','view_contact','reports','print','export'])

  union all

  select r.id, p.id
  from public.roles r
  cross join public.permissions p
  where r.system_key = 'general_coordination'
    and p.module <> 'admin'
    and p.action <> 'settings'

  union all

  select r.id, p.id
  from public.roles r
  cross join public.permissions p
  where r.system_key = 'regional_coordination'
    and p.module = any(array['dashboard','people','processes','tasks','calendar','events','team','territory','documents','reports','reminders'])
    and p.action = any(array['view','create','edit','assign','view_documents','view_contact','reports','print'])

  union all

  select r.id, p.id
  from public.roles r
  cross join public.permissions p
  where r.system_key = 'service'
    and p.module = any(array['dashboard','people','processes','tasks','reminders'])
    and p.action = any(array['view','create','edit','assign','view_contact'])

  union all

  select r.id, p.id
  from public.roles r
  cross join public.permissions p
  where r.system_key = 'events'
    and p.module = any(array['dashboard','tasks','calendar','events','team','territory','documents','reminders'])
    and p.action = any(array['view','create','edit','assign','view_documents','upload_documents'])

  union all

  select r.id, p.id
  from public.roles r
  cross join public.permissions p
  where r.system_key = 'legal'
    and p.module = any(array['dashboard','processes','tasks','documents','privacy','audit','reminders'])
    and p.action = any(array['view','create','edit','assign','view_documents','upload_documents','reports','print','export'])

  union all

  select r.id, p.id
  from public.roles r
  cross join public.permissions p
  where r.system_key = 'finance'
    and p.module = any(array['dashboard','tasks','documents','finance','reports','reminders'])
    and p.action = any(array['view','create','edit','assign','view_documents','upload_documents','reports','print','export'])

  union all

  select r.id, p.id
  from public.roles r
  cross join public.permissions p
  where r.system_key = 'communication'
    and p.module = any(array['dashboard','tasks','events','documents','reminders'])
    and p.action = any(array['view','create','edit','view_documents','upload_documents'])

  union all

  select r.id, p.id
  from public.roles r
  cross join public.permissions p
  where r.system_key = 'volunteer'
    and p.module = any(array['dashboard','tasks','events','reminders'])
    and p.action = any(array['view','edit'])
) grants
on conflict do nothing;

create or replace function app_private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  desired_username text;
  desired_name text;
begin
  desired_username := lower(coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    'usuario-' || left(new.id::text, 8)
  ));

  if desired_username !~ '^[a-z0-9._-]{3,40}$' then
    desired_username := 'usuario-' || left(new.id::text, 8);
  end if;

  desired_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    'Usuário da campanha'
  );

  begin
    insert into public.profiles (
      id, campaign_id, username, full_name, active, must_change_password
    ) values (
      new.id,
      '00000000-0000-4000-8000-000000000001',
      desired_username,
      desired_name,
      false,
      true
    );
  exception when unique_violation then
    insert into public.profiles (
      id, campaign_id, username, full_name, active, must_change_password
    ) values (
      new.id,
      '00000000-0000-4000-8000-000000000001',
      'usuario-' || left(new.id::text, 8),
      desired_name,
      false,
      true
    );
  end;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function app_private.handle_new_auth_user();

create or replace function public.claim_master_access()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  master_role_id uuid := '10000000-0000-4000-8000-000000000001';
  campaign uuid := '00000000-0000-4000-8000-000000000001';
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if not exists (
    select 1
    from auth.users auth_user
    where auth_user.id = auth.uid()
      and auth_user.email_confirmed_at is not null
      and coalesce(auth_user.raw_app_meta_data ->> 'bootstrap_master', 'false') = 'true'
  ) then
    raise exception 'bootstrap_not_authorized';
  end if;

  perform pg_advisory_xact_lock(hashtext('central-campanha-master-bootstrap'));

  if exists (
    select 1
    from public.profiles p
    where p.role_id = master_role_id
      and p.active
      and p.deleted_at is null
      and p.id <> auth.uid()
  ) then
    return false;
  end if;

  update public.profiles
  set role_id = master_role_id,
      active = true,
      must_change_password = true,
      blocked_until = null
  where id = auth.uid()
    and campaign_id = campaign;

  if not found then
    raise exception 'profile_not_found';
  end if;

  insert into public.audit_logs (
    campaign_id, user_id, action, module, record_id, summary, after_data
  ) values (
    campaign,
    auth.uid(),
    'bootstrap_master',
    'admin',
    auth.uid(),
    'Administrador Master inicial ativado',
    jsonb_build_object('role_id', master_role_id)
  );

  return true;
end;
$$;

revoke all on function public.claim_master_access() from public, anon;
grant execute on function public.claim_master_access() to authenticated;

create or replace function public.my_access_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'profile', to_jsonb(profile),
    'role', to_jsonb(role_row),
    'permissions', coalesce((
      select jsonb_object_agg(grouped.module, grouped.actions)
      from (
        select permission.module,
               jsonb_agg(permission.action order by permission.action) as actions
        from public.permissions permission
        where public.has_permission(permission.module, permission.action)
        group by permission.module
      ) grouped
    ), '{}'::jsonb),
    'scopes', coalesce((
      select jsonb_agg(to_jsonb(scope_row) order by scope_row.created_at)
      from public.user_scopes scope_row
      where scope_row.profile_id = auth.uid()
    ), '[]'::jsonb)
  )
  from public.profiles profile
  left join public.roles role_row on role_row.id = profile.role_id
  where profile.id = auth.uid()
$$;

revoke all on function public.my_access_snapshot() from public, anon;
grant execute on function public.my_access_snapshot() to authenticated;

alter table public.campaigns enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;
alter table public.user_permissions enable row level security;
alter table public.user_scopes enable row level security;
alter table public.audit_logs enable row level security;

grant usage on schema app_private to authenticated;
revoke all on all functions in schema app_private from public, anon, authenticated;
grant execute on function app_private.current_campaign_id() to authenticated;
grant execute on function app_private.current_role_id() to authenticated;

create policy campaigns_select_current
on public.campaigns for select to authenticated
using (id = app_private.current_campaign_id());

create policy campaigns_update_admin
on public.campaigns for update to authenticated
using (id = app_private.current_campaign_id() and public.has_permission('admin', 'settings'))
with check (id = app_private.current_campaign_id() and public.has_permission('admin', 'settings'));

create policy roles_select_current
on public.roles for select to authenticated
using (
  campaign_id = app_private.current_campaign_id()
  and (id = app_private.current_role_id() or public.has_permission('admin', 'view'))
);

create policy roles_manage_admin
on public.roles for all to authenticated
using (campaign_id = app_private.current_campaign_id() and public.has_permission('admin', 'settings'))
with check (campaign_id = app_private.current_campaign_id() and public.has_permission('admin', 'settings'));

create policy permissions_select_authenticated
on public.permissions for select to authenticated
using (app_private.current_campaign_id() is not null);

create policy role_permissions_select_current
on public.role_permissions for select to authenticated
using (role_id = app_private.current_role_id() or public.has_permission('admin', 'view'));

create policy role_permissions_manage_admin
on public.role_permissions for all to authenticated
using (public.has_permission('admin', 'settings'))
with check (public.has_permission('admin', 'settings'));

create policy profiles_select_directory
on public.profiles for select to authenticated
using (
  id = auth.uid()
  or (
    campaign_id = app_private.current_campaign_id()
    and (
      public.has_permission('admin', 'view')
      or public.has_permission('team', 'view')
      or public.has_permission('tasks', 'view')
      or public.has_permission('processes', 'view')
    )
  )
);

create policy profiles_update_self_or_admin
on public.profiles for update to authenticated
using (
  id = auth.uid()
  or (campaign_id = app_private.current_campaign_id() and public.has_permission('admin', 'edit'))
)
with check (
  id = auth.uid()
  or (campaign_id = app_private.current_campaign_id() and public.has_permission('admin', 'edit'))
);

create policy user_permissions_select_own_or_admin
on public.user_permissions for select to authenticated
using (profile_id = auth.uid() or public.has_permission('admin', 'view'));

create policy user_permissions_manage_admin
on public.user_permissions for all to authenticated
using (public.has_permission('admin', 'settings'))
with check (public.has_permission('admin', 'settings'));

create policy user_scopes_select_own_or_admin
on public.user_scopes for select to authenticated
using (profile_id = auth.uid() or public.has_permission('admin', 'view'));

create policy user_scopes_manage_admin
on public.user_scopes for all to authenticated
using (public.has_permission('admin', 'settings'))
with check (public.has_permission('admin', 'settings'));

create policy audit_logs_select_authorized
on public.audit_logs for select to authenticated
using (
  campaign_id = app_private.current_campaign_id()
  and public.has_permission('audit', 'view')
);

revoke all on all tables in schema public from anon;

grant select, update on public.campaigns to authenticated;
grant select, insert, update on public.roles to authenticated;
grant select on public.permissions to authenticated;
grant select, insert, update, delete on public.role_permissions to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.user_permissions to authenticated;
grant select, insert, update, delete on public.user_scopes to authenticated;
grant select on public.audit_logs to authenticated;

commit;

