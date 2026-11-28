create schema pilot;
revoke all on schema pilot from public, anon, authenticated;
create table pilot.profiles (
  id uuid primary key references auth.users(id),
  name text not null check (char_length(name) between 1 and 80),
  role text not null check (role in ('student', 'staff'))
);
create table pilot.facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sport text not null,
  price integer not null check (price between 0 and 10000000),
  advance_days integer not null default 7 check (advance_days between 1 and 30),
  cancel_minutes integer not null default 120 check (cancel_minutes between 0 and 1440)
);
create table pilot.staff_facilities (
  member uuid references pilot.profiles,
  facility uuid references pilot.facilities,
  primary key (member, facility)
);
create table pilot.slots (
  id uuid primary key default gen_random_uuid(),
  facility uuid not null references pilot.facilities,
  starts_at timestamptz not null,
  published boolean not null default true,
  unique (facility, starts_at),
  check (extract(epoch from starts_at)::numeric % 3600 = 0)
);
create table pilot.reservations (
  id uuid primary key default gen_random_uuid(),
  slot uuid not null references pilot.slots,
  student uuid not null references pilot.profiles,
  price integer not null,
  cancel_minutes integer not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);
create unique index reservations_active_slot on pilot.reservations(slot) where status = 'confirmed';
create index reservations_student on pilot.reservations(student);
create table pilot.listings (
  id uuid primary key default gen_random_uuid(),
  reservation uuid not null unique references pilot.reservations,
  capacity integer not null check (capacity between 1 and 30),
  price integer not null check (price between 500 and 10000000),
  description text not null check (char_length(description) between 1 and 300),
  status text not null default 'open' check (status in ('open', 'cancelled', 'settled'))
);
create table pilot.applications (
  id uuid primary key default gen_random_uuid(),
  listing uuid not null references pilot.listings,
  student uuid not null references pilot.profiles,
  price integer not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'refunded', 'expired', 'settled')),
  unique (listing, student)
);
create table pilot.ledger (
  id bigint generated always as identity primary key,
  member uuid references pilot.profiles,
  kind text not null,
  reference uuid not null,
  amount integer not null,
  created_at timestamptz not null default now(),
  unique (kind, reference)
);
create index ledger_member on pilot.ledger(member);
create table pilot.requests (
  member uuid references pilot.profiles,
  id uuid not null,
  action text not null,
  input jsonb not null,
  result jsonb not null,
  primary key (member, id)
);
alter table pilot.profiles enable row level security;
alter table pilot.facilities enable row level security;
alter table pilot.staff_facilities enable row level security;
alter table pilot.slots enable row level security;
alter table pilot.reservations enable row level security;
alter table pilot.listings enable row level security;
alter table pilot.applications enable row level security;
alter table pilot.ledger enable row level security;
alter table pilot.requests enable row level security;

create function pilot.balance(member_id uuid) returns bigint
language sql stable set search_path = '' as $$
  select coalesce(sum(amount), 0) from pilot.ledger where member = member_id;
$$;

create function pilot.settle_due() returns void
language plpgsql set search_path = '' as $$
declare
  item record;
  request pilot.applications%rowtype;
begin
  perform pg_advisory_xact_lock(97182, 1);
  for item in
    select l.id, r.student as owner from pilot.listings l
    join pilot.reservations r on r.id = l.reservation
    join pilot.slots s on s.id = r.slot
    where l.status = 'open' and s.starts_at <= clock_timestamp()
  loop
    for request in select * from pilot.applications where listing = item.id and status in ('pending', 'accepted')
    loop
      if request.status = 'accepted' then
        insert into pilot.ledger(member, kind, reference, amount) values
          (item.owner, 'listing_income', request.id, request.price - 500),
          (null, 'platform_fee', request.id, 500);
        update pilot.applications set status = 'settled' where id = request.id;
      else
        insert into pilot.ledger(member, kind, reference, amount)
          values (request.student, 'application_release', request.id, request.price);
        update pilot.applications set status = 'expired' where id = request.id;
      end if;
    end loop;
    update pilot.listings set status = 'settled' where id = item.id;
  end loop;
end;
$$;

