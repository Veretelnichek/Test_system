-- =====================================================================
-- Vector — обучающая платформа
-- Полная схема: таблицы, ограничения, индексы, триггеры, RLS, RPC
-- Выполните файл в Supabase SQL Editor (или через supabase db push).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Перечисления
-- ---------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('student', 'curator');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.card_status as enum ('backlog', 'in_progress', 'review', 'revision', 'done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Таблицы
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text not null,
  role public.user_role not null default 'student',
  avatar_url text,
  approved boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists profiles_email_key on public.profiles (lower(email));

create table if not exists public.curator_students (
  id uuid primary key default gen_random_uuid(),
  curator_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint curator_students_student_unique unique (student_id),
  constraint curator_students_not_self check (curator_id <> student_id)
);
create index if not exists curator_students_curator_idx on public.curator_students (curator_id);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  curator_id uuid not null references public.profiles (id) on delete cascade,
  email text,
  token text not null,
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);
create unique index if not exists invitations_token_key on public.invitations (upper(token));
create index if not exists invitations_curator_idx on public.invitations (curator_id, status);

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  constraint boards_student_unique unique (student_id)
);

create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  title text not null,
  description text not null default '',
  color text not null default '#0297DE',
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists modules_board_idx on public.modules (board_id, position);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  title text not null,
  description text not null default '',
  status public.card_status not null default 'backlog',
  assignee_id uuid not null references public.profiles (id) on delete cascade,
  deadline timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cards_title_not_empty check (char_length(btrim(title)) > 0)
);
create index if not exists cards_module_idx on public.cards (module_id, position);
create index if not exists cards_status_idx on public.cards (status);
create index if not exists cards_assignee_idx on public.cards (assignee_id);
create index if not exists cards_deadline_idx on public.cards (deadline);

create table if not exists public.card_events (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  from_status public.card_status,
  to_status public.card_status not null,
  comment text,
  created_at timestamptz not null default now()
);
create index if not exists card_events_card_idx on public.card_events (card_id, created_at);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comments_text_not_empty check (char_length(btrim(text)) > 0)
);
create index if not exists comments_card_idx on public.comments (card_id, created_at);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, read_at, created_at desc);

create table if not exists public.reminder_events (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  cycle_key text not null,
  created_at timestamptz not null default now(),
  constraint reminder_events_unique unique (card_id, user_id, cycle_key)
);
create index if not exists reminder_events_card_idx on public.reminder_events (card_id);

-- ---------------------------------------------------------------------
-- Триггеры
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists cards_set_updated_at on public.cards;
create trigger cards_set_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();

drop trigger if exists comments_set_updated_at on public.comments;
create trigger comments_set_updated_at
  before update on public.comments
  for each row execute function public.set_updated_at();

-- Запрет самостоятельного изменения роли и статуса подтверждения.
create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is not null
     and coalesce(auth.role(), '') <> 'service_role'
     and (new.role is distinct from old.role or new.approved is distinct from old.approved) then
    raise exception 'Изменение роли и статуса подтверждения доступно только администратору';
  end if;
  if auth.uid() is not null
     and coalesce(auth.role(), '') <> 'service_role'
     and new.email is distinct from old.email then
    raise exception 'Email изменяется только через Supabase Auth';
  end if;
  return new;
end $$;

drop trigger if exists profiles_protect_fields on public.profiles;
create trigger profiles_protect_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- Создание профиля и доски при регистрации.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_role_text text;
  v_role public.user_role;
  v_first text;
  v_last text;
begin
  v_role_text := coalesce(new.raw_user_meta_data ->> 'role', 'student');
  if v_role_text not in ('student', 'curator') then
    v_role_text := 'student';
  end if;
  v_role := v_role_text::public.user_role;
  v_first := coalesce(new.raw_user_meta_data ->> 'first_name', '');
  v_last := coalesce(new.raw_user_meta_data ->> 'last_name', '');

  insert into public.profiles (id, first_name, last_name, email, role, approved)
  values (
    new.id,
    v_first,
    v_last,
    coalesce(new.email, ''),
    v_role,
    v_role = 'student'
  )
  on conflict (id) do nothing;

  if v_role = 'student' then
    insert into public.boards (student_id, title)
    values (new.id, btrim(v_first || ' ' || v_last) || ' — обучение')
    on conflict (student_id) do nothing;
  end if;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Вспомогательные функции проверки доступа (security definer — обходят RLS)
-- ---------------------------------------------------------------------
create or replace function public.is_curator()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'curator')
$$;

create or replace function public.is_linked_curator(p_student uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.curator_students
    where curator_id = auth.uid() and student_id = p_student
  )
$$;

create or replace function public.is_my_curator(p_curator uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.curator_students
    where student_id = auth.uid() and curator_id = p_curator
  )
$$;

create or replace function public.can_access_board(p_board uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.boards b
    where b.id = p_board
      and (
        b.student_id = auth.uid()
        or exists (
          select 1 from public.curator_students cs
          where cs.curator_id = auth.uid() and cs.student_id = b.student_id
        )
      )
  )
$$;

create or replace function public.can_manage_board(p_board uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.boards b
    where b.id = p_board
      and (
        b.student_id = auth.uid()
        or exists (
          select 1 from public.curator_students cs
          where cs.curator_id = auth.uid() and cs.student_id = b.student_id
        )
      )
  )
