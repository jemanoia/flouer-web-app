begin;

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'inventory_unit') then
    create type public.inventory_unit as enum ('g', 'kg', 'ml', 'l', 'pcs');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'inventory_item_type') then
    create type public.inventory_item_type as enum ('ingredient', 'packaging', 'consumable');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'inventory_movement_type') then
    create type public.inventory_movement_type as enum (
      'receive',
      'adjustment',
      'transfer_in',
      'transfer_out',
      'waste',
      'sale_deduction',
      'production_use',
      'production_return'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'inventory_adjustment_status') then
    create type public.inventory_adjustment_status as enum ('draft', 'posted', 'cancelled');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'inventory_transfer_status') then
    create type public.inventory_transfer_status as enum ('draft', 'in_transit', 'completed', 'cancelled');
  end if;
end $$;

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_app_role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
$$;

create or replace function public.can_manage_inventory()
returns boolean
language sql
stable
as $$
  select auth.role() = 'service_role' or public.current_app_role() in ('superuser', 'manager');
$$;

create table if not exists public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_inventory_locations_updated_at on public.inventory_locations;
create trigger trg_inventory_locations_updated_at
before update on public.inventory_locations
for each row
execute function public.set_row_updated_at();

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  item_type public.inventory_item_type not null default 'ingredient',
  unit public.inventory_unit not null,
  default_low_stock_threshold numeric(14, 3) not null default 0 check (default_low_stock_threshold >= 0),
  is_batch_tracked boolean not null default true,
  is_expiry_tracked boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_inventory_items_updated_at on public.inventory_items;
create trigger trg_inventory_items_updated_at
before update on public.inventory_items
for each row
execute function public.set_row_updated_at();

create table if not exists public.inventory_item_stocks (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  location_id uuid not null references public.inventory_locations(id) on delete cascade,
  current_quantity numeric(14, 3) not null default 0 check (current_quantity >= 0),
  low_stock_threshold numeric(14, 3) null check (low_stock_threshold is null or low_stock_threshold >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, location_id)
);

drop trigger if exists trg_inventory_item_stocks_updated_at on public.inventory_item_stocks;
create trigger trg_inventory_item_stocks_updated_at
before update on public.inventory_item_stocks
for each row
execute function public.set_row_updated_at();

create table if not exists public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  location_id uuid not null references public.inventory_locations(id) on delete cascade,
  batch_code text not null,
  received_at timestamptz not null default now(),
  expiry_date date null,
  quantity_on_hand numeric(14, 3) not null default 0 check (quantity_on_hand >= 0),
  unit_cost numeric(14, 4) null check (unit_cost is null or unit_cost >= 0),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, location_id, batch_code),
  check (expiry_date is null or expiry_date >= received_at::date)
);

drop trigger if exists trg_inventory_batches_updated_at on public.inventory_batches;
create trigger trg_inventory_batches_updated_at
before update on public.inventory_batches
for each row
execute function public.set_row_updated_at();

create index if not exists idx_inventory_batches_expiry
  on public.inventory_batches (location_id, expiry_date)
  where expiry_date is not null;

create table if not exists public.inventory_stock_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  location_id uuid not null references public.inventory_locations(id) on delete restrict,
  batch_id uuid null references public.inventory_batches(id) on delete set null,
  movement_type public.inventory_movement_type not null,
  quantity_delta numeric(14, 3) not null check (quantity_delta <> 0),
  reference_type text null,
  reference_id uuid null,
  reason text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_inventory_stock_movements_item_location_created
  on public.inventory_stock_movements (item_id, location_id, created_at desc);

create table if not exists public.inventory_stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.inventory_locations(id) on delete restrict,
  status public.inventory_adjustment_status not null default 'draft',
  reason text null,
  notes text null,
  created_by uuid null references auth.users(id) on delete set null,
  posted_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  posted_at timestamptz null
);