create function public.pilot_action(operation text, payload jsonb, request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  actor_role text;
  previous pilot.requests%rowtype;
  court pilot.facilities%rowtype;
  slot_row pilot.slots%rowtype;
  booking pilot.reservations%rowtype;
  listing_row pilot.listings%rowtype;
  application pilot.applications%rowtype;
  result_id uuid;
  result jsonb;
  start_time timestamptz;
  target uuid;
  accepted boolean;
  observed_at timestamptz;
begin
  select role into actor_role from pilot.profiles where id = actor;
  if actor_role is null then raise exception 'FORBIDDEN'; end if;
  if request_id is null or operation is null or jsonb_typeof(payload) is distinct from 'object' then
    raise exception 'INVALID_INPUT';
  end if;

  -- The closed pilot serializes writes, including settlement and wallet movements.
  perform pg_advisory_xact_lock(97182, 1);
  select * into previous from pilot.requests where member = actor and id = request_id;
  if found then
    if previous.action <> operation or previous.input <> payload then raise exception 'REQUEST_REUSED'; end if;
    return previous.result;
  end if;
  perform pilot.settle_due();
  observed_at := clock_timestamp();
  target := (payload->>'id')::uuid;

  if operation in ('facility_rules', 'add_slot', 'publish_slot') then
    if actor_role <> 'staff' then raise exception 'FORBIDDEN'; end if;
    if operation = 'publish_slot' then
      select * into slot_row from pilot.slots where id = target;
    end if;
    select f.* into court from pilot.facilities f join pilot.staff_facilities sf on sf.facility = f.id
      where sf.member = actor and f.id = coalesce(slot_row.facility, target);
    if not found then raise exception 'FORBIDDEN'; end if;

    if operation = 'facility_rules' then
      update pilot.facilities set price = (payload->>'price')::integer,
        advance_days = (payload->>'advance_days')::integer,
        cancel_minutes = (payload->>'cancel_minutes')::integer
      where id = court.id returning id into result_id;
    elsif operation = 'add_slot' then
      start_time := (payload->>'starts_at')::timestamptz;
      if start_time is null or start_time <= observed_at or extract(epoch from start_time)::numeric % 3600 <> 0
        then raise exception 'INVALID_SLOT'; end if;
      insert into pilot.slots(facility, starts_at) values (court.id, start_time) returning id into result_id;
    else
      if slot_row.id is null or slot_row.starts_at <= observed_at then raise exception 'INVALID_SLOT'; end if;
      if exists(select 1 from pilot.reservations where slot = slot_row.id and status = 'confirmed')
        then raise exception 'SLOT_TAKEN'; end if;
      update pilot.slots set published = (payload->>'published')::boolean where id = slot_row.id returning id into result_id;
    end if;
  else
    if actor_role <> 'student' then raise exception 'FORBIDDEN'; end if;
    case operation
      when 'reserve' then
        select * into slot_row from pilot.slots where id = target;
        select * into court from pilot.facilities where id = slot_row.facility;
        if slot_row.id is null or not slot_row.published or slot_row.starts_at <= observed_at
          or slot_row.starts_at > observed_at + make_interval(days => court.advance_days)
          then raise exception 'INVALID_SLOT'; end if;
        if exists(select 1 from pilot.reservations where slot = target and status = 'confirmed')
          then raise exception 'SLOT_TAKEN'; end if;
        if (payload->>'price')::integer is distinct from court.price then raise exception 'PRICE_CHANGED'; end if;
        if pilot.balance(actor) < court.price then raise exception 'INSUFFICIENT_BALANCE'; end if;
        insert into pilot.reservations(slot, student, price, cancel_minutes)
          values (target, actor, court.price, court.cancel_minutes) returning id into result_id;
        insert into pilot.ledger(member, kind, reference, amount) values (actor, 'reservation_charge', result_id, -court.price);
      when 'cancel' then
        select * into booking from pilot.reservations where id = target and student = actor and status = 'confirmed';
        if not found then raise exception 'FORBIDDEN'; end if;
        select starts_at into start_time from pilot.slots where id = booking.slot;
        if start_time <= observed_at or start_time < observed_at + make_interval(mins => booking.cancel_minutes)
          then raise exception 'CANCELLATION_CLOSED'; end if;
        update pilot.reservations set status = 'cancelled' where id = target;
        insert into pilot.ledger(member, kind, reference, amount) values (actor, 'reservation_refund', target, booking.price);
        update pilot.listings set status = 'cancelled' where reservation = target returning id into result_id;
        with refunded as (
          update pilot.applications set status = 'refunded'
          where listing = result_id and status in ('pending', 'accepted') returning *
        )
        insert into pilot.ledger(member, kind, reference, amount)
          select student, 'application_release', id, price from refunded;
        result_id := target;
      when 'create_listing' then
        select r.* into booking from pilot.reservations r join pilot.slots s on s.id = r.slot
          where r.id = target and r.student = actor and r.status = 'confirmed' and s.starts_at > observed_at;
        if not found then raise exception 'FORBIDDEN'; end if;
        if exists(select 1 from pilot.listings where reservation = target) then raise exception 'ALREADY_EXISTS'; end if;
        insert into pilot.listings(reservation, capacity, price, description)
          values (target, (payload->>'capacity')::integer, (payload->>'price')::integer, btrim(payload->>'description'))
          returning id into result_id;
      when 'apply' then
        select l.* into listing_row from pilot.listings l join pilot.reservations r on r.id = l.reservation
          join pilot.slots s on s.id = r.slot where l.id = target and l.status = 'open'
          and r.status = 'confirmed' and r.student <> actor and s.starts_at > observed_at;
        if not found then raise exception 'FORBIDDEN'; end if;
        if exists(select 1 from pilot.applications where listing = target and student = actor)
          then raise exception 'ALREADY_EXISTS'; end if;
        if (select count(*) from pilot.applications where listing = target and status = 'accepted') >= listing_row.capacity
          then raise exception 'LISTING_FULL'; end if;
        if pilot.balance(actor) < listing_row.price then raise exception 'INSUFFICIENT_BALANCE'; end if;
        insert into pilot.applications(listing, student, price) values (target, actor, listing_row.price) returning id into result_id;
        insert into pilot.ledger(member, kind, reference, amount) values (actor, 'application_hold', result_id, -listing_row.price);
      when 'decide' then
        select a.* into application from pilot.applications a join pilot.listings l on l.id = a.listing
          join pilot.reservations r on r.id = l.reservation join pilot.slots s on s.id = r.slot
          where a.id = target and a.status = 'pending' and l.status = 'open'
          and r.student = actor and r.status = 'confirmed' and s.starts_at > observed_at;
        if not found then raise exception 'FORBIDDEN'; end if;
        select * into listing_row from pilot.listings where id = application.listing;
        accepted := (payload->>'accepted')::boolean;
        if accepted is null then raise exception 'INVALID_INPUT'; end if;
        if accepted and (select count(*) from pilot.applications where listing = application.listing and status = 'accepted') >= listing_row.capacity
          then raise exception 'LISTING_FULL'; end if;
        update pilot.applications set status = case when accepted then 'accepted' else 'rejected' end where id = target;
        if not accepted then
          insert into pilot.ledger(member, kind, reference, amount)
            values (application.student, 'application_release', target, application.price);
        end if;
        result_id := target;
      else raise exception 'INVALID_INPUT';
    end case;
  end if;

  result := jsonb_build_object('id', result_id);
  insert into pilot.requests values (actor, request_id, operation, payload, result);
  return result;
end;
$$;

create function public.pilot_dashboard() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  profile pilot.profiles%rowtype;
begin
  select * into profile from pilot.profiles where id = actor;
  if not found then raise exception 'FORBIDDEN'; end if;

  return (
    with facilities as (
      select f.* from pilot.facilities f where profile.role = 'student'
        or exists(select 1 from pilot.staff_facilities sf where sf.facility = f.id and sf.member = actor)
    ), slots as (
      select s.*, r.id is not null as booked, f.name as facility_name, f.price from pilot.slots s
      join facilities f on f.id = s.facility
      left join pilot.reservations r on r.slot = s.id and r.status = 'confirmed'
      where s.starts_at > now() and (profile.role = 'staff'
        or (s.published and s.starts_at <= now() + make_interval(days => f.advance_days)))
    ), reservations as (
      select r.id, r.status, r.price, r.cancel_minutes, s.starts_at, f.name as facility_name,
        l.id as listing_id, p.name as student_name, f.id as facility
      from pilot.reservations r join pilot.slots s on s.id = r.slot
      join facilities f on f.id = s.facility join pilot.profiles p on p.id = r.student
      left join pilot.listings l on l.reservation = r.id
      where profile.role = 'staff' or r.student = actor
    ), listings as (
      select l.*, s.starts_at, f.name as facility_name, p.name as owner_name, r.student = actor as mine,
        (select count(*) from pilot.applications where listing = l.id and status in ('accepted', 'settled')) as filled
      from pilot.listings l join pilot.reservations r on r.id = l.reservation
      join pilot.slots s on s.id = r.slot join facilities f on f.id = s.facility
      join pilot.profiles p on p.id = r.student
      where profile.role = 'student' and (
        (l.status = 'open' and s.starts_at > now()) or r.student = actor
        or exists(select 1 from pilot.applications a where a.listing = l.id and a.student = actor)
      )
    ), applications as (
      select a.id, a.listing, a.price, a.status, a.student = actor as mine, p.name as student_name
      from pilot.applications a join listings l on l.id = a.listing join pilot.profiles p on p.id = a.student
      where l.mine or a.student = actor
    ), movements as (
      select id, kind, amount, created_at from pilot.ledger where member = actor order by id desc limit 50
    )
    select jsonb_build_object(
      'profile', to_jsonb(profile), 'balance', pilot.balance(actor),
      'facilities', coalesce((select jsonb_agg(to_jsonb(f) order by f.name) from facilities f), '[]'),
      'slots', coalesce((select jsonb_agg(to_jsonb(s) order by s.starts_at) from slots s), '[]'),
      'reservations', coalesce((select jsonb_agg(to_jsonb(r) order by r.starts_at desc) from reservations r), '[]'),
      'listings', coalesce((select jsonb_agg(to_jsonb(l) order by l.starts_at) from listings l), '[]'),
      'applications', coalesce((select jsonb_agg(to_jsonb(a)) from applications a), '[]'),
      'movements', coalesce((select jsonb_agg(to_jsonb(m) order by m.id desc) from movements m), '[]')
    )
  );
end;
$$;

revoke all on function public.pilot_action(text, jsonb, uuid), public.pilot_dashboard() from public, anon, authenticated;
grant execute on function public.pilot_action(text, jsonb, uuid), public.pilot_dashboard() to authenticated;