$$;

create or replace function public.can_access_module(p_module uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.modules m where m.id = p_module and public.can_access_board(m.board_id)
  )
$$;

create or replace function public.can_manage_module(p_module uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.modules m where m.id = p_module and public.can_manage_board(m.board_id)
  )
$$;

create or replace function public.can_access_card(p_card uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.cards c
    where c.id = p_card and public.can_access_module(c.module_id)
  )
$$;

-- ---------------------------------------------------------------------
-- JSON-представление карточки (единый контракт для клиента)
-- ---------------------------------------------------------------------
create or replace function public.card_json(p_card uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', c.id,
    'moduleId', c.module_id,
    'title', c.title,
    'description', c.description,
    'status', c.status,
    'assigneeId', c.assignee_id,
    'deadline', c.deadline,
    'position', c.position,
    'createdAt', c.created_at,
    'updatedAt', c.updated_at,
    'moduleTitle', m.title,
    'moduleColor', m.color,
    'boardId', b.id,
    'studentId', b.student_id,
    'studentName', btrim(s.first_name || ' ' || s.last_name),
    'assigneeName', btrim(coalesce(a.first_name, '') || ' ' || coalesce(a.last_name, '')),
    'assigneeAvatar', a.avatar_url,
    'commentsCount', (select count(*)::int from public.comments cm where cm.card_id = c.id),
    'statusSince', coalesce(
      (select max(e.created_at) from public.card_events e
        where e.card_id = c.id and e.to_status = c.status),
      c.updated_at
    ),
    'submittedAt',
      (select max(e.created_at) from public.card_events e
        where e.card_id = c.id and e.to_status = 'review'),
    'isOverdue', (c.deadline is not null and c.status <> 'done' and c.deadline < now()),
    'waitingHours', case
      when c.status = 'review' then greatest(0, floor(extract(epoch from (
        now() - coalesce(
          (select max(e.created_at) from public.card_events e
            where e.card_id = c.id and e.to_status = 'review'),
          c.updated_at)
      )) / 3600))::int)
      else 0 end
  )
  from public.cards c
  join public.modules m on m.id = c.module_id
  join public.boards b on b.id = m.board_id
  join public.profiles s on s.id = b.student_id
  left join public.profiles a on a.id = c.assignee_id
  where c.id = p_card
$$;

create or replace function public.profile_json(p_profile uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', p.id,
    'firstName', p.first_name,
    'lastName', p.last_name,
    'email', p.email,
    'role', p.role,
    'avatarUrl', p.avatar_url,
    'approved', p.approved,
    'createdAt', p.created_at,
    'updatedAt', p.updated_at
  )
  from public.profiles p where p.id = p_profile
$$;

create or replace function public.board_json(p_board uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', b.id,
    'studentId', b.student_id,
    'title', b.title,
    'createdAt', b.created_at
  )
  from public.boards b where b.id = p_board
$$;

create or replace function public.module_json(p_module uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', m.id,
    'boardId', m.board_id,
    'title', m.title,
    'description', m.description,
    'color', m.color,
    'position', m.position,
    'createdAt', m.created_at
  )
  from public.modules m where m.id = p_module
$$;

create or replace function public.student_summary(p_student uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'profile', public.profile_json(p.id),
    'boardId', b.id,
    'total', coalesce(agg.total, 0),
    'done', coalesce(agg.done, 0),
    'inProgress', coalesce(agg.in_progress, 0),
    'review', coalesce(agg.review, 0),
    'revision', coalesce(agg.revision, 0),
    'backlog', coalesce(agg.backlog, 0),
    'overdue', coalesce(agg.overdue, 0),
    'percent', case when coalesce(agg.total, 0) > 0
      then round(agg.done * 100.0 / agg.total)::int else 0 end,
    'lastActivityAt', agg.last_activity
  )
  from public.profiles p
  left join public.boards b on b.student_id = p.id
  left join lateral (
    select
      count(*)::int as total,
      count(*) filter (where c.status = 'done')::int as done,
      count(*) filter (where c.status = 'in_progress')::int as in_progress,
      count(*) filter (where c.status = 'review')::int as review,
      count(*) filter (where c.status = 'revision')::int as revision,
      count(*) filter (where c.status = 'backlog')::int as backlog,
      count(*) filter (where c.deadline is not null and c.status <> 'done' and c.deadline < now())::int as overdue,
      max(c.updated_at) as last_activity
    from public.cards c
    join public.modules m on m.id = c.module_id
    where m.board_id = b.id
  ) agg on true
  where p.id = p_student
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.curator_students enable row level security;
alter table public.invitations enable row level security;
alter table public.boards enable row level security;
alter table public.modules enable row level security;
alter table public.cards enable row level security;
alter table public.card_events enable row level security;
alter table public.comments enable row level security;
alter table public.notifications enable row level security;
alter table public.reminder_events enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_linked_curator(id) or public.is_my_curator(id));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists curator_students_select on public.curator_students;
create policy curator_students_select on public.curator_students for select to authenticated
  using (curator_id = auth.uid() or student_id = auth.uid());