create table if not exists public.inventory_stock_adjustment_lines (
  id uuid primary key default gen_random_uuid(),
  adjustment_id uuid not null references public.inventory_stock_adjustments(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  batch_id uuid null references public.inventory_batches(id) on delete set null,
  quantity_delta numeric(14, 3) not null check (quantity_delta <> 0),
  note text null
);

create index if not exists idx_inventory_stock_adjustment_lines_adjustment_id
  on public.inventory_stock_adjustment_lines (adjustment_id);

create table if not exists public.inventory_transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_no text not null unique,
  from_location_id uuid not null references public.inventory_locations(id) on delete restrict,
  to_location_id uuid not null references public.inventory_locations(id) on delete restrict,
  status public.inventory_transfer_status not null default 'draft',
  notes text null,
  requested_by uuid null references auth.users(id) on delete set null,
  completed_by uuid null references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz null,
  check (from_location_id <> to_location_id)
);

create table if not exists public.inventory_transfer_lines (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.inventory_transfers(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  source_batch_id uuid null references public.inventory_batches(id) on delete set null,
  quantity numeric(14, 3) not null check (quantity > 0),
  note text null
);

create index if not exists idx_inventory_transfer_lines_transfer_id
  on public.inventory_transfer_lines (transfer_id);

create table if not exists public.inventory_low_stock_alerts (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  location_id uuid not null references public.inventory_locations(id) on delete cascade,
  threshold_quantity numeric(14, 3) not null check (threshold_quantity >= 0),
  current_quantity numeric(14, 3) not null check (current_quantity >= 0),
  opened_at timestamptz not null default now(),
  resolved_at timestamptz null,
  resolved_by uuid null references auth.users(id) on delete set null
);

create unique index if not exists uq_inventory_low_stock_alert_open
  on public.inventory_low_stock_alerts (item_id, location_id)
  where resolved_at is null;

create or replace function public.inventory_apply_movement(
  p_item_id uuid,
  p_location_id uuid,
  p_quantity_delta numeric(14, 3),
  p_movement_type public.inventory_movement_type,
  p_batch_id uuid default null,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_reason text default null,
  p_created_by uuid default auth.uid()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.inventory_items%rowtype;
  v_stock public.inventory_item_stocks%rowtype;
  v_batch public.inventory_batches%rowtype;
  v_movement_id uuid;
begin
  if not public.can_manage_inventory() then
    raise exception 'Not authorized to apply inventory movements.';
  end if;

  if p_quantity_delta = 0 then
    raise exception 'Quantity delta cannot be zero.';
  end if;

  select *
  into v_item
  from public.inventory_items
  where id = p_item_id
    and is_active = true;

  if not found then
    raise exception 'Inventory item % was not found or inactive.', p_item_id;
  end if;

  if not exists (
    select 1
    from public.inventory_locations
    where id = p_location_id
      and is_active = true
  ) then
    raise exception 'Inventory location % was not found or inactive.', p_location_id;
  end if;

  if p_batch_id is not null then
    select *
    into v_batch
    from public.inventory_batches
    where id = p_batch_id
    for update;

    if not found then
      raise exception 'Batch % was not found.', p_batch_id;
    end if;

    if v_batch.item_id <> p_item_id then
      raise exception 'Batch item mismatch. Expected %, got %.', p_item_id, v_batch.item_id;
    end if;

    if v_batch.location_id <> p_location_id then
      raise exception 'Batch location mismatch. Expected %, got %.', p_location_id, v_batch.location_id;
    end if;
  elsif v_item.is_batch_tracked and p_movement_type in ('receive', 'transfer_in') then
    raise exception 'Batch is required for batch-tracked item % and movement %.', p_item_id, p_movement_type;
  end if;

  insert into public.inventory_item_stocks (
    item_id,
    location_id,
    current_quantity,
    low_stock_threshold
  )
  values (
    p_item_id,
    p_location_id,
    0,
    null
  )
  on conflict (item_id, location_id) do nothing;

  select *
  into v_stock
  from public.inventory_item_stocks
  where item_id = p_item_id
    and location_id = p_location_id
  for update;

  if v_stock.current_quantity + p_quantity_delta < 0 then
    raise exception 'Insufficient stock. Current quantity: %, requested delta: %.',
      v_stock.current_quantity, p_quantity_delta;
  end if;

  update public.inventory_item_stocks
  set current_quantity = current_quantity + p_quantity_delta
  where id = v_stock.id;

  if p_batch_id is not null then
    if v_batch.quantity_on_hand + p_quantity_delta < 0 then
      raise exception 'Insufficient batch stock. Current quantity: %, requested delta: %.',
        v_batch.quantity_on_hand, p_quantity_delta;
    end if;

    update public.inventory_batches
    set quantity_on_hand = quantity_on_hand + p_quantity_delta
    where id = p_batch_id;
  end if;

  insert into public.inventory_stock_movements (
    item_id,
    location_id,
    batch_id,
    movement_type,
    quantity_delta,
    reference_type,
    reference_id,
    reason,
    created_by
  )
  values (
    p_item_id,
    p_location_id,
    p_batch_id,
    p_movement_type,
    p_quantity_delta,
    p_reference_type,
    p_reference_id,
    p_reason,
    p_created_by
  )
  returning id into v_movement_id;

  return v_movement_id;
end;
$$;

create or replace function public.inventory_post_adjustment(
  p_adjustment_id uuid,
  p_posted_by uuid default auth.uid()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_adjustment public.inventory_stock_adjustments%rowtype;
  v_line public.inventory_stock_adjustment_lines%rowtype;
begin
  if not public.can_manage_inventory() then
    raise exception 'Not authorized to post inventory adjustments.';
  end if;

  select *
  into v_adjustment
  from public.inventory_stock_adjustments
  where id = p_adjustment_id
  for update;

  if not found then
    raise exception 'Stock adjustment % not found.', p_adjustment_id;
  end if;

  if v_adjustment.status <> 'draft' then
    raise exception 'Only draft adjustments can be posted. Current status: %.', v_adjustment.status;
  end if;

  for v_line in
    select *
    from public.inventory_stock_adjustment_lines
    where adjustment_id = p_adjustment_id
  loop
    perform public.inventory_apply_movement(
      v_line.item_id,
      v_adjustment.location_id,
      v_line.quantity_delta,
      'adjustment',
      v_line.batch_id,
      'stock_adjustment',
      p_adjustment_id,
      coalesce(v_line.note, v_adjustment.reason),
      p_posted_by
    );
  end loop;

  update public.inventory_stock_adjustments
  set status = 'posted',
      posted_by = p_posted_by,
      posted_at = now()
  where id = p_adjustment_id;
end;
$$;

create or replace function public.inventory_complete_transfer(
  p_transfer_id uuid,
  p_completed_by uuid default auth.uid()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer public.inventory_transfers%rowtype;
  v_line public.inventory_transfer_lines%rowtype;
  v_source_batch public.inventory_batches%rowtype;
  v_dest_batch_id uuid;
begin
  if not public.can_manage_inventory() then
    raise exception 'Not authorized to complete inventory transfers.';
  end if;

  select *
  into v_transfer
  from public.inventory_transfers
  where id = p_transfer_id
  for update;

  if not found then
    raise exception 'Transfer % not found.', p_transfer_id;
  end if;

  if v_transfer.status not in ('draft', 'in_transit') then
    raise exception 'Only draft/in_transit transfers can be completed. Current status: %.', v_transfer.status;
  end if;

  if not exists (
    select 1
    from public.inventory_transfer_lines
    where transfer_id = p_transfer_id
  ) then
    raise exception 'Transfer % has no lines.', p_transfer_id;
  end if;

  for v_line in
    select *
    from public.inventory_transfer_lines
    where transfer_id = p_transfer_id
  loop
    if v_line.source_batch_id is not null then
      select *
      into v_source_batch
      from public.inventory_batches
      where id = v_line.source_batch_id
      for update;

      if not found then
        raise exception 'Source batch % not found for transfer line %.', v_line.source_batch_id, v_line.id;
      end if;

      insert into public.inventory_batches (
        item_id,
        location_id,
        batch_code,
        received_at,
        expiry_date,
        quantity_on_hand,
        unit_cost,
        notes
      )
      values (
        v_line.item_id,
        v_transfer.to_location_id,
        v_source_batch.batch_code,
        now(),
        v_source_batch.expiry_date,
        0,
        v_source_batch.unit_cost,
        'Auto-created by transfer ' || v_transfer.transfer_no
      )
      on conflict (item_id, location_id, batch_code)
      do update set updated_at = now()
      returning id into v_dest_batch_id;
    else
      v_dest_batch_id := null;
    end if;

    perform public.inventory_apply_movement(
      v_line.item_id,
      v_transfer.from_location_id,
      -v_line.quantity,
      'transfer_out',
      v_line.source_batch_id,
      'transfer',
      p_transfer_id,
      coalesce(v_line.note, 'Stock transfer out'),
      p_completed_by
    );

    perform public.inventory_apply_movement(
      v_line.item_id,
      v_transfer.to_location_id,
      v_line.quantity,
      'transfer_in',
      v_dest_batch_id,
      'transfer',
      p_transfer_id,
      coalesce(v_line.note, 'Stock transfer in'),
      p_completed_by
    );
  end loop;

  update public.inventory_transfers
  set status = 'completed',
      completed_by = p_completed_by,
      completed_at = now()
  where id = p_transfer_id;
end;
$$;

create or replace function public.inventory_sync_low_stock_alert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_default_threshold numeric(14, 3);
  v_threshold numeric(14, 3);
begin
  select default_low_stock_threshold
  into v_default_threshold
  from public.inventory_items
  where id = new.item_id;

  v_threshold := coalesce(new.low_stock_threshold, v_default_threshold, 0);

  if new.current_quantity <= v_threshold then
    insert into public.inventory_low_stock_alerts (
      item_id,
      location_id,
      threshold_quantity,
      current_quantity
    )
    values (
      new.item_id,
      new.location_id,
      v_threshold,
      new.current_quantity
    )
    on conflict (item_id, location_id)
    where resolved_at is null
    do update
      set threshold_quantity = excluded.threshold_quantity,
          current_quantity = excluded.current_quantity;
  else
    update public.inventory_low_stock_alerts
    set resolved_at = now(),
        resolved_by = auth.uid()
    where item_id = new.item_id
      and location_id = new.location_id
      and resolved_at is null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_inventory_low_stock_alert on public.inventory_item_stocks;

create trigger trg_inventory_low_stock_alert
after insert or update of current_quantity, low_stock_threshold
on public.inventory_item_stocks
for each row
execute function public.inventory_sync_low_stock_alert();

create or replace view public.inventory_stock_snapshot_v as
select
  s.item_id,
  i.sku,
  i.name as item_name,
  i.unit,
  s.location_id,
  l.code as location_code,
  l.name as location_name,
  s.current_quantity,
  coalesce(s.low_stock_threshold, i.default_low_stock_threshold) as effective_low_stock_threshold,
  (s.current_quantity <= coalesce(s.low_stock_threshold, i.default_low_stock_threshold)) as is_low_stock
from public.inventory_item_stocks s
join public.inventory_items i on i.id = s.item_id
join public.inventory_locations l on l.id = s.location_id;

alter table public.inventory_locations enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_item_stocks enable row level security;
alter table public.inventory_batches enable row level security;
alter table public.inventory_stock_movements enable row level security;
alter table public.inventory_stock_adjustments enable row level security;
alter table public.inventory_stock_adjustment_lines enable row level security;
alter table public.inventory_transfers enable row level security;
alter table public.inventory_transfer_lines enable row level security;
alter table public.inventory_low_stock_alerts enable row level security;

drop policy if exists "inventory_locations_select" on public.inventory_locations;
drop policy if exists "inventory_locations_manage" on public.inventory_locations;
create policy "inventory_locations_select"
  on public.inventory_locations
  for select
  to authenticated
  using (true);
create policy "inventory_locations_manage"
  on public.inventory_locations
  for all
  to authenticated
  using (public.can_manage_inventory())
  with check (public.can_manage_inventory());

drop policy if exists "inventory_items_select" on public.inventory_items;
drop policy if exists "inventory_items_manage" on public.inventory_items;
create policy "inventory_items_select"
  on public.inventory_items
  for select
  to authenticated
  using (true);
create policy "inventory_items_manage"
  on public.inventory_items
  for all
  to authenticated
  using (public.can_manage_inventory())
  with check (public.can_manage_inventory());

drop policy if exists "inventory_item_stocks_select" on public.inventory_item_stocks;
drop policy if exists "inventory_item_stocks_manage" on public.inventory_item_stocks;
create policy "inventory_item_stocks_select"
  on public.inventory_item_stocks
  for select
  to authenticated
  using (true);
create policy "inventory_item_stocks_manage"
  on public.inventory_item_stocks
  for all
  to authenticated
  using (public.can_manage_inventory())
  with check (public.can_manage_inventory());

drop policy if exists "inventory_batches_select" on public.inventory_batches;
drop policy if exists "inventory_batches_manage" on public.inventory_batches;
create policy "inventory_batches_select"
  on public.inventory_batches
  for select
  to authenticated
  using (true);
create policy "inventory_batches_manage"
  on public.inventory_batches
  for all
  to authenticated
  using (public.can_manage_inventory())
  with check (public.can_manage_inventory());

drop policy if exists "inventory_stock_movements_select" on public.inventory_stock_movements;
drop policy if exists "inventory_stock_movements_manage" on public.inventory_stock_movements;
create policy "inventory_stock_movements_select"
  on public.inventory_stock_movements
  for select
  to authenticated
  using (true);
create policy "inventory_stock_movements_manage"
  on public.inventory_stock_movements
  for all
  to authenticated
  using (public.can_manage_inventory())
  with check (public.can_manage_inventory());

drop policy if exists "inventory_stock_adjustments_select" on public.inventory_stock_adjustments;
drop policy if exists "inventory_stock_adjustments_manage" on public.inventory_stock_adjustments;
create policy "inventory_stock_adjustments_select"
  on public.inventory_stock_adjustments
  for select
  to authenticated
  using (true);
create policy "inventory_stock_adjustments_manage"
  on public.inventory_stock_adjustments
  for all
  to authenticated
  using (public.can_manage_inventory())
  with check (public.can_manage_inventory());

drop policy if exists "inventory_stock_adjustment_lines_select" on public.inventory_stock_adjustment_lines;
drop policy if exists "inventory_stock_adjustment_lines_manage" on public.inventory_stock_adjustment_lines;
create policy "inventory_stock_adjustment_lines_select"
  on public.inventory_stock_adjustment_lines
  for select
  to authenticated
  using (true);
create policy "inventory_stock_adjustment_lines_manage"
  on public.inventory_stock_adjustment_lines
  for all
  to authenticated
  using (public.can_manage_inventory())
  with check (public.can_manage_inventory());

drop policy if exists "inventory_transfers_select" on public.inventory_transfers;
drop policy if exists "inventory_transfers_manage" on public.inventory_transfers;
create policy "inventory_transfers_select"
  on public.inventory_transfers
  for select
  to authenticated
  using (true);
create policy "inventory_transfers_manage"
  on public.inventory_transfers
  for all
  to authenticated
  using (public.can_manage_inventory())
  with check (public.can_manage_inventory());

drop policy if exists "inventory_transfer_lines_select" on public.inventory_transfer_lines;
drop policy if exists "inventory_transfer_lines_manage" on public.inventory_transfer_lines;
create policy "inventory_transfer_lines_select"
  on public.inventory_transfer_lines
  for select
  to authenticated
  using (true);
create policy "inventory_transfer_lines_manage"
  on public.inventory_transfer_lines
  for all
  to authenticated
  using (public.can_manage_inventory())
  with check (public.can_manage_inventory());

drop policy if exists "inventory_low_stock_alerts_select" on public.inventory_low_stock_alerts;
drop policy if exists "inventory_low_stock_alerts_manage" on public.inventory_low_stock_alerts;
create policy "inventory_low_stock_alerts_select"
  on public.inventory_low_stock_alerts
  for select
  to authenticated
  using (true);
create policy "inventory_low_stock_alerts_manage"
  on public.inventory_low_stock_alerts
  for all
  to authenticated
  using (public.can_manage_inventory())
  with check (public.can_manage_inventory());

commit;