drop policy if exists curator_students_delete on public.curator_students;
create policy curator_students_delete on public.curator_students for delete to authenticated
  using (curator_id = auth.uid());

drop policy if exists invitations_select on public.invitations;
create policy invitations_select on public.invitations for select to authenticated
  using (curator_id = auth.uid());

drop policy if exists invitations_insert on public.invitations;
create policy invitations_insert on public.invitations for insert to authenticated
  with check (curator_id = auth.uid() and public.is_curator());

drop policy if exists invitations_update on public.invitations;
create policy invitations_update on public.invitations for update to authenticated
  using (curator_id = auth.uid()) with check (curator_id = auth.uid());

drop policy if exists invitations_delete on public.invitations;
create policy invitations_delete on public.invitations for delete to authenticated
  using (curator_id = auth.uid());

drop policy if exists boards_select on public.boards;
create policy boards_select on public.boards for select to authenticated
  using (student_id = auth.uid() or public.is_linked_curator(student_id));

drop policy if exists boards_update on public.boards;
create policy boards_update on public.boards for update to authenticated
  using (public.can_manage_board(id)) with check (public.can_manage_board(id));

drop policy if exists modules_select on public.modules;
create policy modules_select on public.modules for select to authenticated
  using (public.can_access_board(board_id));

drop policy if exists modules_insert on public.modules;
create policy modules_insert on public.modules for insert to authenticated
  with check (public.can_manage_board(board_id));

drop policy if exists modules_update on public.modules;
create policy modules_update on public.modules for update to authenticated
  using (public.can_manage_board(board_id)) with check (public.can_manage_board(board_id));

drop policy if exists modules_delete on public.modules;
create policy modules_delete on public.modules for delete to authenticated
  using (public.can_manage_board(board_id));

drop policy if exists cards_select on public.cards;
create policy cards_select on public.cards for select to authenticated
  using (public.can_access_module(module_id));

-- Карточки создаются и изменяются только через RPC (create_card / update_card / move_card).

drop policy if exists card_events_select on public.card_events;
create policy card_events_select on public.card_events for select to authenticated
  using (public.can_access_card(card_id));

drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select to authenticated
  using (public.can_access_card(card_id));

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists reminder_events_select on public.reminder_events;
create policy reminder_events_select on public.reminder_events for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- RPC: операции с заданиями
-- ---------------------------------------------------------------------
create or replace function public.move_card(
  p_card_id uuid,
  p_to public.card_status,
  p_comment text default null
) returns public.cards
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_card public.cards;
  v_from public.card_status;
  v_student uuid;
  v_board uuid;
  v_role public.user_role;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_student_name text;
  v_curator record;
begin
  if v_uid is null then
    raise exception 'Требуется авторизация';
  end if;

  select * into v_card from public.cards where id = p_card_id for update;
  if not found then
    raise exception 'Задание не найдено';
  end if;

  select b.student_id, b.id into v_student, v_board
  from public.modules m join public.boards b on b.id = m.board_id
  where m.id = v_card.module_id;

  select role into v_role from public.profiles where id = v_uid;
  v_from := v_card.status;

  if v_from = p_to then
    raise exception 'Задание уже находится в этом статусе';
  end if;

  if v_role = 'student' then
    if v_card.assignee_id <> v_uid then
      raise exception 'Это задание назначено другому ученику';
    end if;
    if not (
      (v_from = 'backlog' and p_to = 'in_progress')
      or (v_from = 'in_progress' and p_to = 'review')
      or (v_from = 'revision' and p_to = 'review')
    ) then
      if p_to = 'done' then
        raise exception 'Ученик не может перевести задание в «Готово» — это делает куратор';
      end if;
      raise exception 'Недопустимый переход статуса';
    end if;
  else
    if not exists (
      select 1 from public.curator_students
      where curator_id = v_uid and student_id = v_student
    ) then
      raise exception 'Ученик не закреплён за вами';
    end if;
    if not (v_from = 'review' and p_to in ('done', 'revision')) then
      raise exception 'Куратор может принимать или возвращать задания только из «На проверке»';
    end if;
    if p_to = 'revision' and (v_comment is null or char_length(v_comment) < 10) then
      raise exception 'При возврате на доработку нужен комментарий не короче 10 символов';
    end if;
  end if;

  update public.cards
  set status = p_to, updated_at = now()
  where id = p_card_id
  returning * into v_card;

  insert into public.card_events (card_id, actor_id, from_status, to_status, comment)
  values (p_card_id, v_uid, v_from, p_to, v_comment);

  select btrim(first_name || ' ' || last_name) into v_student_name
  from public.profiles where id = v_student;

  if p_to = 'review' then
    for v_curator in
      select curator_id from public.curator_students where student_id = v_student
    loop
      insert into public.notifications (user_id, type, payload)
      values (
        v_curator.curator_id,
        'task_submitted',
        jsonb_build_object(
          'cardId', p_card_id,
          'cardTitle', v_card.title,
          'studentId', v_student,
          'studentName', v_student_name,
          'resubmitted', v_from = 'revision'
        )
      );
    end loop;
  elsif p_to = 'done' then
    insert into public.notifications (user_id, type, payload)
    values (
      v_student,
      'task_approved',
      jsonb_build_object('cardId', p_card_id, 'cardTitle', v_card.title)
    );
  elsif p_to = 'revision' then
    insert into public.notifications (user_id, type, payload)
    values (
      v_student,
      'task_returned',
      jsonb_build_object(
        'cardId', p_card_id,
        'cardTitle', v_card.title,
        'comment', v_comment
      )
    );
  end if;

  return v_card;
end $$;

create or replace function public.add_comment(p_card_id uuid, p_text text)
returns public.comments
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_text text := btrim(coalesce(p_text, ''));
  v_comment public.comments;
  v_card public.cards;
  v_student uuid;
  v_role public.user_role;
  v_author text;
  v_curator record;
begin
  if v_uid is null then raise exception 'Требуется авторизация'; end if;
  if not public.can_access_card(p_card_id) then raise exception 'Нет доступа к заданию'; end if;
  if char_length(v_text) = 0 then raise exception 'Комментарий не может быть пустым'; end if;
  if char_length(v_text) > 4000 then raise exception 'Комментарий слишком длинный'; end if;

  select * into v_card from public.cards where id = p_card_id;
  select b.student_id into v_student
  from public.modules m join public.boards b on b.id = m.board_id
  where m.id = v_card.module_id;

  insert into public.comments (card_id, author_id, text)
  values (p_card_id, v_uid, v_text)
  returning * into v_comment;

  select role, btrim(first_name || ' ' || last_name) into v_role, v_author
  from public.profiles where id = v_uid;

  if v_role = 'curator' then
    insert into public.notifications (user_id, type, payload)
    values (
      v_student,
      'new_comment',
      jsonb_build_object(
        'cardId', p_card_id,
        'cardTitle', v_card.title,
        'actorName', v_author,
        'text', v_text
      )
    );
  else
    for v_curator in
      select curator_id from public.curator_students where student_id = v_student
    loop
      insert into public.notifications (user_id, type, payload)
      values (
        v_curator.curator_id,
        'new_comment',
        jsonb_build_object(
          'cardId', p_card_id,
          'cardTitle', v_card.title,
          'actorName', v_author,
          'text', v_text,
          'studentId', v_student,
          'studentName', v_author
        )
      );
    end loop;
  end if;

  return v_comment;
end $$;

create or replace function public.create_card(
  p_module_id uuid,
  p_title text,
  p_description text default '',
  p_deadline timestamptz default null
) returns public.cards
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_board uuid;
  v_student uuid;
  v_role public.user_role;
  v_card public.cards;
  v_position integer;
begin
  if v_uid is null then raise exception 'Требуется авторизация'; end if;
  if not public.can_manage_module(p_module_id) then raise exception 'Нет доступа к модулю'; end if;
  if char_length(btrim(coalesce(p_title, ''))) = 0 then raise exception 'Название задания обязательно'; end if;

  select b.id, b.student_id into v_board, v_student
  from public.modules m join public.boards b on b.id = m.board_id
  where m.id = p_module_id;

  select role into v_role from public.profiles where id = v_uid;
  select coalesce(max(position), 0) + 1 into v_position
  from public.cards where module_id = p_module_id;

  insert into public.cards (module_id, title, description, assignee_id, deadline, position)
  values (p_module_id, btrim(p_title), coalesce(p_description, ''), v_student, p_deadline, v_position)
  returning * into v_card;

  insert into public.card_events (card_id, actor_id, from_status, to_status)
  values (v_card.id, v_uid, null, 'backlog');

  if v_role = 'curator' then
    insert into public.notifications (user_id, type, payload)
    values (
      v_student,
      'curator_assigned',
      jsonb_build_object(
        'cardId', v_card.id,
        'cardTitle', v_card.title,
        'actorName', (select btrim(first_name || ' ' || last_name) from public.profiles where id = v_uid)
      )
    );
  end if;

  return v_card;
end $$;

create or replace function public.update_card(
  p_card_id uuid,
  p_title text default null,
  p_description text default null,
  p_deadline timestamptz default null
) returns public.cards
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_card public.cards;
  v_role public.user_role;
  v_board uuid;
begin
  if v_uid is null then raise exception 'Требуется авторизация'; end if;
  if not public.can_access_card(p_card_id) then raise exception 'Нет доступа к заданию'; end if;
  select * into v_card from public.cards where id = p_card_id for update;
  select role into v_role from public.profiles where id = v_uid;
  if v_role = 'student' and v_card.assignee_id <> v_uid then
    raise exception 'Нет доступа к заданию';
  end if;

  update public.cards set
    title = coalesce(nullif(btrim(p_title), ''), title),
    description = coalesce(p_description, description),
    deadline = coalesce(p_deadline, deadline)
  where id = p_card_id
  returning * into v_card;

  return v_card;
end $$;

-- ---------------------------------------------------------------------
-- RPC: доски, дашборды, активность, поиск
-- ---------------------------------------------------------------------
create or replace function public.get_board(p_student uuid default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_student uuid;
  v_board public.boards;
  v_student_profile public.profiles;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Требуется авторизация'; end if;
  select role into v_role from public.profiles where id = v_uid;
  if v_role is null then raise exception 'Профиль не найден'; end if;

  if v_role = 'student' then
    v_student := v_uid;
    if p_student is not null and p_student <> v_uid then
      raise exception 'Нет доступа к этой доске';
    end if;
  else
    v_student := p_student;
    if v_student is null then raise exception 'Укажите ученика'; end if;
    if not exists (
      select 1 from public.curator_students
      where curator_id = v_uid and student_id = v_student
    ) then
      raise exception 'Ученик не закреплён за вами';
    end if;
  end if;

  select * into v_student_profile from public.profiles where id = v_student;
  select * into v_board from public.boards where student_id = v_student;
  if not found then
    insert into public.boards (student_id, title)
    values (v_student, btrim(v_student_profile.first_name || ' ' || v_student_profile.last_name) || ' — обучение')
    returning * into v_board;
  end if;

  select jsonb_build_object(
    'board', public.board_json(v_board.id),
    'student', public.profile_json(v_student),
    'modules', coalesce((
      select jsonb_agg(public.module_json(m.id) order by m.position)
      from public.modules m where m.board_id = v_board.id
    ), '[]'::jsonb),
    'cards', coalesce((
      select jsonb_agg(public.card_json(c.id) order by c.position)
      from public.cards c join public.modules m on m.id = c.module_id
      where m.board_id = v_board.id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end $$;

create or replace function public.get_card_detail(p_card uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Требуется авторизация'; end if;
  if not public.can_access_card(p_card) then raise exception 'Нет доступа к заданию'; end if;

  select jsonb_build_object(
    'card', public.card_json(p_card),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'cardId', e.card_id,
        'actorId', e.actor_id,
        'fromStatus', e.from_status,
        'toStatus', e.to_status,
        'comment', e.comment,
        'createdAt', e.created_at,
        'actorName', btrim(p.first_name || ' ' || p.last_name)
      ) order by e.created_at)
      from public.card_events e
      join public.profiles p on p.id = e.actor_id
      where e.card_id = p_card
    ), '[]'::jsonb),
    'comments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'cardId', c.card_id,
        'authorId', c.author_id,
        'text', c.text,
        'createdAt', c.created_at,
        'updatedAt', c.updated_at,
        'authorName', btrim(p.first_name || ' ' || p.last_name),
        'authorAvatar', p.avatar_url,
        'authorRole', p.role
      ) order by c.created_at)
      from public.comments c
      join public.profiles p on p.id = c.author_id
      where c.card_id = p_card
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end $$;

create or replace function public.get_activity(p_student uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_students uuid[];
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Требуется авторизация'; end if;
  select role into v_role from public.profiles where id = v_uid;

  if v_role = 'student' then
    v_students := array[v_uid];
  else
    if p_student is not null and not exists (
      select 1 from public.curator_students
      where curator_id = v_uid and student_id = p_student
    ) then
      raise exception 'Ученик не закреплён за вами';
    end if;
    select coalesce(array_agg(student_id), array[]::uuid[]) into v_students
    from public.curator_students
    where curator_id = v_uid and (p_student is null or student_id = p_student);
  end if;

  select jsonb_build_object(
    'events', coalesce((
      select jsonb_agg(item order by item_created desc) from (
        select jsonb_build_object(
          'id', e.id,
          'cardId', e.card_id,
          'actorId', e.actor_id,
          'fromStatus', e.from_status,
          'toStatus', e.to_status,
          'comment', e.comment,
          'createdAt', e.created_at,
          'actorName', btrim(ap.first_name || ' ' || ap.last_name),
          'actorRole', ap.role,
          'cardTitle', c.title,
          'studentName', btrim(sp.first_name || ' ' || sp.last_name)
        ) as item, e.created_at as item_created
        from public.card_events e
        join public.cards c on c.id = e.card_id
        join public.modules m on m.id = c.module_id
        join public.boards b on b.id = m.board_id
        join public.profiles ap on ap.id = e.actor_id
        join public.profiles sp on sp.id = b.student_id
        where b.student_id = any(v_students)
        order by e.created_at desc
        limit 30
      ) t
    ), '[]'::jsonb),
    'comments', coalesce((
      select jsonb_agg(item order by item_created desc) from (
        select jsonb_build_object(
          'id', cm.id,
          'cardId', cm.card_id,
          'authorId', cm.author_id,
          'text', cm.text,
          'createdAt', cm.created_at,
          'updatedAt', cm.updated_at,
          'authorName', btrim(ap.first_name || ' ' || ap.last_name),
          'authorRole', ap.role,
          'cardTitle', c.title,
          'studentName', btrim(sp.first_name || ' ' || sp.last_name)
        ) as item, cm.created_at as item_created
        from public.comments cm
        join public.cards c on c.id = cm.card_id
        join public.modules m on m.id = c.module_id
        join public.boards b on b.id = m.board_id
        join public.profiles ap on ap.id = cm.author_id
        join public.profiles sp on sp.id = b.student_id
        where b.student_id = any(v_students)
        order by cm.created_at desc
        limit 20
      ) t
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end $$;

create or replace function public.get_students()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Требуется авторизация'; end if;
  if not public.is_curator() then raise exception 'Раздел доступен только куратору'; end if;

  select coalesce(jsonb_agg(public.student_summary(cs.student_id) order by p.last_name, p.first_name), '[]'::jsonb)
  into v_result
  from public.curator_students cs
  join public.profiles p on p.id = cs.student_id
  where cs.curator_id = auth.uid();

  return v_result;
end $$;

create or replace function public.get_review_queue()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Требуется авторизация'; end if;
  if not public.is_curator() then raise exception 'Раздел доступен только куратору'; end if;

  select coalesce(jsonb_agg(public.card_json(c.id) order by
    coalesce((select max(e.created_at) from public.card_events e
      where e.card_id = c.id and e.to_status = 'review'), c.updated_at) asc
  ), '[]'::jsonb)
  into v_result
  from public.cards c
  join public.modules m on m.id = c.module_id
  join public.boards b on b.id = m.board_id
  join public.curator_students cs on cs.student_id = b.student_id
  where cs.curator_id = auth.uid() and c.status = 'review';

  return v_result;
end $$;

create or replace function public.search_cards(p_query text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_value text := '%' || lower(btrim(coalesce(p_query, ''))) || '%';
  v_students uuid[];
  v_cards jsonb;
  v_students_json jsonb;
begin
  if v_uid is null then raise exception 'Требуется авторизация'; end if;
  select role into v_role from public.profiles where id = v_uid;

  if v_role = 'student' then
    v_students := array[v_uid];
  else
    select coalesce(array_agg(student_id), array[]::uuid[]) into v_students
    from public.curator_students where curator_id = v_uid;
  end if;

  select coalesce(jsonb_agg(public.card_json(c.id) order by c.updated_at desc), '[]'::jsonb)
  into v_cards
  from (
    select c.id, c.updated_at
    from public.cards c
    join public.modules m on m.id = c.module_id
    join public.boards b on b.id = m.board_id
    where b.student_id = any(v_students)
      and (lower(c.title) like v_value or lower(c.description) like v_value or lower(m.title) like v_value)
    limit 8
  ) c;

  if v_role = 'curator' then
    select coalesce(jsonb_agg(public.profile_json(p.id) order by p.last_name), '[]'::jsonb)
    into v_students_json
    from (
      select p.* from public.profiles p
      join public.curator_students cs on cs.student_id = p.id
      where cs.curator_id = v_uid
        and (lower(p.first_name || ' ' || p.last_name) like v_value or lower(p.email) like v_value)
      limit 5
    ) p;
  else
    v_students_json := '[]'::jsonb;
  end if;

  return jsonb_build_object('cards', v_cards, 'students', v_students_json);
end $$;

-- ---------------------------------------------------------------------
-- RPC: приглашения
-- ---------------------------------------------------------------------
create or replace function public.invite_student(p_email text default null)
returns public.invitations
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_token text;
  v_invitation public.invitations;
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
begin
  if v_uid is null then raise exception 'Требуется авторизация'; end if;
  if not public.is_curator() then raise exception 'Приглашения доступны только куратору'; end if;

  loop
    v_token := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.invitations where upper(token) = v_token);
  end loop;

  insert into public.invitations (curator_id, email, token, status, expires_at)
  values (v_uid, v_email, v_token, 'pending', now() + interval '7 days')
  returning * into v_invitation;

  return v_invitation;
end $$;

create or replace function public.accept_invitation(p_token text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_invitation public.invitations;
  v_curator public.profiles;
  v_me public.profiles;
begin
  if v_uid is null then raise exception 'Требуется авторизация'; end if;
  select * into v_me from public.profiles where id = v_uid;
  if v_me.role <> 'student' then
    raise exception 'Присоединиться к куратору может только ученик';
  end if;

  select * into v_invitation from public.invitations
  where upper(token) = upper(btrim(coalesce(p_token, ''))) and status = 'pending'
  for update;

  if not found then raise exception 'Приглашение не найдено или уже использовано'; end if;
  if v_invitation.expires_at < now() then
    update public.invitations set status = 'expired' where id = v_invitation.id;
    raise exception 'Срок действия приглашения истёк';
  end if;
  if v_invitation.email is not null and lower(v_invitation.email) <> lower(v_me.email) then
    raise exception 'Приглашение выдано для другого email';
  end if;

  select * into v_curator from public.profiles where id = v_invitation.curator_id;

  delete from public.curator_students where student_id = v_uid;
  insert into public.curator_students (curator_id, student_id)
  values (v_invitation.curator_id, v_uid);

  update public.invitations set status = 'accepted' where id = v_invitation.id;

  insert into public.boards (student_id, title)
  values (v_uid, btrim(v_me.first_name || ' ' || v_me.last_name) || ' — обучение')
  on conflict (student_id) do nothing;

  insert into public.notifications (user_id, type, payload)
  values (
    v_invitation.curator_id,
    'invitation_accepted',
    jsonb_build_object(
      'studentId', v_uid,
      'studentName', btrim(v_me.first_name || ' ' || v_me.last_name),
      'studentEmail', v_me.email
    )
  );

  return jsonb_build_object(
    'curatorName', btrim(v_curator.first_name || ' ' || v_curator.last_name)
  );
end $$;

create or replace function public.remove_student(p_student uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Требуется авторизация'; end if;
  delete from public.curator_students
  where curator_id = auth.uid() and student_id = p_student;
end $$;

-- ---------------------------------------------------------------------
-- RPC: аналитика
-- ---------------------------------------------------------------------
create or replace function public.get_analytics(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_student uuid default null
) returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_students uuid[];
  v_from timestamptz := coalesce(p_from, now() - interval '30 days');
  v_to timestamptz := coalesce(p_to, now());
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Требуется авторизация'; end if;
  select role into v_role from public.profiles where id = v_uid;

  if v_role = 'student' then
    v_students := array[v_uid];
  else
    if p_student is not null and not exists (
      select 1 from public.curator_students
      where curator_id = v_uid and student_id = p_student
    ) then
      raise exception 'Ученик не закреплён за вами';
    end if;
    select coalesce(array_agg(student_id), array[]::uuid[]) into v_students
    from public.curator_students
    where curator_id = v_uid and (p_student is null or student_id = p_student);
  end if;

  with scoped_cards as (
    select c.*, b.student_id
    from public.cards c
    join public.modules m on m.id = c.module_id
    join public.boards b on b.id = m.board_id
    where b.student_id = any(v_students)
  ),
  all_events as (
    select e.*
    from public.card_events e
    join scoped_cards c on c.id = e.card_id
  ),
  period_events as (
    select * from all_events where created_at >= v_from and created_at <= v_to
  ),
  cycles as (
    select extract(epoch from (
      e.created_at - (
        select max(e2.created_at) from all_events e2
        where e2.card_id = e.card_id and e2.to_status = 'in_progress' and e2.created_at < e.created_at
      )
    )) / 3600 as hours
    from all_events e
    where e.to_status = 'review'
  ),
  review_decisions as (
    select e.card_id,
           e.created_at,
           (select max(e2.created_at) from all_events e2
             where e2.card_id = e.card_id and e2.to_status = 'review' and e2.created_at < e.created_at) as reviewed_at
    from all_events e
    where e.from_status = 'review' and e.to_status in ('done', 'revision')
  ),
  review_durations as (
    select rd.card_id,
           extract(epoch from (rd.created_at - rd.reviewed_at)) / 3600 as hours
    from review_decisions rd
    where rd.reviewed_at is not null
  ),
  status_gaps as (
    select e.to_status as status,
           extract(epoch from (
             lead(e.created_at) over (partition by e.card_id order by e.created_at) - e.created_at
           )) / 3600 as hours
    from all_events e
  )
  select jsonb_build_object(
    'medianCycleHours', (select percentile_cont(0.5) within group (order by hours) from cycles where hours >= 0),
    'conversionRate', (
      select case when count(distinct card_id) = 0 then 0
        else round(
          count(distinct card_id) filter (where to_status = 'review') * 100.0
          / count(distinct card_id), 0)::int end
      from all_events where to_status in ('in_progress', 'review')
    ),
    'overdueReviews', (
      select count(*)::int from scoped_cards c
      where c.status = 'review' and coalesce(
        (select max(e.created_at) from all_events e where e.card_id = c.id and e.to_status = 'review'),
        c.updated_at
      ) < now() - interval '24 hours'
    ),
    'avgReviewHours', (select avg(hours) from review_durations),
    'completedTasks', (select count(*)::int from period_events where to_status = 'done'),
    'submittedTasks', (select count(*)::int from period_events where to_status = 'review'),
    'students', coalesce((
      select jsonb_agg(public.student_summary(sid) order by sid)
      from unnest(v_students) as sid
    ), '[]'::jsonb),
    'byStatus', (
      select jsonb_agg(jsonb_build_object('status', st.status, 'count', coalesce(cnt.count, 0)))
      from unnest(enum_range(null::public.card_status)) as st(status)
      left join (
        select status, count(*)::int as count from scoped_cards group by status
      ) cnt on cnt.status = st.status
    ),
    'timeline', (
      select jsonb_agg(jsonb_build_object(
        'date', to_char(d, 'YYYY-MM-DD'),
        'submitted', coalesce(s.cnt, 0),
        'completed', coalesce(c.cnt, 0),
        'created', coalesce(cr.cnt, 0)
      ) order by d)
      from generate_series(date_trunc('day', v_from), date_trunc('day', v_to), interval '1 day') d
      left join lateral (
        select count(*)::int as cnt from period_events e
        where e.to_status = 'review' and e.created_at >= d and e.created_at < d + interval '1 day'
      ) s on true
      left join lateral (
        select count(*)::int as cnt from period_events e
        where e.to_status = 'done' and e.created_at >= d and e.created_at < d + interval '1 day'
      ) c on true
      left join lateral (
        select count(*)::int as cnt from scoped_cards sc
        where sc.created_at >= d and sc.created_at < d + interval '1 day'
      ) cr on true
    ),
    'reviewTimes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'studentId', sid,
        'studentName', btrim(p.first_name || ' ' || p.last_name),
        'avgHours', (select avg(rd.hours) from review_durations rd join scoped_cards sc on sc.id = rd.card_id where sc.student_id = sid),
        'count', (select count(*)::int from review_durations rd join scoped_cards sc on sc.id = rd.card_id where sc.student_id = sid)
      ))
      from unnest(v_students) as sid
      join public.profiles p on p.id = sid
    ), '[]'::jsonb),
    'statusDurations', coalesce((
      select jsonb_agg(jsonb_build_object('status', status, 'avgHours', round(avg(hours)::numeric, 1)))
      from status_gaps where hours is not null and status is not null
      group by status
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end $$;

-- ---------------------------------------------------------------------
-- RPC: умные напоминания (запускать по cron)
-- ---------------------------------------------------------------------
create or replace function public.run_reminders()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_card record;
  v_student_name text;
  v_curator record;
  v_created integer := 0;
  v_inserted integer;
  v_since timestamptz;
  v_cycle text;
begin
  for v_card in
    select c.*, b.student_id, btrim(sp.first_name || ' ' || sp.last_name) as student_name
    from public.cards c
    join public.modules m on m.id = c.module_id
    join public.boards b on b.id = m.board_id
    join public.profiles sp on sp.id = b.student_id
    where c.status = 'in_progress'
  loop
    select coalesce(max(e.created_at), v_card.updated_at) into v_since
    from public.card_events e
    where e.card_id = v_card.id and e.to_status = 'in_progress';

    if v_since < now() - interval '48 hours' then
      v_cycle := 'stalled:' || v_since::text;
      insert into public.reminder_events (card_id, user_id, type, cycle_key)
      values (v_card.id, v_card.assignee_id, 'stalled_48h', v_cycle)
      on conflict do nothing;
      get diagnostics v_inserted = row_count;
      if v_inserted > 0 then
        insert into public.notifications (user_id, type, payload)
        values (
          v_card.assignee_id,
          'task_stalled',
          jsonb_build_object('cardId', v_card.id, 'cardTitle', v_card.title)
        );
        v_created := v_created + 1;
      end if;
    end if;
  end loop;

  -- Дедлайн в ближайшие 48 часов
  for v_card in
    select c.*
    from public.cards c
    where c.status <> 'done' and c.deadline is not null
      and c.deadline > now() and c.deadline < now() + interval '48 hours'
  loop
    v_cycle := 'deadline:' || v_card.deadline::text;
    insert into public.reminder_events (card_id, user_id, type, cycle_key)
    values (v_card.id, v_card.assignee_id, 'deadline_soon', v_cycle)
    on conflict do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted > 0 then
      insert into public.notifications (user_id, type, payload)
      values (
        v_card.assignee_id,
        'deadline_soon',
        jsonb_build_object('cardId', v_card.id, 'cardTitle', v_card.title, 'deadline', v_card.deadline)
      );
      v_created := v_created + 1;
    end if;
  end loop;

  -- Проверка ожидает более 24 часов
  for v_card in
    select c.*, b.student_id, btrim(sp.first_name || ' ' || sp.last_name) as student_name,
           coalesce((select max(e.created_at) from public.card_events e
             where e.card_id = c.id and e.to_status = 'review'), c.updated_at) as review_since
    from public.cards c
    join public.modules m on m.id = c.module_id
    join public.boards b on b.id = m.board_id
    join public.profiles sp on sp.id = b.student_id
    where c.status = 'review'
  loop
    if v_card.review_since < now() - interval '24 hours' then
      v_cycle := 'review_overdue:' || v_card.review_since::text;
      for v_curator in
        select curator_id from public.curator_students where student_id = v_card.student_id
      loop
        insert into public.reminder_events (card_id, user_id, type, cycle_key)
        values (v_card.id, v_curator.curator_id, 'review_overdue', v_cycle)
        on conflict do nothing;
        get diagnostics v_inserted = row_count;
        if v_inserted > 0 then
          insert into public.notifications (user_id, type, payload)
          values (
            v_curator.curator_id,
            'review_overdue',
            jsonb_build_object(
              'cardId', v_card.id,
              'cardTitle', v_card.title,
              'studentId', v_card.student_id,
              'studentName', v_card.student_name,
              'waitingHours', floor(extract(epoch from (now() - v_card.review_since)) / 3600)::int
            )
          );
          v_created := v_created + 1;
        end if;
      end loop;
    end if;
  end loop;

  return v_created;
end $$;

-- ---------------------------------------------------------------------
-- Административные функции (только service_role / SQL Editor)
-- ---------------------------------------------------------------------
create or replace function public.admin_approve_curator(p_email text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is not null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Недостаточно прав';
  end if;
  update public.profiles
  set approved = true
  where lower(email) = lower(btrim(p_email)) and role = 'curator';
end $$;

revoke all on function public.admin_approve_curator(text) from public;
revoke all on function public.admin_approve_curator(text) from anon, authenticated;

-- Внутренние функции не должны вызываться клиентом напрямую.
revoke all on function public.card_json(uuid) from public, anon, authenticated;
revoke all on function public.student_summary(uuid) from public, anon, authenticated;
revoke all on function public.profile_json(uuid) from public, anon, authenticated;
revoke all on function public.board_json(uuid) from public, anon, authenticated;
revoke all on function public.module_json(uuid) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when others then null; end $$;

do $$
begin
  alter publication supabase_realtime add table public.cards;
exception when others then null; end $$;

do $$
begin
  alter publication supabase_realtime add table public.comments;
exception when others then null; end $$;

-- ---------------------------------------------------------------------
-- Cron для напоминаний (если доступен pg_cron)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('vector-reminders', '*/15 * * * *', $cron$select public.run_reminders()$cron$);
  end if;
exception when others then null; end $$;
